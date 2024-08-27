export RUST_LOG=debug
sudo kill -9 $(sudo lsof -t -i:1234)
RUST_LOG=debug RUST_BACKTRACE=1 sudo env "PATH=$PATH" yarn run tauri dev
