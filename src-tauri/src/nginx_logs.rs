//! Discover and read Nginx access/error log files.
//!
//! Previous log lookup was wrong for the setups that actually fail in the wild:
//! - Desktop monitoring hardcoded `/var/log/nginx/access.log` (or Homebrew's
//!   `/usr/local/var/...` path) and never consulted `nginx -V` / nginx.conf.
//! - Config parsing took the *first* `access_log` and treated `access_log off;`
//!   as fatal, so a health-check location could hide every real log file.
//! - Relative paths such as `logs/access.log` (the source-build default) were
//!   resolved against the conf directory instead of the nginx `--prefix`.
//! - Compile-time access logs were looked up as `--access-log-path`, which
//!   nginx does not emit; the real flag is `--http-log-path`.
//! - Virtual-host files such as `host.access.log` (typical for a :8080 server
//!   block) were ignored, so requests to that port never appeared in the UI.

use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct NginxInstall {
    pub prefix: Option<String>,
    pub conf_path: Option<String>,
    pub http_log_path: Option<String>,
    pub error_log_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LogDestination {
    File(String),
    Off,
    Stderr,
    Stdout,
    Syslog(String),
}

#[derive(Debug, Clone)]
pub struct LogReadResult {
    pub lines: Vec<String>,
    pub paths: Vec<String>,
}

/// Parse `nginx -V` stderr for prefix / conf / default log paths.
pub fn parse_configure_arguments(v_output: &str) -> NginxInstall {
    let mut install = NginxInstall::default();

    for raw in v_output.split_whitespace() {
        let token = raw.trim_matches(|c| c == '\'' || c == '"');
        if let Some(value) = token.strip_prefix("--prefix=") {
            install.prefix = Some(value.to_string());
        } else if let Some(value) = token.strip_prefix("--conf-path=") {
            install.conf_path = Some(value.to_string());
        } else if let Some(value) = token.strip_prefix("--http-log-path=") {
            install.http_log_path = Some(value.to_string());
        } else if let Some(value) = token.strip_prefix("--error-log-path=") {
            install.error_log_path = Some(value.to_string());
        }
    }

    install
}

fn strip_inline_comment(line: &str) -> &str {
    match line.find('#') {
        Some(idx) => &line[..idx],
        None => line,
    }
}

/// Extract log destinations from a blob of nginx config (a file or `nginx -T` dump).
pub fn extract_log_directives(config: &str, log_type: &str) -> Vec<LogDestination> {
    let directive = match log_type {
        "access" => "access_log",
        "error" => "error_log",
        _ => return Vec::new(),
    };

    let mut destinations = Vec::new();
    for raw_line in config.lines() {
        let line = strip_inline_comment(raw_line);
        destinations.extend(extract_log_directives_from_line(line, directive));
    }
    destinations
}

fn extract_log_directives_from_line(line: &str, directive: &str) -> Vec<LogDestination> {
    // Directives may share a line with braces, e.g. `location /health { access_log off; }`.
    let normalized = line.replace(['{', '}', ';'], " ");
    let tokens: Vec<&str> = normalized
        .split_whitespace()
        .map(|t| t.trim_matches(|c| c == '"' || c == '\''))
        .filter(|t| !t.is_empty())
        .collect();

    let mut destinations = Vec::new();
    let mut i = 0;
    while i < tokens.len() {
        if tokens[i] == directive {
            if let Some(target) = tokens.get(i + 1) {
                destinations.push(classify_destination(target));
            }
            i += 2;
        } else {
            i += 1;
        }
    }
    destinations
}

pub fn classify_destination(target: &str) -> LogDestination {
    match target {
        "off" => LogDestination::Off,
        "stderr" | "/dev/stderr" => LogDestination::Stderr,
        "stdout" | "/dev/stdout" => LogDestination::Stdout,
        other if other == "syslog" || other.starts_with("syslog:") => {
            LogDestination::Syslog(other.to_string())
        }
        other => LogDestination::File(other.to_string()),
    }
}

/// Nginx resolves relative log paths against `--prefix`, not the conf directory.
pub fn resolve_log_file_path(raw: &str, install: &NginxInstall, conf_path: Option<&str>) -> String {
    let path = Path::new(raw);
    if path.is_absolute() {
        return raw.to_string();
    }

    if let Some(prefix) = install.prefix.as_deref() {
        return Path::new(prefix).join(raw).to_string_lossy().to_string();
    }

    if let Some(conf) = conf_path.or(install.conf_path.as_deref()) {
        if let Some(parent) = Path::new(conf).parent() {
            // Source builds often use prefix = parent of conf dir (`.../nginx/conf`).
            if let Some(prefix_guess) = parent.parent() {
                let candidate = prefix_guess.join(raw);
                if candidate.exists() {
                    return candidate.to_string_lossy().to_string();
                }
            }
            return parent.join(raw).to_string_lossy().to_string();
        }
    }

    raw.to_string()
}

#[cfg(test)]
fn is_usable_file_destination(dest: &LogDestination) -> Option<&str> {
    match dest {
        LogDestination::File(path) => {
            if path.contains('$') {
                None
            } else {
                Some(path.as_str())
            }
        }
        _ => None,
    }
}

fn expand_dollar_path(raw: &str, install: &NginxInstall, conf_path: Option<&str>) -> Vec<String> {
    if !raw.contains('$') {
        return Vec::new();
    }
    let globbed: String = raw
        .split('$')
        .enumerate()
        .map(|(i, chunk)| {
            if i == 0 {
                chunk.to_string()
            } else {
                let name_end = chunk
                    .find(|c: char| !c.is_ascii_alphanumeric() && c != '_')
                    .unwrap_or(chunk.len());
                format!("*{}", &chunk[name_end..])
            }
        })
        .collect();
    let resolved = resolve_log_file_path(&globbed, install, conf_path);
    expand_include_pattern(&resolved)
        .into_iter()
        .filter(|p| p.is_file())
        .map(|p| p.to_string_lossy().to_string())
        .collect()
}

fn wildcard_match(name: &str, pattern: &str) -> bool {
    if let Some((prefix, suffix)) = pattern.split_once('*') {
        name.starts_with(prefix)
            && name.ends_with(suffix)
            && name.len() >= prefix.len() + suffix.len()
    } else {
        name == pattern
    }
}

/// Expand an nginx `include` glob (`sites-enabled/*`, `conf.d/*.conf`).
pub fn expand_include_pattern(pattern: &str) -> Vec<PathBuf> {
    let path = Path::new(pattern);
    if !pattern.contains('*') {
        if path.is_file() {
            return vec![path.to_path_buf()];
        }
        return Vec::new();
    }

    let dir = path.parent().unwrap_or(Path::new("."));
    let file_pat = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "*".to_string());

    let mut matches = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if wildcard_match(&name, &file_pat) && entry.path().is_file() {
                matches.push(entry.path());
            }
        }
    }
    matches.sort();
    matches
}

