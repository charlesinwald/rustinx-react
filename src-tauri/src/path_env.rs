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

pub fn resolve_command_on_path(name: &str, path: &str) -> Option<std::path::PathBuf> {
    path.split(':').find_map(|dir| {
        if dir.is_empty() {
            return None;
        }
        let candidate = std::path::Path::new(dir).join(name);
        candidate.is_file().then_some(candidate)
    })
}

pub fn resolve_command(name: &str) -> Option<std::path::PathBuf> {
    let current = std::env::var("PATH").unwrap_or_default();
    let augmented = augment_path(&current, &extra_unix_bin_dirs());
    resolve_command_on_path(name, &augmented)
}

pub fn brew_service_requires_root_sudo(stderr: &str) -> bool {
    let lower = stderr.to_lowercase();
    lower.contains("started as `root`")
        || lower.contains("started as 'root'")
        || lower.contains("try: sudo brew services")
}

/// `brew services start` tries `launchctl bootstrap` even when the LaunchAgent is
/// already loaded (loaded-but-dead after nginx exited). That fails with error 5.
pub fn brew_service_already_loaded(output: &str) -> bool {
    let lower = output.to_lowercase();
    lower.contains("bootstrap failed")
        || (lower.contains("launchctl bootstrap") && lower.contains("exited with 5"))
}

pub fn macos_brew_action_is_complete(action: &str, command_ok: bool, nginx_running: bool) -> bool {
    if !command_ok {
        return false;
    }
    match action {
        "start" | "restart" => nginx_running,
        _ => true,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BrewFollowup {
    Done,
    RetryRestart,
    Elevate,
    PromptAdmin,
    Failed,
}

/// Decide the next Homebrew nginx service step after a user-level `brew services` attempt.
pub fn macos_brew_followup(
    action: &str,
    command_ok: bool,
    nginx_running: bool,
    can_elevate: bool,
    output: &str,
) -> BrewFollowup {
    if macos_brew_action_is_complete(action, command_ok, nginx_running) {
        return BrewFollowup::Done;
    }

    if action == "start" && brew_service_already_loaded(output) {
        return BrewFollowup::RetryRestart;
    }

    if can_elevate {
        return BrewFollowup::Elevate;
    }

    if brew_service_requires_root_sudo(output) || brew_service_already_loaded(output) {
        return BrewFollowup::PromptAdmin;
    }

    BrewFollowup::Failed
}

/// Quote a path/argument for `/bin/sh` as used by `osascript` `do shell script`.
pub fn shell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

pub fn macos_brew_services_command(brew_path: &str, action: &str) -> String {
    format!(
        "{} services {} nginx",
        shell_single_quote(brew_path),
        action
    )
}

/// AppleScript that shows the standard macOS administrator password dialog.
pub fn macos_admin_shell_script(command: &str) -> String {
    let escaped = command.replace('\\', "\\\\").replace('"', "\\\"");
    format!("do shell script \"{escaped}\" with administrator privileges")
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

    #[test]
    fn detects_root_owned_brew_service_error() {
        let stderr =
            "Error: Service `nginx` is started as `root`. Try: sudo brew services stop nginx\n";
        assert!(brew_service_requires_root_sudo(stderr));
        assert!(!brew_service_requires_root_sudo(
            "Error: Formula nginx is not installed."
        ));
    }

    #[test]
    fn detects_launchctl_bootstrap_error_when_agent_already_loaded() {
        let stderr = "Bootstrap failed: 5: Input/output error\n\
             Try re-running the command as root for richer errors.\n\
             Error: Failure while executing; `/bin/launchctl bootstrap gui/501 \
             /Users/charles/Library/LaunchAgents/homebrew.mxcl.nginx.plist` exited with 5.\n";
        assert!(brew_service_already_loaded(stderr));
        assert!(!brew_service_already_loaded(
            "Error: Formula nginx is not installed."
        ));
        assert!(!brew_service_requires_root_sudo(stderr));
    }

    #[test]
    fn start_is_incomplete_when_brew_succeeds_but_nginx_is_not_running() {
        assert!(macos_brew_action_is_complete("start", true, true));
        assert!(!macos_brew_action_is_complete("start", true, false));
        assert!(!macos_brew_action_is_complete("start", false, false));
        assert!(macos_brew_action_is_complete("restart", true, true));
        assert!(!macos_brew_action_is_complete("restart", true, false));
        assert!(macos_brew_action_is_complete("stop", true, false));
        assert!(!macos_brew_action_is_complete("stop", false, true));
    }

    #[test]
    fn brew_service_should_retry_restart_then_elevate_for_bootstrap_5() {
        assert_eq!(
            macos_brew_followup("start", false, false, true, "Bootstrap failed: 5: Input/output error"),
            BrewFollowup::RetryRestart
        );
        assert_eq!(
            macos_brew_followup("start", true, false, true, ""),
            BrewFollowup::Elevate
        );
        assert_eq!(
            macos_brew_followup("start", true, true, true, ""),
            BrewFollowup::Done
        );
        assert_eq!(
            macos_brew_followup("stop", false, false, true, "started as `root`"),
            BrewFollowup::Elevate
        );
        assert_eq!(
            macos_brew_followup("stop", false, false, false, "started as `root`"),
            BrewFollowup::PromptAdmin
        );
        assert_eq!(
            macos_brew_followup(
                "start",
                false,
                false,
                false,
                "Error: Formula nginx is not installed."
            ),
            BrewFollowup::Failed
        );
    }

    #[test]
    fn cookie_session_is_not_authenticated_without_stored_sudo_password() {
        assert!(!crate::auth::is_authenticated_session(true, false));
        assert!(crate::auth::is_authenticated_session(true, true));
        assert!(!crate::auth::is_authenticated_session(false, true));
    }

    #[test]
    fn macos_admin_script_prompts_with_quoted_brew_path() {
        let command = macos_brew_services_command("/opt/homebrew/bin/brew", "stop");
        assert_eq!(command, "'/opt/homebrew/bin/brew' services stop nginx");

        let script = macos_admin_shell_script(&command);
        assert!(script.contains("with administrator privileges"));
        assert!(script.contains("do shell script"));
        assert!(script.contains("/opt/homebrew/bin/brew"));
    }
}
