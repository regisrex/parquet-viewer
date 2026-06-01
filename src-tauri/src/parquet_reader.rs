use parquet::file::reader::{FileReader, SerializedFileReader};
use parquet::record::Field;
use serde::Serialize;
use std::{fs, path::Path, time::Instant};

use crate::trino::{QueryResult, TrinoColumn};

#[derive(Debug, Serialize, Clone)]
pub struct ParquetMeta {
    pub path: String,
    pub file_name: String,
    pub file_size_bytes: u64,
    pub num_rows: i64,
    pub num_row_groups: usize,
    pub created_by: Option<String>,
    pub schema_columns: Vec<SchemaColumnInfo>,
    pub row_groups: Vec<RowGroupInfo>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SchemaColumnInfo {
    pub name: String,
    pub physical_type: String,
    pub logical_type: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct RowGroupInfo {
    pub num_rows: i64,
    pub total_size_bytes: i64,
    pub columns: Vec<ColumnChunkInfo>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ColumnChunkInfo {
    pub name: String,
    pub compression: String,
    pub encodings: Vec<String>,
    pub num_values: i64,
    pub compressed_bytes: i64,
    pub uncompressed_bytes: i64,
    pub null_count: Option<i64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ParquetPreview {
    pub result: QueryResult,
    pub meta: ParquetMeta,
}

pub fn read_parquet(path_str: &str, limit: usize) -> Result<ParquetPreview, String> {
    let start = Instant::now();
    let path = Path::new(path_str);

    let file_size_bytes = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(path_str)
        .to_string();

    let file =
        fs::File::open(path).map_err(|e| format!("Cannot open file: {}", e))?;
    let reader = SerializedFileReader::new(file)
        .map_err(|e| format!("Not a valid Parquet file: {}", e))?;

    let metadata = reader.metadata();
    let file_meta = metadata.file_metadata();

    let num_rows = file_meta.num_rows();
    let num_row_groups = metadata.num_row_groups();
    let created_by = file_meta.created_by().map(str::to_string);

    // ── Schema columns ──────────────────────────────────────────────────────
    let schema_descr = file_meta.schema_descr();
    let schema_columns: Vec<SchemaColumnInfo> = schema_descr
        .columns()
        .iter()
        .map(|col| SchemaColumnInfo {
            name: col.name().to_string(),
            physical_type: format!("{:?}", col.physical_type()),
            logical_type: col.logical_type().as_ref().map(|lt| format!("{:?}", lt)),
        })
        .collect();

    let columns: Vec<TrinoColumn> = schema_columns
        .iter()
        .map(|sc| TrinoColumn {
            name: sc.name.clone(),
            type_name: sc
                .logical_type
                .clone()
                .unwrap_or_else(|| sc.physical_type.clone()),
        })
        .collect();

    // ── Row group metadata ──────────────────────────────────────────────────
    let row_groups: Vec<RowGroupInfo> = (0..num_row_groups)
        .map(|i| {
            let rg = metadata.row_group(i);
            let chunk_cols: Vec<ColumnChunkInfo> = (0..rg.num_columns())
                .map(|j| {
                    let col = rg.column(j);
                    ColumnChunkInfo {
                        name: col.column_descr().name().to_string(),
                        compression: format!("{:?}", col.compression()),
                        encodings: col
                            .encodings()
                            .iter()
                            .map(|e| format!("{:?}", e))
                            .collect(),
                        num_values: col.num_values(),
                        compressed_bytes: col.compressed_size(),
                        uncompressed_bytes: col.uncompressed_size(),
                        null_count: col
                            .statistics()
                            .and_then(|s| s.null_count_opt())
                            .map(|n| n as i64),
                    }
                })
                .collect();
            RowGroupInfo {
                num_rows: rg.num_rows(),
                total_size_bytes: rg.total_byte_size(),
                columns: chunk_cols,
            }
        })
        .collect();

    // ── Data rows ───────────────────────────────────────────────────────────
    let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();
    if let Ok(row_iter) = reader.get_row_iter(None) {
        for row_result in row_iter {
            if rows.len() >= limit {
                break;
            }
            if let Ok(row) = row_result {
                let cells: Vec<serde_json::Value> = row
                    .get_column_iter()
                    .map(|(_, field)| field_to_cell(field))
                    .collect();
                rows.push(cells);
            }
        }
    }

    let elapsed_ms = start.elapsed().as_millis() as u64;
    let row_count = rows.len();

    Ok(ParquetPreview {
        meta: ParquetMeta {
            path: path_str.to_string(),
            file_name,
            file_size_bytes,
            num_rows,
            num_row_groups,
            created_by,
            schema_columns,
            row_groups,
        },
        result: QueryResult {
            query_id: "local-parquet".to_string(),
            columns,
            rows,
            row_count,
            elapsed_ms,
        },
    })
}

// ── Field conversion ────────────────────────────────────────────────────────

/// Top-level cell: primitives keep their type, nested structs become JSON strings
/// (so the frontend's `isJsonLike()` fires and renders them with JsonViewer).
fn field_to_cell(field: &Field) -> serde_json::Value {
    match field {
        Field::Group(_) | Field::ListInternal(_) | Field::MapInternal(_) => {
            serde_json::Value::String(
                serde_json::to_string(&field_to_json(field))
                    .unwrap_or_else(|_| "{}".to_string()),
            )
        }
        other => field_to_json(other),
    }
}

/// Recursive JSON representation (used for nested traversal).
fn field_to_json(field: &Field) -> serde_json::Value {
    match field {
        Field::Null => serde_json::Value::Null,
        Field::Bool(b) => serde_json::Value::Bool(*b),
        Field::Byte(b) => serde_json::json!(*b as i32),
        Field::Short(s) => serde_json::json!(*s as i32),
        Field::Int(i) => serde_json::json!(*i),
        Field::Long(l) => serde_json::json!(*l),
        Field::UByte(b) => serde_json::json!(*b as u32),
        Field::UShort(s) => serde_json::json!(*s as u32),
        Field::UInt(i) => serde_json::json!(*i),
        Field::ULong(l) => serde_json::json!(*l),
        Field::Float(f) => {
            if f.is_finite() {
                serde_json::json!(*f as f64)
            } else {
                serde_json::Value::Null
            }
        }
        Field::Double(d) => {
            if d.is_finite() {
                serde_json::json!(*d)
            } else {
                serde_json::Value::Null
            }
        }
        Field::Decimal(d) => serde_json::Value::String(format_decimal(d)),
        Field::Str(s) => serde_json::Value::String(s.clone()),
        Field::Bytes(b) => serde_json::Value::String(format!("<binary {} B>", b.len())),
        Field::Date(d) => serde_json::Value::String(format_date(*d)),
        Field::TimestampMillis(t) => serde_json::Value::String(format_ts_ms(*t)),
        Field::TimestampMicros(t) => serde_json::Value::String(format_ts_us(*t)),

        Field::Group(row) => serde_json::Value::Object(
            row.get_column_iter()
                .map(|(name, f)| (name.clone(), field_to_json(f)))
                .collect(),
        ),
        Field::ListInternal(list) => {
            serde_json::Value::Array(list.elements().iter().map(field_to_json).collect())
        }
        Field::MapInternal(map) => serde_json::Value::Object(
            map.entries()
                .iter()
                .map(|(k, v)| {
                    let key = match k {
                        Field::Str(s) => s.clone(),
                        Field::Int(i) => i.to_string(),
                        Field::Long(l) => l.to_string(),
                        other => format!("{:?}", other),
                    };
                    (key, field_to_json(v))
                })
                .collect(),
        ),

        // Catch-all for any future variants
        #[allow(unreachable_patterns)]
        _ => serde_json::Value::Null,
    }
}

fn format_decimal(d: &parquet::data_type::Decimal) -> String {
    use parquet::data_type::Decimal;
    match d {
        Decimal::Int32 { value, scale, .. } => {
            scale_decimal(i32::from_be_bytes(*value) as i64, *scale)
        }
        Decimal::Int64 { value, scale, .. } => {
            scale_decimal(i64::from_be_bytes(*value), *scale)
        }
        Decimal::Bytes { precision, scale, .. } => {
            format!("<decimal({},{})>", precision, scale)
        }
    }
}

fn scale_decimal(value: i64, scale: i32) -> String {
    if scale <= 0 {
        return value.to_string();
    }
    let divisor = 10_i64.pow(scale as u32);
    let int_part = value / divisor;
    let frac_part = value.abs() % divisor;
    format!("{}.{:0>width$}", int_part, frac_part, width = scale as usize)
}

fn format_date(days: i32) -> String {
    use chrono::{Duration, NaiveDate};
    NaiveDate::from_ymd_opt(1970, 1, 1)
        .and_then(|epoch| epoch.checked_add_signed(Duration::days(days as i64)))
        .map(|d| d.to_string())
        .unwrap_or_else(|| format!("date({})", days))
}

fn format_ts_ms(ms: i64) -> String {
    use chrono::{TimeZone, Utc};
    Utc.timestamp_millis_opt(ms)
        .single()
        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S%.3f UTC").to_string())
        .unwrap_or_else(|| format!("{}ms", ms))
}

fn format_ts_us(us: i64) -> String {
    format_ts_ms(us / 1000)
}
