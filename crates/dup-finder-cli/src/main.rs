mod serve;

use clap::{Parser, Subcommand, ValueEnum};
use dup_finder_engine::{
    safe_delete, scan_with_options, suggest_from_scan, DeleteMode, DeleteRequest, FsDeleteBackend,
    ScanOptions, ScanResult,
};
use std::path::PathBuf;
use std::process::ExitCode;

#[derive(Parser, Debug)]
#[command(
    name = "dup-finder",
    version,
    about = "Find content duplicates and safely remove only what you confirm"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Scan paths for content duplicates (extension ignored)
    Scan {
        #[arg(required = true)]
        paths: Vec<PathBuf>,
        #[arg(short, long)]
        output: Option<PathBuf>,
        #[arg(long)]
        index: Option<PathBuf>,
        #[arg(long, default_value_t = true)]
        summary: bool,
        #[arg(long, default_value_t = false)]
        quiet: bool,
    },
    /// Suggest which duplicate to keep (never deletes)
    Suggest {
        #[arg(long)]
        from_scan: PathBuf,
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    /// Delete only explicitly listed paths after re-verification
    Delete {
        #[arg(long)]
        from_scan: PathBuf,
        #[arg(long = "path", required = true)]
        paths: Vec<PathBuf>,
        #[arg(long = "keep")]
        keep: Vec<PathBuf>,
        #[arg(long, value_enum, default_value_t = CliDeleteMode::DryRun)]
        mode: CliDeleteMode,
        #[arg(long)]
        confirm: bool,
    },
    /// Localhost HTTP API + scheduled scan jobs (loopback bind enforced)
    Serve {
        #[arg(long, default_value = "127.0.0.1")]
        host: String,
        #[arg(long, default_value_t = 7420)]
        port: u16,
        /// Bearer token (default: random). Or set DUP_FINDER_TOKEN.
        #[arg(long)]
        token: Option<String>,
        /// SQLite path for scheduled jobs / daemon state
        #[arg(long, default_value = "dup-finder-state.sqlite")]
        state: PathBuf,
    },
}

#[derive(Clone, Debug, ValueEnum)]
enum CliDeleteMode {
    DryRun,
    Trash,
    Permanent,
}

impl From<CliDeleteMode> for DeleteMode {
    fn from(value: CliDeleteMode) -> Self {
        match value {
            CliDeleteMode::DryRun => DeleteMode::DryRun,
            CliDeleteMode::Trash => DeleteMode::Trash,
            CliDeleteMode::Permanent => DeleteMode::Permanent,
        }
    }
}

fn main() -> ExitCode {
    match run() {
        Ok(code) => code,
        Err(e) => {
            eprintln!("error: {e}");
            ExitCode::FAILURE
        }
    }
}

fn format_bytes(n: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;
    let n = n as f64;
    if n >= GB {
        format!("{:.2} GB", n / GB)
    } else if n >= MB {
        format!("{:.2} MB", n / MB)
    } else if n >= KB {
        format!("{:.2} KB", n / KB)
    } else {
        format!("{n:.0} B")
    }
}

fn print_scan_summary(result: &ScanResult, computed: usize, reused: usize) {
    eprintln!("── Dup Finder scan ──");
    eprintln!("files scanned : {}", result.files_scanned);
    eprintln!("files skipped : {}", result.files_skipped);
    eprintln!("dup groups    : {}", result.groups.len());
    eprintln!("dup files     : {}", result.duplicate_file_count());
    eprintln!(
        "reclaimable   : {} (if one copy kept per group)",
        format_bytes(result.reclaimable_bytes())
    );
    eprintln!("hashes        : {computed} computed, {reused} reused from index");
}

fn run() -> Result<ExitCode, String> {
    let cli = Cli::parse();
    match cli.command {
        Commands::Scan {
            paths,
            output,
            index,
            summary,
            quiet,
        } => {
            let (result, stats) = scan_with_options(ScanOptions {
                roots: paths,
                index_path: index,
            })
            .map_err(|e| e.to_string())?;
            if summary && !quiet {
                print_scan_summary(&result, stats.hashes_computed, stats.hashes_reused);
            }
            let json = serde_json::to_string_pretty(&result).map_err(|e| e.to_string())?;
            if let Some(path) = output {
                std::fs::write(&path, json).map_err(|e| e.to_string())?;
                if !quiet {
                    eprintln!("wrote {}", path.display());
                }
            } else {
                println!("{json}");
            }
            Ok(ExitCode::SUCCESS)
        }
        Commands::Suggest { from_scan, output } => {
            let data = std::fs::read_to_string(&from_scan).map_err(|e| e.to_string())?;
            let scan: ScanResult = serde_json::from_str(&data).map_err(|e| e.to_string())?;
            let report = suggest_from_scan(&scan);
            eprintln!(
                "suggestions: {} groups; reclaimable {}",
                report.groups.len(),
                format_bytes(report.total_reclaimable_bytes)
            );
            let json = serde_json::to_string_pretty(&report).map_err(|e| e.to_string())?;
            if let Some(path) = output {
                std::fs::write(&path, json).map_err(|e| e.to_string())?;
                eprintln!("wrote {}", path.display());
            } else {
                println!("{json}");
            }
            Ok(ExitCode::SUCCESS)
        }
        Commands::Delete {
            from_scan,
            paths,
            keep,
            mode,
            confirm,
        } => {
            let data = std::fs::read_to_string(&from_scan).map_err(|e| e.to_string())?;
            let scan: ScanResult = serde_json::from_str(&data).map_err(|e| e.to_string())?;
            let req = DeleteRequest {
                roots: scan.roots.clone(),
                records: scan.records.clone(),
                delete_paths: paths,
                keep_paths: keep,
                mode: mode.into(),
                confirm,
            };
            let backend = FsDeleteBackend;
            let (report, _audit) = safe_delete(&req, &backend);
            let deleted = report
                .outcomes
                .iter()
                .filter(|o| {
                    matches!(
                        o.kind,
                        dup_finder_engine::DeleteOutcomeKind::Deleted
                            | dup_finder_engine::DeleteOutcomeKind::WouldDelete
                    )
                })
                .count();
            let skipped = report
                .outcomes
                .iter()
                .filter(|o| matches!(o.kind, dup_finder_engine::DeleteOutcomeKind::Skipped))
                .count();
            eprintln!(
                "delete report: {} ok/would, {} skipped, refused={}",
                deleted, skipped, report.refused
            );
            println!(
                "{}",
                serde_json::to_string_pretty(&report).map_err(|e| e.to_string())?
            );
            if report.refused {
                return Ok(ExitCode::from(2));
            }
            if skipped > 0 {
                return Ok(ExitCode::from(3));
            }
            Ok(ExitCode::SUCCESS)
        }
        Commands::Serve {
            host,
            port,
            token,
            state,
        } => {
            let token = token
                .or_else(|| std::env::var("DUP_FINDER_TOKEN").ok())
                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
            let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
            rt.block_on(serve::run_server(host, port, token, state))
                .map_err(|e| e)?;
            Ok(ExitCode::SUCCESS)
        }
    }
}