fn collect_include_patterns(config: &str, conf_path: &str) -> Vec<String> {
    let base_dir = Path::new(conf_path)
        .parent()
        .unwrap_or(Path::new("/etc/nginx"));
    let mut patterns = Vec::new();

    for raw_line in config.lines() {
        let line = strip_inline_comment(raw_line)
            .trim()
            .trim_end_matches(';')
            .trim();
        let mut parts = line.split_whitespace();
        if parts.next() != Some("include") {
            continue;
        }
        let Some(pattern) = parts.next() else {
            continue;
        };
        let pattern = pattern.trim_matches(|c| c == '"' || c == '\'');
        let full = if Path::new(pattern).is_absolute() {
            pattern.to_string()
        } else {
            base_dir.join(pattern).to_string_lossy().to_string()
        };
        patterns.push(full);
    }
    patterns
}

fn collect_from_config_file(
    conf_path: &str,
    install: &NginxInstall,
    log_type: &str,
    files: &mut Vec<String>,
    special: &mut Vec<LogDestination>,
    visited: &mut HashSet<String>,
) {
    if !visited.insert(conf_path.to_string()) {
        return;
    }
    let Ok(content) = fs::read_to_string(conf_path) else {
        return;
    };

    for dest in extract_log_directives(&content, log_type) {
        match &dest {
            LogDestination::File(raw) => {
                if raw.contains('$') {
                    files.extend(expand_dollar_path(raw, install, Some(conf_path)));
                } else {
                    files.push(resolve_log_file_path(raw, install, Some(conf_path)));
                }
            }
            other => special.push(other.clone()),
        }
    }

    for pattern in collect_include_patterns(&content, conf_path) {
        for included in expand_include_pattern(&pattern) {
            collect_from_config_file(
                &included.to_string_lossy(),
                install,
                log_type,
                files,
                special,
                visited,
            );
        }
    }
}

