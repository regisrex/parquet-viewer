use reqwest::Client;
use serde::{Deserialize, Serialize};
use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrinoColumn {
    pub name: String,
    #[serde(rename = "type")]
    pub type_name: String,
}

#[derive(Debug, Deserialize)]
struct TrinoError {
    pub message: String,
    #[serde(rename = "errorName")]
    pub error_name: String,
}

#[derive(Debug, Deserialize)]
struct TrinoResponse {
    pub id: Option<String>,
    #[serde(rename = "nextUri")]
    pub next_uri: Option<String>,
    pub columns: Option<Vec<TrinoColumn>>,
    pub data: Option<Vec<Vec<serde_json::Value>>>,
    pub error: Option<TrinoError>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QueryResult {
    pub query_id: String,
    pub columns: Vec<TrinoColumn>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub row_count: usize,
    pub elapsed_ms: u64,
}

pub struct TrinoClient {
    http: Client,
    host: String,
    user: String,
    catalog: Option<String>,
    schema: Option<String>,
}

impl TrinoClient {
    pub fn new(
        host: &str,
        user: &str,
        catalog: Option<&str>,
        schema: Option<&str>,
    ) -> Self {
        let http = Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .expect("HTTP client build failed");
        Self {
            http,
            host: host.trim_end_matches('/').to_string(),
            user: user.to_string(),
            catalog: catalog.map(str::to_string),
            schema: schema.map(str::to_string),
        }
    }

    pub async fn execute(&self, sql: &str) -> AppResult<QueryResult> {
        let start = std::time::Instant::now();

        let mut req = self
            .http
            .post(format!("{}/v1/statement", self.host))
            .header("X-Trino-User", &self.user)
            .header("X-Trino-Source", "parquet-viewer")
            .header("Content-Type", "text/plain; charset=utf-8");

        if let Some(cat) = &self.catalog {
            req = req.header("X-Trino-Catalog", cat);
        }
        if let Some(sch) = &self.schema {
            req = req.header("X-Trino-Schema", sch);
        }

        let resp: TrinoResponse = req
            .body(sql.to_string())
            .send()
            .await?
            .json()
            .await?;

        let query_id = resp.id.clone().unwrap_or_default();
        let mut columns: Vec<TrinoColumn> = resp.columns.clone().unwrap_or_default();
        let mut all_rows: Vec<Vec<serde_json::Value>> = Vec::new();

        if let Some(err) = resp.error {
            return Err(AppError::Trino(format!("[{}] {}", err.error_name, err.message)));
        }
        if let Some(rows) = resp.data {
            all_rows.extend(rows);
        }

        let mut next_uri = resp.next_uri;
        while let Some(uri) = next_uri {
            tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

            let page: TrinoResponse = self
                .http
                .get(&uri)
                .header("X-Trino-User", &self.user)
                .send()
                .await?
                .json()
                .await?;

            if let Some(err) = page.error {
                return Err(AppError::Trino(format!("[{}] {}", err.error_name, err.message)));
            }
            if columns.is_empty() {
                if let Some(cols) = page.columns {
                    columns = cols;
                }
            }
            if let Some(rows) = page.data {
                all_rows.extend(rows);
            }
            next_uri = page.next_uri;
        }

        let elapsed_ms = start.elapsed().as_millis() as u64;
        let row_count = all_rows.len();

        Ok(QueryResult {
            query_id,
            columns,
            rows: all_rows,
            row_count,
            elapsed_ms,
        })
    }
}
