use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use crate::error::{AppError, AppResult};

const SCHEMA_SQL: &str = "
CREATE TABLE IF NOT EXISTS connections (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    host        TEXT NOT NULL,
    username    TEXT NOT NULL DEFAULT 'user',
    catalog     TEXT,
    schema_name TEXT,
    created_at  TEXT NOT NULL,
    last_used   TEXT
);

CREATE TABLE IF NOT EXISTS query_history (
    id            TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL,
    sql_text      TEXT NOT NULL,
    row_count     INTEGER,
    elapsed_ms    INTEGER,
    executed_at   TEXT NOT NULL
);
";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConnectionRecord {
    pub id: String,
    pub name: String,
    pub host: String,
    pub username: String,
    pub catalog: Option<String>,
    pub schema_name: Option<String>,
    pub created_at: String,
    pub last_used: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QueryHistoryEntry {
    pub id: String,
    pub connection_id: String,
    pub sql_text: String,
    pub row_count: Option<i64>,
    pub elapsed_ms: Option<i64>,
    pub executed_at: String,
}

pub struct HistoryDb {
    conn: Connection,
}

impl HistoryDb {
    pub fn open() -> AppResult<Self> {
        let data_dir = dirs::data_local_dir()
            .ok_or_else(|| AppError::Other("Cannot find local data directory".into()))?
            .join("rexs-parquets");
        std::fs::create_dir_all(&data_dir)?;
        let db_path = data_dir.join("history.db");
        let conn = Connection::open(db_path)?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> AppResult<()> {
        self.conn.execute_batch(SCHEMA_SQL)?;
        Ok(())
    }

    pub fn save_connection(&self, rec: &ConnectionRecord) -> AppResult<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO connections
             (id, name, host, username, catalog, schema_name, created_at, last_used)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                rec.id,
                rec.name,
                rec.host,
                rec.username,
                rec.catalog,
                rec.schema_name,
                rec.created_at,
                rec.last_used,
            ],
        )?;
        Ok(())
    }

    pub fn get_connections(&self) -> AppResult<Vec<ConnectionRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, host, username, catalog, schema_name, created_at, last_used
             FROM connections ORDER BY last_used DESC, created_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(ConnectionRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                host: row.get(2)?,
                username: row.get(3)?,
                catalog: row.get(4)?,
                schema_name: row.get(5)?,
                created_at: row.get(6)?,
                last_used: row.get(7)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    pub fn delete_connection(&self, id: &str) -> AppResult<()> {
        self.conn
            .execute("DELETE FROM connections WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn touch_connection(&self, id: &str, now: &str) -> AppResult<()> {
        self.conn.execute(
            "UPDATE connections SET last_used = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        Ok(())
    }

    pub fn save_query(&self, entry: &QueryHistoryEntry) -> AppResult<()> {
        self.conn.execute(
            "INSERT INTO query_history
             (id, connection_id, sql_text, row_count, elapsed_ms, executed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                entry.id,
                entry.connection_id,
                entry.sql_text,
                entry.row_count,
                entry.elapsed_ms,
                entry.executed_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_history(
        &self,
        connection_id: &str,
        limit: usize,
    ) -> AppResult<Vec<QueryHistoryEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, connection_id, sql_text, row_count, elapsed_ms, executed_at
             FROM query_history
             WHERE connection_id = ?1
             ORDER BY executed_at DESC
             LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![connection_id, limit as i64], |row| {
            Ok(QueryHistoryEntry {
                id: row.get(0)?,
                connection_id: row.get(1)?,
                sql_text: row.get(2)?,
                row_count: row.get(3)?,
                elapsed_ms: row.get(4)?,
                executed_at: row.get(5)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }
}