fn common_log_dirs(install: &NginxInstall) -> Vec<PathBuf> {
    let mut dirs = vec![
        PathBuf::from("/var/log/nginx"),
        PathBuf::from("/usr/local/nginx/logs"),
        PathBuf::from("/usr/local/var/log/nginx"),
        PathBuf::from("/opt/homebrew/var/log/nginx"),
        PathBuf::from("/opt/nginx/logs"),
        PathBuf::from("/var/log/nginx-access"),
    ];
    if let Some(prefix) = install.prefix.as_deref() {
        dirs.push(Path::new(prefix).join("logs"));
        dirs.push(Path::new(prefix).join("var/log/nginx"));
    }
    dirs.sort();
    dirs.dedup();
    dirs
}

pub fn is_rotated_log_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".gz")
        || lower.ends_with(".bz2")
        || lower.ends_with(".xz")
        || lower.ends_with(".zip")
        || lower.ends_with(".old")
        || lower.contains(".log.")
}

fn looks_like_log_filename(name: &str, log_type: &str) -> bool {
    if is_rotated_log_name(name) {
        return false;
    }
    let lower = name.to_ascii_lowercase();
    if !lower.contains(".log") && lower != "access" && lower != "error" {
        return false;
    }
    match log_type {
        "access" => lower.contains("access"),
        "error" => lower.contains("error"),
        _ => false,
    }
}

fn scan_log_directories(install: &NginxInstall, log_type: &str) -> Vec<String> {
    let mut found = Vec::new();
    for dir in common_log_dirs(install) {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if looks_like_log_filename(&name, log_type) && entry.path().is_file() {
                found.push(entry.path().to_string_lossy().to_string());
            }
        }
    }
    found
}

fn compile_time_log_path(install: &NginxInstall, log_type: &str) -> Option<String> {
    let raw = match log_type {
        "access" => install.http_log_path.as_deref()?,
        "error" => install.error_log_path.as_deref()?,
        _ => return None,
    };
    match classify_destination(raw) {
        LogDestination::File(path) => Some(path),
        _ => None,
    }
}

fn dedupe_paths(paths: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for path in paths {
        let key = fs::canonicalize(&path)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| path.clone());
        if seen.insert(key) {
            out.push(path);
        }
    }
    out
}

fn nginx_v_output() -> Option<String> {
    let output = Command::new("nginx").arg("-V").output().ok()?;
    let mut text = String::from_utf8_lossy(&output.stderr).to_string();
    text.push_str(&String::from_utf8_lossy(&output.stdout));
    if text.trim().is_empty() {
        None
    } else {
        Some(text)
    }
}

fn nginx_t_dump() -> Option<String> {
    let output = Command::new("nginx").arg("-T").output().ok()?;
    let mut text = String::from_utf8_lossy(&output.stdout).to_string();
    text.push('\n');
    text.push_str(&String::from_utf8_lossy(&output.stderr));
    if text.trim().is_empty() {
        None
    } else {
        Some(text)
    }
}

fn nginx_conf_from_test() -> Option<String> {
    let output = Command::new("sh")
        .arg("-c")
        .arg("nginx -t 2>&1 | grep -Eo '(/[^ :]+\\.conf)' | head -n 1")
        .output()
        .ok()?;
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() {
        None
    } else {
        Some(path)
    }
}

fn fallback_conf_paths() -> Vec<&'static str> {
    vec![
        "/etc/nginx/nginx.conf",
        "/usr/local/nginx/conf/nginx.conf",
        "/usr/local/etc/nginx/nginx.conf",
        "/opt/homebrew/etc/nginx/nginx.conf",
        "/opt/nginx/nginx.conf",
        "/opt/nginx/conf/nginx.conf",
    ]
}

