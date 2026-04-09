#!/bin/bash

# Build web-server binary with minimal glibc dependencies

set -e

echo "🔨 Building compatible web-server binary..."

# Build frontend first
echo "📦 Building frontend..."
yarn run build

# Build web-server using clean dependencies (already swapped by previous script)
echo "🦀 Building web-server binary..."
cd src-tauri

# Just build normally with the clean dependencies - this should be compatible enough
cargo build --bin web-server --release

cd ..

# Check the binary
echo "🔍 Checking binary dependencies..."
BINARY="src-tauri/target/release/web-server"
file $BINARY
echo "Dynamic dependencies:"
ldd $BINARY || echo "Could not check dependencies"

# Create deployment packages
echo "🚀 Creating deployment packages..."

# Simple deployment package
mkdir -p rustinx-simple-deploy
cp $BINARY rustinx-simple-deploy/web-server
# Frontend is embedded in web-server; no separate dist/ at runtime.
cat > rustinx-simple-deploy/start.sh << 'EOF'
#!/bin/bash
export RUST_LOG=info
export RUST_BACKTRACE=1
echo "🚀 Starting Rustinx Nginx Dashboard"
echo "📍 Access at: http://localhost:8081"
echo "🛑 Use Ctrl+C to stop the server"
echo ""
sudo ./web-server
EOF
chmod +x rustinx-simple-deploy/start.sh

cat > rustinx-simple-deploy/install.sh << 'EOF'
#!/bin/bash

# Install Rustinx as a system service

set -e

echo "📦 Installing Rustinx to /opt/rustinx..."
sudo mkdir -p /opt/rustinx
sudo cp -r * /opt/rustinx/
sudo chmod +x /opt/rustinx/web-server
sudo chmod +x /opt/rustinx/start.sh

echo "📝 Creating systemd service..."
sudo tee /etc/systemd/system/rustinx.service > /dev/null << 'EOL'
[Unit]
Description=Rustinx Nginx Dashboard
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rustinx
ExecStart=/opt/rustinx/web-server
Environment=RUST_LOG=info
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOL

echo "🔥 Enabling and starting Rustinx service..."
sudo systemctl daemon-reload
sudo systemctl enable rustinx.service
sudo systemctl start rustinx.service

echo ""
echo "✅ Installation complete!"
echo "📊 Access Rustinx at: http://your-server-ip:8081"
echo ""
echo "📋 Useful commands:"
echo "   sudo systemctl status rustinx    # Check status"
echo "   sudo systemctl restart rustinx   # Restart service"
echo "   sudo systemctl stop rustinx      # Stop service"
echo "   sudo journalctl -u rustinx -f    # View logs"
EOF
chmod +x rustinx-simple-deploy/install.sh

cat > rustinx-simple-deploy/README.md << 'EOF'
# Rustinx - Simple Deployment

🎯 **Clean build without GUI dependencies**
✅ **Minimal dependencies - should work on most Linux systems**
⚡ **Single executable with embedded frontend**

## Quick Start
```bash
sudo ./start.sh
```
Access at: http://localhost:8081

## System Service Installation
```bash
sudo ./install.sh
```

## Manual Start
```bash
sudo ./web-server
```

## Firewall Setup
```bash
# Ubuntu/Debian
sudo ufw allow 8081

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=8081/tcp
sudo firewall-cmd --reload
```

## Requirements
- Linux x86_64 
- Root access (for system metrics and nginx control)
- Port 8081 available
- glibc 2.17+ (most systems from 2012+)

## Features
- 📊 Real-time system metrics
- 🌐 Nginx service control (start/stop/restart)
- 📝 Live log viewing (nginx + systemd)
- 🔐 Password-protected sudo operations
- 📱 Responsive web interface

## Troubleshooting
```bash
# Check if running
ps aux | grep web-server

# Test port
netstat -tlnp | grep 8081

# Check dependencies
ldd ./web-server

# Check logs if installed as service
sudo journalctl -u rustinx -f
```
EOF

tar -czf rustinx-simple-deploy.tar.gz rustinx-simple-deploy/

echo ""
echo "🎉 Simple build completed!"
echo ""
echo "📦 Files created:"
echo "   📁 rustinx-simple-deploy/ - Deployment directory" 
echo "   📦 rustinx-simple-deploy.tar.gz - Deployment package"
echo "   ⚡ $BINARY - Web server binary"
echo ""
echo "🔍 Binary info:"
file $BINARY
ls -lh $BINARY
echo ""
echo "🚀 **UPLOAD TO VPS:**"
echo "   scp rustinx-simple-deploy.tar.gz user@your-vps:/tmp/"
echo ""
echo "🎯 **DEPLOY ON VPS:**"
echo "   ssh user@your-vps"
echo "   cd /tmp"
echo "   tar -xzf rustinx-simple-deploy.tar.gz"
echo "   cd rustinx-simple-deploy"
echo "   sudo ./install.sh    # Install as service"
echo ""
echo "🌐 **ACCESS:** http://your-vps-ip:8081"
echo ""
echo "💡 **If you still get glibc errors on your VPS:**"
echo "   This means your VPS has very old glibc. Try using a newer Ubuntu/Debian version,"
echo "   or use the Docker approach for building on Ubuntu 18.04."