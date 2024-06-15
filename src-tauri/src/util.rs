#[cfg(unix)]
use nix::libc::geteuid;
#[cfg(windows)]
use std::os::windows::fs::MetadataExt;

use std::process;
use tauri::Window;

pub (crate) async fn check_sudo(window: &Window) {
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

    #[cfg(windows)]
    {
        // Check if the current user is an administrator on Windows
        use windows::Win32::Security::Authorization::*;
        use windows::Win32::Security::*;
        use windows::Win32::System::Threading::*;
        use windows::Win32::Foundation::*;
        use windows::Win32::System::Memory::*;

        let mut is_admin: BOOL = FALSE;
        unsafe {
            let token_handle = HANDLE::default();
            OpenProcessToken(
                GetCurrentProcess(),
                TOKEN_QUERY | TOKEN_QUERY_SOURCE,
                &token_handle,
            );
            let mut elevation = TOKEN_ELEVATION::default();
            let mut size = std::mem::size_of::<TOKEN_ELEVATION>() as u32;
            GetTokenInformation(
                token_handle,
                TokenElevation,
                &mut elevation as *mut _ as *mut _,
                size,
                &mut size,
            );
            is_admin = elevation.TokenIsElevated;
        }

        if is_admin.as_bool() {
            println!("Running with administrator privileges.");
        } else {
            eprintln!("This program needs to be run as an administrator. Please run as administrator.");

            // Show the confirmation dialog using Tauri's dialog API
            tauri::api::dialog::confirm(
                Some(window),
                "Error",
                "This program needs to be run as an administrator. Please run as administrator.",
                |response| {
                    if response {
                        println!("User acknowledged the need for administrator permissions.");
                    } else {
                        println!("User ignored the administrator permissions warning.");
                    }
                },
            );

            process::exit(1); // Exit if not administrator
        }
    }
}
