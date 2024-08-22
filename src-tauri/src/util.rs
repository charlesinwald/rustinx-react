#[cfg(unix)]
use nix::libc::geteuid;
use tauri::command;

#[command]
pub(crate) fn check_sudo_status() -> Result<bool, String> {
    #[cfg(unix)]
    {
        // Check if the current user is root on Unix-like systems
        if unsafe { geteuid() } == 0 {
            return Ok(true);
        } else {
            return Ok(false);
        }
    }

    #[cfg(windows)]
    {
        // On Windows, check for admin rights (you can expand this as needed)
        // For now, we'll return false as a placeholder
        return Ok(false);
    }
}
