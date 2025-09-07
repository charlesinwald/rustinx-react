#!/bin/bash

export RUST_LOG=debug

# Function to kill processes on specific ports
cleanup_ports() {
    echo "Cleaning up ports..."
    pkill -f "parcel.*1234" 2>/dev/null || true
    pkill -f "parcel.*3000" 2>/dev/null || true
    pkill -f "web-server" 2>/dev/null || true
    sudo lsof -ti:1234 | xargs sudo kill -9 2>/dev/null || true
    sudo lsof -ti:3000 | xargs sudo kill -9 2>/dev/null || true
    sudo lsof -ti:8080 | xargs sudo kill -9 2>/dev/null || true
}

# Cleanup on exit
trap cleanup_ports EXIT

cleanup_ports

echo "Choose development mode:"
echo "1) Tauri desktop app (GUI with real system metrics)"
echo "2) Browser app (web with real system metrics via HTTP API)"
read -p "Enter choice (1 or 2): " choice

case $choice in
  1)
    echo "Starting Tauri desktop app..."
    # Only use sudo for tauri dev as it needs system access
    RUST_LOG=debug RUST_BACKTRACE=1 sudo -E env "PATH=$PATH" yarn run tauri:dev
    ;;
  2)
    echo "Starting browser app..."
    
    # Clean any root-owned cache and build files
    echo "Cleaning cache and build files..."
    sudo rm -rf .parcel-cache 2>/dev/null || true
    sudo rm -rf node_modules/.cache 2>/dev/null || true
    sudo rm -rf dist 2>/dev/null || true
    
    # Clean any previous build artifacts owned by root
    echo "Checking for root-owned build artifacts..."
    if find src-tauri/target -user root 2>/dev/null | head -1 | grep -q .; then
        echo "Found root-owned files, cleaning build directory..."
        sudo rm -rf src-tauri/target
    fi
    
    echo "Building frontend first..."
    yarn run build
    if [ $? -ne 0 ]; then
        echo "Failed to build frontend"
        exit 1
    fi
    
    echo "Building web server..."
    cd src-tauri
    
    # Build with a custom target directory to avoid permission issues
    export CARGO_TARGET_DIR="./target-web"
    cargo build --bin web-server
    if [ $? -ne 0 ]; then
        echo "Failed to build web server"
        exit 1
    fi
    cd ..
    
    echo "Starting web server in background..."
    # Web server needs sudo for system metrics access
    RUST_LOG=debug RUST_BACKTRACE=1 sudo -E ./src-tauri/target-web/debug/web-server &
    WEB_SERVER_PID=$!
    
    # Wait for web server to start
    sleep 3
    
    # Check if web server is actually running
    if ! ps -p $WEB_SERVER_PID > /dev/null; then
        echo "Web server failed to start"
        exit 1
    fi
    
    echo "Web server started with PID: $WEB_SERVER_PID"
    echo "Frontend is built and served at http://localhost:8080"
    echo "Press Ctrl+C to stop the server"
    
    # Wait for interrupt signal instead of starting dev server
    trap 'echo "Stopping web server..."; sudo kill $WEB_SERVER_PID 2>/dev/null || true; exit' INT
    while true; do
        sleep 1
    done
    ;;
  *)
    echo "Invalid choice. Starting Tauri desktop app by default..."
    RUST_LOG=debug RUST_BACKTRACE=1 sudo -E env "PATH=$PATH" yarn run tauri:dev
    ;;
esac
