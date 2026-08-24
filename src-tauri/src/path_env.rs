/// Bin directories GUI-launched macOS apps typically lack, because they do not
/// inherit the user's shell PATH (Homebrew, MacPorts, Intel Homebrew).
pub fn extra_unix_bin_dirs_with_homebrew_prefix(homebrew_prefix: Option<String>) -> Vec<String> {
    let mut dirs = Vec::new();
    if let Some(prefix) = homebrew_prefix {
        let prefix = prefix.trim_end_matches('/');
        if !prefix.is_empty() {
            dirs.push(format!("{prefix}/bin"));
            dirs.push(format!("{prefix}/sbin"));
        }
    }
    for dir in [
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
        "/usr/local/bin",
        "/usr/local/sbin",
        "/opt/local/bin",
        "/opt/local/sbin",
    ] {
        if !dirs.iter().any(|existing| existing == dir) {
            dirs.push(dir.to_string());
        }
    }
    dirs
}

pub fn extra_unix_bin_dirs() -> Vec<String> {
    extra_unix_bin_dirs_with_homebrew_prefix(std::env::var("HOMEBREW_PREFIX").ok())
}

/// Prepend missing extra directories to PATH without duplicating existing entries.
pub fn augment_path(current: &str, extra_dirs: &[String]) -> String {
    let existing: Vec<&str> = if current.is_empty() {
        Vec::new()
    } else {
        current.split(':').collect()
    };
    let mut parts: Vec<&str> = extra_dirs
        .iter()
        .map(String::as_str)
        .filter(|dir| !existing.contains(dir))
        .collect();
    if !current.is_empty() {
        parts.push(current);
    }
    parts.join(":")
}

pub fn ensure_unix_command_path() {
    let current = std::env::var("PATH").unwrap_or_default();
    let extra = extra_unix_bin_dirs();
    std::env::set_var("PATH", augment_path(&current, &extra));
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    fn command_on_path(name: &str, path: &str) -> Option<std::path::PathBuf> {
        path.split(':').find_map(|dir| {
            if dir.is_empty() {
                return None;
            }
            let candidate = Path::new(dir).join(name);
            candidate.is_file().then_some(candidate)
        })
    }

    #[test]
    fn prepends_homebrew_dirs_to_minimal_gui_path() {
        let gui_path = "/usr/bin:/bin:/usr/sbin:/sbin";
        let extra = extra_unix_bin_dirs_with_homebrew_prefix(None);
        let result = augment_path(gui_path, &extra);

        assert!(
            result.starts_with("/opt/homebrew/bin:"),
            "expected Homebrew bin first, got {result}"
        );
        assert!(result.contains("/usr/bin:/bin:/usr/sbin:/sbin"));
        assert!(result.contains("/usr/local/bin"));
        assert!(result.contains("/opt/local/bin"));
    }

    #[test]
    fn does_not_duplicate_dirs_already_on_path() {
        let current = "/opt/homebrew/bin:/usr/bin";
        let extra = extra_unix_bin_dirs_with_homebrew_prefix(None);
        let result = augment_path(current, &extra);

        assert_eq!(
            result.matches("/opt/homebrew/bin").count(),
            1,
            "Homebrew bin should appear once: {result}"
        );
        assert!(result.contains("/usr/bin"));
    }

    #[test]
    fn prepends_custom_homebrew_prefix_bin() {
        let extra = extra_unix_bin_dirs_with_homebrew_prefix(Some("/custom/brew".to_string()));
        assert_eq!(extra[0], "/custom/brew/bin");
        assert!(extra.contains(&"/opt/homebrew/bin".to_string()));
    }

    #[test]
    fn brew_is_not_on_gui_path_but_is_after_augment() {
        let brew = Path::new("/opt/homebrew/bin/brew");
        if !brew.is_file() {
            return;
        }

        let gui_path = "/usr/bin:/bin:/usr/sbin:/sbin";
        assert!(
            command_on_path("brew", gui_path).is_none(),
            "brew must be missing on the Spotlight/GUI PATH — that is the bug"
        );

        let augmented = augment_path(gui_path, &extra_unix_bin_dirs_with_homebrew_prefix(None));
        assert_eq!(
            command_on_path("brew", &augmented).as_deref(),
            Some(brew)
        );
    }
}
