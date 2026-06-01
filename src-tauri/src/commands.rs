use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;
use chrono::Utc;

use crate::history::{ConnectionRecord, HistoryDb, QueryHistoryEntry};
use crate::parquet_reader::{read_parquet, ParquetPreview};
use crate::schema::SchemaExplorer;
use crate::trino::{QueryResult, TrinoClient, TrinoColumn};

pub struct AppState {
    pub db: Mutex<HistoryDb>,
}

// ─── Connection commands ──────────────────────────────────────────────────────

#[tauri::command]
pub fn save_connection(
    record: ConnectionRecord,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.save_connection(&record).map_err(String::from)
}

#[tauri::command]
pub fn get_connections(state: State<'_, AppState>) -> Result<Vec<ConnectionRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_connections().map_err(String::from)
}

#[tauri::command]
pub fn delete_connection(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_connection(&id).map_err(String::from)
}

// ─── Query command ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn run_query(
    sql: String,
    connection_id: String,
    state: State<'_, AppState>,
) -> Result<QueryResult, String> {
    // Load connection (lock, clone, drop)
    let conn_record = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let conns = db.get_connections().map_err(String::from)?;
        conns
            .into_iter()
            .find(|c| c.id == connection_id)
            .ok_or_else(|| format!("Connection '{}' not found", connection_id))?
    };

    let client = TrinoClient::new(
        &conn_record.host,
        &conn_record.username,
        conn_record.catalog.as_deref(),
        conn_record.schema_name.as_deref(),
    );

    let result = client.execute(&sql).await.map_err(String::from)?;

    // Save to history (lock, write, drop)
    {
        let now = Utc::now().to_rfc3339();
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let _ = db.touch_connection(&connection_id, &now);
        let _ = db.save_query(&QueryHistoryEntry {
            id: Uuid::new_v4().to_string(),
            connection_id: connection_id.clone(),
            sql_text: sql.clone(),
            row_count: Some(result.row_count as i64),
            elapsed_ms: Some(result.elapsed_ms as i64),
            executed_at: now,
        });
    }

    Ok(result)
}

// ─── Schema commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_catalogs(
    connection_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let conn_record = get_connection(&connection_id, &state)?;
    SchemaExplorer::new(&conn_record.host, &conn_record.username)
        .list_catalogs()
        .await
        .map_err(String::from)
}

#[tauri::command]
pub async fn list_schemas(
    connection_id: String,
    catalog: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let conn_record = get_connection(&connection_id, &state)?;
    SchemaExplorer::new(&conn_record.host, &conn_record.username)
        .list_schemas(&catalog)
        .await
        .map_err(String::from)
}

#[tauri::command]
pub async fn list_tables(
    connection_id: String,
    catalog: String,
    schema: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let conn_record = get_connection(&connection_id, &state)?;
    SchemaExplorer::new(&conn_record.host, &conn_record.username)
        .list_tables(&catalog, &schema)
        .await
        .map_err(String::from)
}

#[tauri::command]
pub async fn describe_table(
    connection_id: String,
    catalog: String,
    schema: String,
    table: String,
    state: State<'_, AppState>,
) -> Result<Vec<TrinoColumn>, String> {
    let conn_record = get_connection(&connection_id, &state)?;
    SchemaExplorer::new(&conn_record.host, &conn_record.username)
        .describe_table(&catalog, &schema, &table)
        .await
        .map_err(String::from)
}

// ─── History command ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_history(
    connection_id: String,
    limit: usize,
    state: State<'_, AppState>,
) -> Result<Vec<QueryHistoryEntry>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_history(&connection_id, limit).map_err(String::from)
}

// ─── Local Parquet file command ───────────────────────────────────────────────

#[tauri::command]
pub fn read_parquet_file(path: String, limit: Option<usize>) -> Result<ParquetPreview, String> {
    read_parquet(&path, limit.unwrap_or(2000))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn get_connection(
    connection_id: &str,
    state: &State<'_, AppState>,
) -> Result<ConnectionRecord, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let conns = db.get_connections().map_err(String::from)?;
    conns
        .into_iter()
        .find(|c| c.id == connection_id)
        .ok_or_else(|| format!("Connection '{}' not found", connection_id))
}
