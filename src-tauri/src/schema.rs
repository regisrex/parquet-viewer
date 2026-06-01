use crate::error::AppResult;
use crate::trino::{TrinoClient, TrinoColumn};

pub struct SchemaExplorer {
    host: String,
    user: String,
}

impl SchemaExplorer {
    pub fn new(host: &str, user: &str) -> Self {
        Self {
            host: host.to_string(),
            user: user.to_string(),
        }
    }

    fn client(&self) -> TrinoClient {
        TrinoClient::new(&self.host, &self.user, None, None)
    }

    pub async fn list_catalogs(&self) -> AppResult<Vec<String>> {
        let result = self.client().execute("SHOW CATALOGS").await?;
        Ok(result
            .rows
            .iter()
            .filter_map(|r| r.first().and_then(|v| v.as_str()).map(str::to_string))
            .collect())
    }

    pub async fn list_schemas(&self, catalog: &str) -> AppResult<Vec<String>> {
        let sql = format!("SHOW SCHEMAS FROM \"{}\"", escape_identifier(catalog));
        let result = self.client().execute(&sql).await?;
        Ok(result
            .rows
            .iter()
            .filter_map(|r| r.first().and_then(|v| v.as_str()).map(str::to_string))
            .collect())
    }

    pub async fn list_tables(&self, catalog: &str, schema: &str) -> AppResult<Vec<String>> {
        let sql = format!(
            "SHOW TABLES FROM \"{}\".\"{}\"",
            escape_identifier(catalog),
            escape_identifier(schema)
        );
        let result = self.client().execute(&sql).await?;
        Ok(result
            .rows
            .iter()
            .filter_map(|r| r.first().and_then(|v| v.as_str()).map(str::to_string))
            .collect())
    }

    pub async fn describe_table(
        &self,
        catalog: &str,
        schema: &str,
        table: &str,
    ) -> AppResult<Vec<TrinoColumn>> {
        let sql = format!(
            "DESCRIBE \"{}\".\"{}\".\"{}\""  ,
            escape_identifier(catalog),
            escape_identifier(schema),
            escape_identifier(table)
        );
        let result = self.client().execute(&sql).await?;
        Ok(result
            .rows
            .iter()
            .filter_map(|r| {
                let name = r.get(0).and_then(|v| v.as_str())?.to_string();
                let type_name = r.get(1).and_then(|v| v.as_str())?.to_string();
                Some(TrinoColumn { name, type_name })
            })
            .collect())
    }
}

fn escape_identifier(s: &str) -> String {
    s.replace('"', "\"\"")
}
