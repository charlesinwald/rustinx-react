use std::fs::File;
use std::path::Path;
use std::process::Command;

pub fn log_file_readable(path: &str) -> bool {
    File::open(path).is_ok()
}

pub fn extract_configure_arg(configure: &str, flag: &str) -> Option<String> {
    let needle = format!("{}=", flag);
    let start = configure.find(&needle)? + needle.len();
    let rest = &configure[start..];
    let end = rest.find(char::is_whitespace).unwrap_or(rest.len());
    let value = rest[..end].trim_matches(|c| c == '\'' || c == '"');

    match value {
        "" | "stderr" | "stdout" | "off" | "/dev/stderr" | "/dev/stdout" => None,
        path if path.starts_with('/') => Some(path.to_string()),
        _ => None,
    }
}

pub fn nginx_build_info() -> Option<String> {
    let output = Command::new("nginx").arg("-V").output().ok()?;
    let mut info = String::from_utf8_lossy(&output.stderr).into_owned();
    info.push_str(&String::from_utf8_lossy(&output.stdout));
    Some(info)
}

pub fn nginx_compile_arg(flag: &str) -> Option<String> {
    extract_configure_arg(&nginx_build_info()?, flag)
}

pub fn first_readable_path(candidates: impl IntoIterator<Item = String>) -> Option<String> {
    candidates.into_iter().find(|path| log_file_readable(path))
}

pub fn nginx_conf_file_candidates() -> Vec<String> {
    let mut paths = Vec::new();
    if let Some(compiled) = nginx_compile_arg("--conf-path") {
        paths.push(compiled);
    }

    let mut prefixes = vec![
        "/opt/homebrew".to_string(),
        "/usr/local".to_string(),
        "/opt/local".to_string(),
    ];
    if let Ok(homebrew_prefix) = std::env::var("HOMEBREW_PREFIX") {
        if !prefixes.iter().any(|prefix| prefix == &homebrew_prefix) {
            prefixes.insert(0, homebrew_prefix);
        }
    }

    for prefix in &prefixes {
        paths.push(format!("{}/etc/nginx/nginx.conf", prefix));
    }

    paths.extend([
        "/etc/nginx/nginx.conf".to_string(),
        "/opt/nginx/nginx.conf".to_string(),
        "/usr/local/nginx/conf/nginx.conf".to_string(),
    ]);

    let mut seen = std::collections::HashSet::new();
    paths.retain(|path| seen.insert(path.clone()));
    paths
}

pub fn logs_adjacent_to_conf(config_path: &str, filename: &str) -> Vec<String> {
    let mut paths = Vec::new();
    let conf = Path::new(config_path);
    if let Some(conf_dir) = conf.parent() {
        paths.push(conf_dir.join(filename).to_string_lossy().to_string());
        if let Some(prefix) = conf_dir.parent() {
            paths.push(
                prefix
                    .join("logs")
                    .join(filename)
                    .to_string_lossy()
                    .to_string(),
            );
        }
    }
    paths
}

pub fn nginx_log_file_candidates(log_type: &str) -> Vec<String> {
    let filename = match log_type {
        "access" => "access.log",
        _ => "error.log",
    };
    let compile_flag = match log_type {
        "access" => "--http-log-path",
        _ => "--error-log-path",
    };

    let mut paths = Vec::new();
    if let Some(compiled) = nginx_compile_arg(compile_flag) {
        paths.push(compiled);
    }

    let mut prefixes = vec![
        "/opt/homebrew".to_string(),
        "/usr/local".to_string(),
        "/opt/local".to_string(),
    ];
    if let Ok(homebrew_prefix) = std::env::var("HOMEBREW_PREFIX") {
        if !prefixes.iter().any(|prefix| prefix == &homebrew_prefix) {
            prefixes.insert(0, homebrew_prefix);
        }
    }

    for prefix in &prefixes {
        paths.push(format!("{}/var/log/nginx/{}", prefix, filename));
        paths.push(format!("{}/opt/nginx/logs/{}", prefix, filename));
        paths.push(format!("{}/nginx/logs/{}", prefix, filename));
    }

    for conf in nginx_conf_file_candidates() {
        if Path::new(&conf).exists() {
            paths.extend(logs_adjacent_to_conf(&conf, filename));
        }
    }

    paths.extend([
        format!("/usr/local/nginx/logs/{}", filename),
        format!("/opt/nginx/logs/{}", filename),
        format!("/var/log/nginx/{}", filename),
    ]);

    let mut seen = std::collections::HashSet::new();
    paths.retain(|path| seen.insert(path.clone()));
    paths
}

pub fn find_readable_nginx_log(log_type: &str) -> Option<String> {
    first_readable_path(nginx_log_file_candidates(log_type))
}

pub fn is_log_policy_error(message: &str) -> bool {
    let lower = message.to_lowercase();
    lower.contains("stderr")
        || lower.contains("stdout")
        || lower.contains("disabled")
        || lower.contains("syslog")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_homebrew_log_paths_from_nginx_v() {
        let configure = "configure arguments: --prefix=/opt/homebrew/Cellar/nginx/1.25.3 --error-log-path=/opt/homebrew/var/log/nginx/error.log --http-log-path=/opt/homebrew/var/log/nginx/access.log --conf-path=/opt/homebrew/etc/nginx/nginx.conf --with-http_ssl_module";

        assert_eq!(
            extract_configure_arg(configure, "--http-log-path").as_deref(),
            Some("/opt/homebrew/var/log/nginx/access.log")
        );
        assert_eq!(
            extract_configure_arg(configure, "--error-log-path").as_deref(),
            Some("/opt/homebrew/var/log/nginx/error.log")
        );
        assert_eq!(
            extract_configure_arg(configure, "--conf-path").as_deref(),
            Some("/opt/homebrew/etc/nginx/nginx.conf")
        );
    }

    #[test]
    fn ignores_stderr_and_stdout_compile_log_paths() {
        let configure = "configure arguments: --error-log-path=stderr --http-log-path=/dev/stdout";

        assert_eq!(extract_configure_arg(configure, "--error-log-path"), None);
        assert_eq!(extract_configure_arg(configure, "--http-log-path"), None);
    }

    #[test]
    fn source_install_conf_implies_prefix_logs() {
        let paths = logs_adjacent_to_conf("/usr/local/nginx/conf/nginx.conf", "access.log");
        assert!(paths.iter().any(|path| path == "/usr/local/nginx/logs/access.log"));
    }

    #[test]
    fn candidates_include_homebrew_macports_and_compile_defaults() {
        let access = nginx_log_file_candidates("access");

        for path in [
            "/opt/homebrew/var/log/nginx/access.log",
            "/usr/local/var/log/nginx/access.log",
            "/opt/local/var/log/nginx/access.log",
            "/opt/homebrew/opt/nginx/logs/access.log",
            "/usr/local/nginx/logs/access.log",
            "/var/log/nginx/access.log",
        ] {
            assert!(
                access.iter().any(|candidate| candidate == path),
                "missing {path}"
            );
        }
    }
}
