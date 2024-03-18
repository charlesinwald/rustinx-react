export RUST_LOG=debug
sudo kill -9 $(sudo lsof -t -i:1234)
RUST_LOG=debug sudo env "PATH=$PATH" yarn run tauri dev
