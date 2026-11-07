use dup_finder_app::{AppSession, DeleteRequestDto, ScanRequest, ScanResponse};
use dup_finder_engine::{
    list_suggested_locations, DeleteReport, SuggestReport, SuggestedLocation,
};
use std::sync::Arc;
use tauri::State;

struct DesktopState {
    session: Arc<AppSession>,
}

#[tauri::command]
fn health() -> String {
    "ok".into()
}

#[tauri::command]
fn list_locations() -> Vec<SuggestedLocation> {
    list_suggested_locations()
}

#[tauri::command]
fn scan(
    state: State<'_, DesktopState>,
    roots: Vec<String>,
    index_path: Option<String>,
) -> Result<ScanResponse, String> {
    state.session.scan(ScanRequest {
        roots: roots.into_iter().map(Into::into).collect(),
        index_path: index_path.map(Into::into),
    })
}

#[tauri::command]
fn suggest(state: State<'_, DesktopState>, scan_id: String) -> Result<SuggestReport, String> {
    state.session.suggest(&scan_id)
}

#[tauri::command]
fn delete(
    state: State<'_, DesktopState>,
    scan_id: String,
    paths: Vec<String>,
    keep: Vec<String>,
    mode: String,
    confirm: bool,
) -> Result<DeleteReport, String> {
    state.session.delete(DeleteRequestDto {
        scan_id,
        paths: paths.into_iter().map(Into::into).collect(),
        keep: keep.into_iter().map(Into::into).collect(),
        mode,
        confirm,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(DesktopState {
            session: Arc::new(AppSession::new()),
        })
        .invoke_handler(tauri::generate_handler![
            health,
            list_locations,
            scan,
            suggest,
            delete
        ])
        .run(tauri::generate_context!())
        .expect("error while running Dup Finder desktop");
}
