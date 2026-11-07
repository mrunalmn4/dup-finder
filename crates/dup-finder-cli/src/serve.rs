use axum::extract::{Path, State};
use axum::http::header::{AUTHORIZATION, CONTENT_TYPE, HeaderValue};
use axum::http::{HeaderMap, Method, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use axum::body::Body;
use axum::extract::Query;
use axum::response::Response;
use dup_finder_app::{
    AppSession, CreateJobRequest, DeleteRequestDto, JobStore, ScanJobState, ScanRequest,
    ScanResponse, ScheduledJob,
};
use dup_finder_engine::{
    list_suggested_locations, DeleteReport, QuarantinedFile, ScanResult, SimilarImageGroup,
    SuggestReport, SuggestedLocation, VerifyReport,
};
use serde::Deserialize;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tower_http::cors::{AllowOrigin, CorsLayer};

#[derive(Clone)]
struct AppState {
    token: String,
    session: Arc<AppSession>,
    jobs: Arc<JobStore>,
}

#[derive(Deserialize)]
struct SuggestBody {
    scan_id: String,
}

#[derive(Deserialize)]
struct VerifyBody {
    scan_id: String,
    hash: String,
}

#[derive(Deserialize)]
struct SimilarBody {
    scan_id: String,
    #[serde(default = "default_similar_threshold")]
    threshold: u32,
}

fn default_similar_threshold() -> u32 {
    10
}

fn unauthorized() -> (StatusCode, String) {
    (StatusCode::UNAUTHORIZED, "unauthorized".into())
}

fn timing_eq(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.bytes().zip(b.bytes()) {
        diff |= x ^ y;
    }
    diff == 0
}

fn check_auth(headers: &HeaderMap, token: &str) -> Result<(), (StatusCode, String)> {
    let Some(val) = headers.get(AUTHORIZATION) else {
        return Err(unauthorized());
    };
    let Ok(s) = val.to_str() else {
        return Err(unauthorized());
    };
    let expected = format!("Bearer {token}");
    if !timing_eq(s, &expected) {
        return Err(unauthorized());
    }
    Ok(())
}

fn cors_layer() -> CorsLayer {
    // Browser UI on Vite; Tauri uses IPC (no CORS). Extra origins via DUP_FINDER_CORS_ORIGINS
    // (comma-separated) when non-loopback Docker UAT needs them.
    let mut origins: Vec<HeaderValue> = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    ]
    .into_iter()
    .map(|o| HeaderValue::from_static(o))
    .collect();
    if let Ok(extra) = std::env::var("DUP_FINDER_CORS_ORIGINS") {
        for part in extra.split(',') {
            let t = part.trim();
            if t.is_empty() {
                continue;
            }
            if let Ok(hv) = HeaderValue::from_str(t) {
                origins.push(hv);
            }
        }
    }
    CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([Method::GET, Method::POST, Method::DELETE, Method::OPTIONS])
        .allow_headers([AUTHORIZATION, CONTENT_TYPE])
}

/// Fail closed: non-loopback binds require an explicit escape hatch (Docker UAT only).
fn ensure_bind_allowed(addr: SocketAddr) -> Result<(), String> {
    let allow_remote = std::env::var("DUP_FINDER_ALLOW_NON_LOOPBACK")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    if !addr.ip().is_loopback() && !allow_remote {
        return Err(
            "refusing non-loopback bind (set DUP_FINDER_ALLOW_NON_LOOPBACK=1 for Docker UAT only)"
                .into(),
        );
    }
    Ok(())
}

fn map_err(e: String) -> (StatusCode, String) {
    let status = if e.contains("not found") {
        StatusCode::NOT_FOUND
    } else if e.contains("required") || e.contains("mode must") {
        StatusCode::BAD_REQUEST
    } else {
        StatusCode::INTERNAL_SERVER_ERROR
    };
    (status, e)
}

async fn health() -> &'static str {
    "ok"
}

