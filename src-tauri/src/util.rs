use gtk::ButtonsType;

use gtk::MessageType;

use gtk::DialogFlags;

use gtk::Window;

use gtk::MessageDialog;

use nix::libc::geteuid;

use gtk::prelude::*;
use std::os::unix::process::CommandExt;
use std::process;

pub(crate) fn check_sudo() {
    // Check if the current user is root
    if unsafe { geteuid() == 0 } {
        println!("Running with root privileges.");
    } else {
        eprintln!("This program needs to be run as root. Please use sudo.");

        // Initialize GTK
        gtk::init().expect("Failed to initialize GTK.");

        // Create the dialog
        let dialog = MessageDialog::new(
            None::<&Window>,
            DialogFlags::empty(),
            MessageType::Error,
            ButtonsType::Ok,
            "This program needs to be run as root. Please use sudo.",
        );

        dialog.run(); // Show the dialog
        dialog.close();

        process::exit(1); // Exit if not root
    }
}
