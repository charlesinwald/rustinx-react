#[cfg(unix)]
use nix::libc::geteuid;
// #[cfg(windows)]
// use std::os::windows::fs::MetadataExt;

use std::process;
use tauri::Window;

pub(crate) async fn check_sudo(window: &Window) {
    #[cfg(unix)]
    {
        // Check if the current user is root on Unix-like systems
        if unsafe { geteuid() } == 0 {
            println!("Running with root privileges.");
        } else {
            eprintln!("This program needs to be run as root. Please use sudo.");

            // Show the confirmation dialog using Tauri's dialog API
            tauri::api::dialog::confirm(
                Some(window),
                "Error",
                "This program needs to be run as root. Please use sudo.",
                |response| {
                    if response {
                        println!("User acknowledged the need for root permissions.");
                    } else {
                        println!("User ignored the root permissions warning.");
                    }
                },
            );

            process::exit(1); // Exit if not root
        }
    }
}