async fn locations(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<SuggestedLocation>>, (StatusCode, String)> {
    check_auth(&headers, &state.token)?;
    Ok(Json(list_suggested_locations()))
}

async fn scan(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ScanRequest>,
) -> Result<Json<ScanResponse>, (StatusCode, String)> {
    check_auth(&headers, &state.token)?;
    state.session.scan(body).map(Json).map_err(map_err)
}

#[derive(serde::Serialize)]
struct StartJobResponse {
    job_id: String,
}

async fn scan_start(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ScanRequest>,
) -> Result<Json<StartJobResponse>, (StatusCode, String)> {
    check_auth(&headers, &state.token)?;
    let job_id = state.session.scan_start(body).map_err(map_err)?;
    Ok(Json(StartJobResponse { job_id }))
}

async fn scan_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
) -> Result<Json<ScanJobState>, (StatusCode, String)> {
    check_auth(&headers, &state.token)?;
    state.session.scan_job(&job_id).map(Json).map_err(map_err)
}

async fn scan_cancel(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    check_auth(&headers, &state.token)?;
    state.session.scan_cancel(&job_id).map_err(map_err)?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct RootsQuery {
    roots: String,
}

async fn quarantine_list(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<RootsQuery>,
) -> Result<Json<Vec<QuarantinedFile>>, (StatusCode, String)> {
    check_auth(&headers, &state.token)?;
    let roots: Vec<PathBuf> = q
        .roots
        .split('\n')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
        .collect();
    state
        .session
        .quarantine_list(&roots)
        .map(Json)
        .map_err(map_err)
}

#[derive(Deserialize)]
struct RestoreBody {
    path: PathBuf,
    roots: Vec<PathBuf>,
}

async fn quarantine_restore(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<RestoreBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    check_auth(&headers, &state.token)?;
    let dest = state
        .session
        .quarantine_restore(body.path, body.roots)
        .map_err(map_err)?;
    Ok(Json(serde_json::json!({ "path": dest })))
}

#[derive(Deserialize)]
struct PreviewQuery {
    path: String,
}

async fn preview(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<PreviewQuery>,
) -> Result<Response, (StatusCode, String)> {
    check_auth(&headers, &state.token)?;
    let (mime, bytes) = state
        .session
        .preview_image(PathBuf::from(q.path).as_path())
        .map_err(map_err)?;
    Response::builder()
        .status(StatusCode::OK)
        .header(CONTENT_TYPE, mime)
        .body(Body::from(bytes))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn get_scan(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(scan_id): Path<String>,
) -> Result<Json<ScanResult>, (StatusCode, String)> {
    check_auth(&headers, &state.token)?;
    state.session.get_scan(&scan_id).map(Json).map_err(map_err)
}

async fn suggest(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<SuggestBody>,
) -> Result<Json<SuggestReport>, (StatusCode, String)> {
    check_auth(&headers, &state.token)?;
    state
        .session
        .suggest(&body.scan_id)
        .map(Json)
        .map_err(map_err)
}

async fn verify_group(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<VerifyBody>,
) -> Result<Json<VerifyReport>, (StatusCode, String)> {
    check_auth(&headers, &state.token)?;
    state
        .session
        .verify_group(&body.scan_id, &body.hash)
        .map(Json)
        .map_err(map_err)
}

async fn similar_images(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<SimilarBody>,
) -> Result<Json<Vec<SimilarImageGroup>>, (StatusCode, String)> {
    check_auth(&headers, &state.token)?;
    state
        .session
        .similar_images(&body.scan_id, body.threshold)
        .map(Json)
        .map_err(map_err)
}

async fn delete_paths(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<DeleteRequestDto>,
) -> Result<Json<DeleteReport>, (StatusCode, String)> {
    check_auth(&headers, &state.token)?;
    state.session.delete(body).map(Json).map_err(map_err)
}

async fn create_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateJobRequest>,
) -> Result<Json<ScheduledJob>, (StatusCode, String)> {
    check_auth(&headers, &state.token)?;
    state.jobs.create(body).map(Json).map_err(map_err)
}

async fn list_jobs(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<ScheduledJob>>, (StatusCode, String)> {
    check_auth(&headers, &state.token)?;
    state.jobs.list().map(Json).map_err(map_err)
}

async fn get_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
) -> Result<Json<ScheduledJob>, (StatusCode, String)> {
    check_auth(&headers, &state.token)?;
    state.jobs.get(&job_id).map(Json).map_err(map_err)
}

async fn delete_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    check_auth(&headers, &state.token)?;
    state.jobs.delete(&job_id).map_err(map_err)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn run_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
) -> Result<Json<ScheduledJob>, (StatusCode, String)> {
    check_auth(&headers, &state.token)?;
    // run blocking scan off the async worker
    let jobs = state.jobs.clone();
    let session = state.session.clone();
    let job_id = job_id.clone();
    tokio::task::spawn_blocking(move || jobs.run_now(&session, &job_id))
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .map(Json)
        .map_err(map_err)
}