/// Discover every access or error log file nginx is likely writing to.
pub fn discover_log_files(log_type: &str) -> Result<Vec<String>, String> {
    if log_type != "access" && log_type != "error" {
        return Err("Invalid log type".to_string());
    }

    let install = nginx_v_output()
        .map(|text| parse_configure_arguments(&text))
        .unwrap_or_default();

    let mut files = Vec::new();
    let mut special = Vec::new();

    if let Some(dump) = nginx_t_dump() {
        for dest in extract_log_directives(&dump, log_type) {
            match &dest {
                LogDestination::File(raw) => {
                    if raw.contains('$') {
                        files.extend(expand_dollar_path(raw, &install, install.conf_path.as_deref()));
                    } else {
                        files.push(resolve_log_file_path(raw, &install, install.conf_path.as_deref()));
                    }
                }
                other => special.push(other.clone()),
            }
        }
    }

    let conf_path = install
        .conf_path
        .clone()
        .or_else(nginx_conf_from_test)
        .or_else(|| {
            fallback_conf_paths()
                .into_iter()
                .find(|p| Path::new(p).exists())
                .map(|p| p.to_string())
        });

    if let Some(conf) = conf_path.as_deref() {
        let mut visited = HashSet::new();
        collect_from_config_file(
            conf,
            &install,
            log_type,
            &mut files,
            &mut special,
            &mut visited,
        );
    }

    if let Some(compile_time) = compile_time_log_path(&install, log_type) {
        files.push(compile_time);
    }

    files.extend(scan_log_directories(&install, log_type));
    let files = dedupe_paths(files);

    let existing: Vec<String> = files
        .iter()
        .filter(|p| Path::new(p).is_file())
        .cloned()
        .collect();

    if !existing.is_empty() {
        return Ok(existing);
    }

    // Nothing on disk. Explain the most likely reason.
    if files.is_empty() {
        if special.iter().any(|d| matches!(d, LogDestination::Stderr)) {
            return Err(format!(
                "Nginx {} logging goes to stderr, not a file. Check 'journalctl -u nginx' or your process manager logs.",
                log_type
            ));
        }
        if special.iter().any(|d| matches!(d, LogDestination::Stdout)) {
            return Err(format!(
                "Nginx {} logging goes to stdout, not a file. Check 'journalctl -u nginx' or your process manager logs.",
                log_type
            ));
        }
        if special.iter().any(|d| matches!(d, LogDestination::Syslog(_))) {
            return Err(format!(
                "Nginx {} logging goes to syslog. Check 'journalctl -u nginx' or your system log viewer.",
                log_type
            ));
        }
        if special.iter().all(|d| matches!(d, LogDestination::Off)) && !special.is_empty() {
            return Err(format!(
                "Nginx {} logging is disabled (access_log/error_log off).",
                log_type
            ));
        }
    }

    let tried = if files.is_empty() {
        common_log_dirs(&install)
            .into_iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join(", ")
    } else {
        files.join(", ")
    };

    Err(format!(
        "Could not find an nginx {} log file. Looked at: {}. If logs live under a custom prefix (for example /usr/local/nginx/logs), confirm nginx is on PATH so rustinx can read 'nginx -V'.",
        log_type, tried
    ))
}

fn tail_file(path: &str, lines: usize) -> Result<Vec<String>, String> {
    if !Path::new(path).is_file() {
        return Ok(Vec::new());
    }

    let run_tail = |use_sudo: bool| -> Result<std::process::Output, String> {
        let mut cmd = if use_sudo {
            let mut c = Command::new("sudo");
            c.arg("-n").arg("tail");
            c
        } else {
            Command::new("tail")
        };
        cmd.arg("-n").arg(lines.to_string()).arg(path);
        cmd.output()
            .map_err(|e| format!("Failed to execute tail on {}: {}", path, e))
    };

    let output = match run_tail(false) {
        Ok(output) if output.status.success() => output,
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).to_ascii_lowercase();
            if stderr.contains("permission denied") {
                run_tail(true)?
            } else {
                return Err(format!(
                    "tail command failed for {}: {}",
                    path,
                    String::from_utf8_lossy(&output.stderr)
                ));
            }
        }
        Err(e) => return Err(e),
    };

    if !output.status.success() {
        return Err(format!(
            "Failed to read {}: {}",
            path,
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| line.to_string())
        .collect())
}

