use dup_finder_app::{
    AppSession, CreateJobRequest, DeleteRequestDto, JobStore, ScanJobState, ScanRequest,
    ScanResponse, ScheduledJob,
};
use dup_finder_engine::{
    list_suggested_locations, DeleteReport, QuarantinedFile, ScanFilters, ScanResult,
    SuggestReport, SuggestedLocation,
};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;

struct DesktopState {
    session: Arc<AppSession>,
    jobs: Arc<JobStore>,
}

fn jobs_db_path() -> PathBuf {
    let base = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    base.join(".dup-finder").join("jobs.sqlite")
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
    filters: Option<ScanFilters>,
) -> Result<ScanResponse, String> {
    state.session.scan(ScanRequest {
        roots: roots.into_iter().map(Into::into).collect(),
        index_path: index_path.map(Into::into),
        filters: filters.unwrap_or_else(ScanFilters::sensible_defaults),
    })
}

#[tauri::command]
fn scan_start(
    state: State<'_, DesktopState>,
    roots: Vec<String>,
    index_path: Option<String>,
    filters: Option<ScanFilters>,
) -> Result<String, String> {
    state.session.scan_start(ScanRequest {
        roots: roots.into_iter().map(Into::into).collect(),
        index_path: index_path.map(Into::into),
        filters: filters.unwrap_or_else(ScanFilters::sensible_defaults),
    })
}

#[tauri::command]
fn scan_job(state: State<'_, DesktopState>, job_id: String) -> Result<ScanJobState, String> {
    state.session.scan_job(&job_id)
}

#[tauri::command]
fn get_scan(state: State<'_, DesktopState>, scan_id: String) -> Result<ScanResult, String> {
    state.session.get_scan(&scan_id)
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

#[tauri::command]
fn quarantine_list(
    state: State<'_, DesktopState>,
    roots: Vec<String>,
) -> Result<Vec<QuarantinedFile>, String> {
    let roots: Vec<PathBuf> = roots.into_iter().map(Into::into).collect();
    state.session.quarantine_list(&roots)
}

#[tauri::command]
fn quarantine_restore(
    state: State<'_, DesktopState>,
    path: String,
    roots: Vec<String>,
) -> Result<String, String> {
    let dest = state.session.quarantine_restore(
        PathBuf::from(path),
        roots.into_iter().map(Into::into).collect(),
    )?;
    Ok(dest.to_string_lossy().into())
}

#[tauri::command]
fn preview_image(
    state: State<'_, DesktopState>,
    path: String,
) -> Result<(String, Vec<u8>), String> {
    state.session.preview_image(PathBuf::from(path).as_path())
}

#[tauri::command]
fn jobs_list(state: State<'_, DesktopState>) -> Result<Vec<ScheduledJob>, String> {
    state.jobs.list()
}

#[tauri::command]
fn jobs_create(
    state: State<'_, DesktopState>,
    roots: Vec<String>,
    index_path: Option<String>,
    filters: Option<ScanFilters>,
    interval_secs: u64,
    enabled: bool,
) -> Result<ScheduledJob, String> {
    state.jobs.create(CreateJobRequest {
        roots: roots.into_iter().map(Into::into).collect(),
        index_path: index_path.map(Into::into),
        filters: filters.unwrap_or_else(ScanFilters::sensible_defaults),
        interval_secs,
        enabled,
    })
}

#[tauri::command]
fn jobs_delete(state: State<'_, DesktopState>, job_id: String) -> Result<(), String> {
    state.jobs.delete(&job_id)
}

#[tauri::command]
fn jobs_run(state: State<'_, DesktopState>, job_id: String) -> Result<ScheduledJob, String> {
    state.jobs.run_now(&state.session, &job_id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let jobs = Arc::new(JobStore::open(&jobs_db_path()).expect("open jobs db"));
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(DesktopState {
            session: Arc::new(AppSession::new()),
            jobs,
        })
        .invoke_handler(tauri::generate_handler![
            health,
            list_locations,
            scan,
            scan_start,
            scan_job,
            get_scan,
            suggest,
            delete,
            quarantine_list,
            quarantine_restore,
            preview_image,
            jobs_list,
            jobs_create,
            jobs_delete,
            jobs_run
        ])
        .run(tauri::generate_context!())
        .expect("error while running Dup Finder desktop");
}
