#!/bin/bash
export RUST_LOG=info
export RUST_BACKTRACE=1
echo "🚀 Starting Rustinx Nginx Dashboard"
echo "📍 Access at: http://$(hostname -I | awk '{print $1}'):8081"
echo "🛑 Use Ctrl+C to stop the server"
echo ""

# Check if we need to create the service account
if ! id rustinx >/dev/null 2>&1; then
    echo "🔧 Creating rustinx service user..."
    sudo useradd -r -s /bin/false rustinx || true
fi

echo "Starting web server..."
sudo ./web-server