/// Tail discovered nginx log files. When several files exist (http-level
/// `access.log` plus a vhost `host.access.log` for :8080), lines from each
/// are included so requests are not silently dropped.
pub fn read_logs(log_type: &str, lines: usize) -> Result<LogReadResult, String> {
    let paths = discover_log_files(log_type)?;
    read_logs_from_paths(&paths, lines)
}

pub fn read_logs_from_paths(paths: &[String], lines: usize) -> Result<LogReadResult, String> {
    let mut all_lines = Vec::new();
    let mut errors = Vec::new();

    for path in paths {
        match tail_file(path, lines) {
            Ok(mut file_lines) => all_lines.append(&mut file_lines),
            Err(e) => errors.push(e),
        }
    }

    if all_lines.is_empty() && !errors.is_empty() {
        return Err(errors.join("; "));
    }

    Ok(LogReadResult {
        lines: all_lines,
        paths: paths.to_vec(),
    })
}

/// Follow a log file, emitting already-written trailing lines first.
pub fn follow_log_file<F>(path: &str, mut on_line: F) -> std::io::Result<()>
where
    F: FnMut(&str),
{
    if let Ok(existing) = tail_file(path, 100) {
        for line in existing {
            on_line(&line);
        }
    }

    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    // Skip content we already tailed by jumping to EOF; new lines arrive after.
    let _ = reader.seek(SeekFrom::End(0));

    let mut line = String::new();
    loop {
        match reader.read_line(&mut line) {
            Ok(0) => {
                std::thread::sleep(std::time::Duration::from_millis(500));
                // Handle truncation / logrotate.
                if let Ok(meta) = fs::metadata(path) {
                    if let Ok(pos) = reader.stream_position() {
                        if pos > meta.len() {
                            let _ = reader.seek(SeekFrom::Start(0));
                        }
                    }
                }
            }
            Ok(_) => {
                let trimmed = line.trim_end_matches(['\n', '\r']);
                if !trimmed.is_empty() {
                    on_line(trimmed);
                }
                line.clear();
            }
            Err(e) => return Err(e),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_SEQ: AtomicU64 = AtomicU64::new(0);

    fn test_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "rustinx-nginx-logs-{}-{}",
            std::process::id(),
            TEST_SEQ.fetch_add(1, Ordering::SeqCst)
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn parses_http_log_path_not_access_log_path() {
        let v = "configure arguments: --prefix=/usr/local/nginx \
                 --conf-path=/usr/local/nginx/conf/nginx.conf \
                 --error-log-path=/usr/local/nginx/logs/error.log \
                 --http-log-path=/usr/local/nginx/logs/access.log";
        let install = parse_configure_arguments(v);
        assert_eq!(install.prefix.as_deref(), Some("/usr/local/nginx"));
        assert_eq!(
            install.conf_path.as_deref(),
            Some("/usr/local/nginx/conf/nginx.conf")
        );
        assert_eq!(
            install.http_log_path.as_deref(),
            Some("/usr/local/nginx/logs/access.log")
        );
        assert_eq!(
            install.error_log_path.as_deref(),
            Some("/usr/local/nginx/logs/error.log")
        );
    }

    #[test]
    fn relative_log_path_uses_prefix_not_conf_dir() {
        let install = NginxInstall {
            prefix: Some("/usr/local/nginx".into()),
            conf_path: Some("/usr/local/nginx/conf/nginx.conf".into()),
            ..Default::default()
        };
        let resolved = resolve_log_file_path("logs/access.log", &install, install.conf_path.as_deref());
        assert_eq!(resolved, "/usr/local/nginx/logs/access.log");
    }

    #[test]
    fn skips_off_and_keeps_vhost_file() {
        let config = r#"
            http {
                access_log /var/log/nginx/access.log;
                server {
                    listen 8080;
                    location /health { access_log off; }
                    access_log /usr/local/nginx/logs/host.access.log;
                }
            }
        "#;
        let dests = extract_log_directives(config, "access");
        assert_eq!(
            dests,
            vec![
                LogDestination::File("/var/log/nginx/access.log".into()),
                LogDestination::Off,
                LogDestination::File("/usr/local/nginx/logs/host.access.log".into()),
            ]
        );
        let files: Vec<_> = dests
            .iter()
            .filter_map(is_usable_file_destination)
            .collect();
        assert!(files.contains(&"/usr/local/nginx/logs/host.access.log"));
        assert!(!files.is_empty());
    }

    #[test]
    fn classifies_special_destinations() {
        assert_eq!(classify_destination("off"), LogDestination::Off);
        assert_eq!(classify_destination("stderr"), LogDestination::Stderr);
        assert_eq!(classify_destination("/dev/stdout"), LogDestination::Stdout);
        assert!(matches!(
            classify_destination("syslog:server=unix:/dev/log"),
            LogDestination::Syslog(_)
        ));
    }

    #[test]
    fn include_glob_matches_conf_files() {
        let dir = test_dir();
        let conf_d = dir.join("conf.d");
        fs::create_dir_all(&conf_d).unwrap();
        fs::write(conf_d.join("site.conf"), "server { access_log /tmp/host.access.log; }\n").unwrap();
        fs::write(conf_d.join("ignore.txt"), "nope\n").unwrap();

        let pattern = conf_d.join("*.conf").to_string_lossy().to_string();
        let matches = expand_include_pattern(&pattern);
        assert_eq!(matches.len(), 1);
        assert!(matches[0].ends_with("site.conf"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn walks_includes_and_collects_vhost_logs() {
        let dir = test_dir();
        let conf = dir.join("nginx.conf");
        let sites = dir.join("sites-enabled");
        fs::create_dir_all(&sites).unwrap();
        fs::write(
            &conf,
            format!(
                "http {{\n    access_log logs/access.log;\n    include {};\n}}\n",
                sites.join("*").to_string_lossy()
            ),
        )
        .unwrap();
        fs::write(
            sites.join("app.conf"),
            "server {\n    listen 8080;\n    access_log logs/host.access.log;\n}\n",
        )
        .unwrap();

        let install = NginxInstall {
            prefix: Some(dir.to_string_lossy().to_string()),
            conf_path: Some(conf.to_string_lossy().to_string()),
            ..Default::default()
        };
        let mut files = Vec::new();
        let mut special = Vec::new();
        let mut visited = HashSet::new();
        collect_from_config_file(
            &conf.to_string_lossy(),
            &install,
            "access",
            &mut files,
            &mut special,
            &mut visited,
        );

        let expected_default = dir.join("logs/access.log").to_string_lossy().to_string();
        let expected_vhost = dir.join("logs/host.access.log").to_string_lossy().to_string();
        assert!(files.contains(&expected_default), "got {:?}", files);
        assert!(files.contains(&expected_vhost), "got {:?}", files);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rotated_logs_are_ignored() {
        assert!(is_rotated_log_name("access.log.1"));
        assert!(is_rotated_log_name("access.log.gz"));
        assert!(!is_rotated_log_name("access.log"));
        assert!(!is_rotated_log_name("host.access.log"));
        assert!(looks_like_log_filename("host.access.log", "access"));
        assert!(!looks_like_log_filename("error.log", "access"));
        assert!(looks_like_log_filename("error.log", "error"));
    }

    #[test]
    fn compile_time_stdout_is_not_a_file() {
        let install = parse_configure_arguments(
            "configure arguments: --http-log-path=/dev/stdout --error-log-path=stderr",
        );
        assert!(compile_time_log_path(&install, "access").is_none());
        assert!(compile_time_log_path(&install, "error").is_none());
    }

    #[test]
    fn tails_existing_file() {
        let dir = test_dir();
        let log = dir.join("access.log");
        let mut f = fs::File::create(&log).unwrap();
        writeln!(f, "one").unwrap();
        writeln!(f, "two").unwrap();
        writeln!(f, "three").unwrap();

        let result = read_logs_from_paths(&[log.to_string_lossy().to_string()], 2).unwrap();
        assert_eq!(result.lines, vec!["two".to_string(), "three".to_string()]);

        let _ = fs::remove_dir_all(&dir);
    }
}
