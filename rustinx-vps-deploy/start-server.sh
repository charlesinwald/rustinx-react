#!/bin/bash

# Startup script for rustinx on Ubuntu VPS
export RUST_LOG=debug
export RUST_BACKTRACE=1

# Make sure we're in the correct directory
cd "$(dirname "$0")"

echo "Starting Rustinx web server..."
echo "Frontend will be available at: http://your-vps-ip:8081"

# Start the web server
# Note: You may need to run with sudo for system metrics access
sudo ./web-server
