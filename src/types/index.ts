export interface TrinoColumn {
  name: string;
  type_name: string;
}

export interface QueryResult {
  query_id: string;
  columns: TrinoColumn[];
  rows: Array<Array<string | number | boolean | null>>;
  row_count: number;
  elapsed_ms: number;
}

export interface ConnectionRecord {
  id: string;
  name: string;
  host: string;
  username: string;
  catalog: string | null;
  schema_name: string | null;
  created_at: string;
  last_used: string | null;
}

export interface QueryHistoryEntry {
  id: string;
  connection_id: string;
  sql_text: string;
  row_count: number | null;
  elapsed_ms: number | null;
  executed_at: string;
}

export interface QueryTab {
  id: string;
  title: string;
  sql: string;
  result: QueryResult | null;
  isRunning: boolean;
  error: string | null;
}

export interface SchemaColumnInfo {
  name: string;
  physical_type: string;
  logical_type: string | null;
}

export interface ColumnChunkInfo {
  name: string;
  compression: string;
  encodings: string[];
  num_values: number;
  compressed_bytes: number;
  uncompressed_bytes: number;
  null_count: number | null;
}

export interface RowGroupInfo {
  num_rows: number;
  total_size_bytes: number;
  columns: ColumnChunkInfo[];
}

export interface ParquetMeta {
  path: string;
  file_name: string;
  file_size_bytes: number;
  num_rows: number;
  num_row_groups: number;
  created_by: string | null;
  schema_columns: SchemaColumnInfo[];
  row_groups: RowGroupInfo[];
}

export interface ParquetPreview {
  result: QueryResult;
  meta: ParquetMeta;
}

export interface SchemaNode {
  type: "catalog" | "schema" | "table";
  name: string;
  path: string;
  children?: SchemaNode[];
  isExpanded: boolean;
  isLoading: boolean;
}
