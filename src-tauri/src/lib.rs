mod commands;
mod error;
mod history;
mod parquet_reader;
mod schema;
mod trino;

use commands::AppState;
use history::HistoryDb;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = HistoryDb::open().expect("Failed to open history database");
    let state = AppState {
        db: std::sync::Mutex::new(db),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::run_query,
            commands::list_catalogs,
            commands::list_schemas,
            commands::list_tables,
            commands::describe_table,
            commands::save_connection,
            commands::get_connections,
            commands::delete_connection,
            commands::get_history,
            commands::read_parquet_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