fn spawn_scheduler(state: AppState) {
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(Duration::from_secs(5));
        loop {
            ticker.tick().await;
            let due = match state.jobs.due_jobs() {
                Ok(d) => d,
                Err(_) => continue,
            };
            for job in due {
                let jobs = state.jobs.clone();
                let session = state.session.clone();
                let id = job.id.clone();
                let _ = tokio::task::spawn_blocking(move || jobs.run_now(&session, &id)).await;
            }
        }
    });
}

pub async fn run_server(
    host: String,
    port: u16,
    token: String,
    state_db: PathBuf,
) -> Result<(), String> {
    let jobs = Arc::new(JobStore::open(&state_db)?);
    let state = AppState {
        token: token.clone(),
        session: Arc::new(AppSession::new()),
        jobs,
    };
    spawn_scheduler(state.clone());

    let app = Router::new()
        .route("/health", get(health))
        .route("/v1/locations", get(locations))
        .route("/v1/scan", post(scan))
        .route("/v1/scan/start", post(scan_start))
        .route("/v1/scan/jobs/{job_id}", get(scan_job))
        .route("/v1/scan/jobs/{job_id}/cancel", post(scan_cancel))
        .route("/v1/scans/{scan_id}", get(get_scan))
        .route("/v1/suggest", post(suggest))
        .route("/v1/verify", post(verify_group))
        .route("/v1/similar", post(similar_images))
        .route("/v1/delete", post(delete_paths))
        .route("/v1/quarantine", get(quarantine_list))
        .route("/v1/restore", post(quarantine_restore))
        .route("/v1/preview", get(preview))
        .route("/v1/jobs", get(list_jobs).post(create_job))
        .route("/v1/jobs/{job_id}", get(get_job).delete(delete_job))
        .route("/v1/jobs/{job_id}/run", post(run_job))
        .layer(cors_layer())
        .with_state(state);

    let addr: SocketAddr = format!("{host}:{port}")
        .parse()
        .map_err(|e| format!("bad bind address: {e}"))?;
    ensure_bind_allowed(addr)?;
    eprintln!("dup-finder serve listening on http://{addr}");
    eprintln!("state db: {}", state_db.display());
    eprintln!("auth: Bearer token configured (value not logged)");
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| e.to_string())?;
    axum::serve(listener, app)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn loopback_always_allowed() {
        let _g = ENV_LOCK.lock().unwrap();
        std::env::remove_var("DUP_FINDER_ALLOW_NON_LOOPBACK");
        let addr: SocketAddr = "127.0.0.1:7420".parse().unwrap();
        assert!(ensure_bind_allowed(addr).is_ok());
    }

    #[test]
    fn non_loopback_refused_without_env() {
        let _g = ENV_LOCK.lock().unwrap();
        std::env::remove_var("DUP_FINDER_ALLOW_NON_LOOPBACK");
        let addr: SocketAddr = "0.0.0.0:7420".parse().unwrap();
        let err = ensure_bind_allowed(addr).unwrap_err();
        assert!(err.contains("refusing non-loopback"));
    }

    #[test]
    fn non_loopback_ok_with_escape_hatch() {
        let _g = ENV_LOCK.lock().unwrap();
        std::env::set_var("DUP_FINDER_ALLOW_NON_LOOPBACK", "1");
        let addr: SocketAddr = "0.0.0.0:7420".parse().unwrap();
        assert!(ensure_bind_allowed(addr).is_ok());
        std::env::remove_var("DUP_FINDER_ALLOW_NON_LOOPBACK");
    }

    #[test]
    fn bearer_token_required() {
        let mut headers = HeaderMap::new();
        assert!(check_auth(&headers, "secret").is_err());
        headers.insert(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_static("Bearer secret"),
        );
        assert!(check_auth(&headers, "secret").is_ok());
        headers.insert(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_static("Bearer wrong"),
        );
        assert!(check_auth(&headers, "secret").is_err());
    }
}
