//! Fail release builds if `dist/` was not produced (unless opted out).

use std::path::PathBuf;

fn main() {
    let dist_index = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../dist/index.html");
    println!("cargo:rerun-if-changed={}", dist_index.display());
    println!("cargo:rerun-if-changed={}", dist_index.parent().unwrap().display());

    if std::env::var("PROFILE").unwrap() == "release"
        && std::env::var("RUSTINX_SKIP_DIST_CHECK").is_err()
        && !dist_index.exists()
    {
        panic!(
            "Frontend bundle missing at {}. Run `yarn build` or `npm run build` from the repository root, or set RUSTINX_SKIP_DIST_CHECK=1 to skip this check.",
            dist_index.display()
        );
    }
}
