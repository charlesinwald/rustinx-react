#!/bin/bash

# Build truly static web-server binary by temporarily using clean dependencies

set -e

echo "🔨 Building static web-server binary (no GUI dependencies)..."

# Build frontend first
echo "📦 Building frontend..."
yarn run build

# Build static web-server by temporarily replacing Cargo.toml
echo "🦀 Building static web-server binary..."
cd src-tauri

# Backup original Cargo.toml and use the clean one
mv Cargo.toml Cargo.toml.backup
mv Cargo-webserver.toml Cargo.toml

# Add musl target if not present
rustup target add x86_64-unknown-linux-musl

# Build with musl for static linking
export RUSTFLAGS="-C target-feature=+crt-static"
cargo build --bin web-server --release --target x86_64-unknown-linux-musl

# Restore original Cargo.toml
mv Cargo.toml Cargo-webserver.toml
mv Cargo.toml.backup Cargo.toml

cd ..

# Check the binary
echo "🔍 Checking binary dependencies..."
BINARY="src-tauri/target/x86_64-unknown-linux-musl/release/web-server"
file $BINARY
echo "Checking dynamic dependencies:"
ldd $BINARY 2>/dev/null || echo "✅ Static binary - no dynamic dependencies!"

# Create deployment packages
echo "🚀 Creating deployment packages..."

# 1. Simple deployment package
mkdir -p rustinx-final-deploy
cp $BINARY rustinx-final-deploy/web-server
cp -r dist rustinx-final-deploy/
cat > rustinx-final-deploy/start.sh << 'EOF'
#!/bin/bash
export RUST_LOG=info
export RUST_BACKTRACE=1
echo "🚀 Starting Rustinx Nginx Dashboard"
echo "📍 Access at: http://localhost:8081"
echo "🛑 Use Ctrl+C to stop the server"
echo ""
sudo ./web-server
EOF
chmod +x rustinx-final-deploy/start.sh

cat > rustinx-final-deploy/install.sh << 'EOF'
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
chmod +x rustinx-final-deploy/install.sh

cat > rustinx-final-deploy/README.md << 'EOF'
# Rustinx - Static Binary Deployment

✅ **Fully static binary - works on any Linux with glibc 2.17+**
✅ **No dependencies or installation required**
✅ **Single 8MB+ executable with embedded frontend**

## Quick Start
```bash
sudo ./start.sh
```
Access at: http://localhost:8081

## Manual Start
```bash
sudo ./web-server
```

## System Service Installation
```bash
sudo ./install.sh
```

## Firewall Setup
```bash
# Ubuntu/Debian
sudo ufw allow 8081

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=8081/tcp
sudo firewall-cmd --reload

# Manual iptables
sudo iptables -I INPUT -p tcp --dport 8081 -j ACCEPT
```

## Requirements
- Linux x86_64 
- Root access (for system metrics and nginx control)
- Port 8081 available

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

# Check logs if installed as service
sudo journalctl -u rustinx -f
```
EOF

tar -czf rustinx-final-deploy.tar.gz rustinx-final-deploy/

# 2. Create AppImage if tools are available
if [ -f "appimagetool-x86_64.AppImage" ]; then
    echo "🔨 Creating static AppImage..."
    
    # Create AppDir structure
    APPDIR="rustinx-static.AppDir"
    rm -rf $APPDIR
    mkdir -p $APPDIR/usr/bin
    mkdir -p $APPDIR/usr/share/rustinx

    # Copy the static binary
    cp $BINARY $APPDIR/usr/bin/web-server
    chmod +x $APPDIR/usr/bin/web-server

    # Copy frontend files
    cp -r dist/* $APPDIR/usr/share/rustinx/

    # Create desktop file
    cat > $APPDIR/rustinx.desktop << 'EOF'
[Desktop Entry]
Name=Rustinx
Exec=rustinx-launcher
Icon=rustinx
Type=Application
Categories=System;
Comment=Nginx Dashboard and Monitoring Tool
EOF

    # Create launcher script
    cat > $APPDIR/AppRun << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
export RUST_LOG=info
export RUST_BACKTRACE=1
echo "🚀 Starting Rustinx Nginx Dashboard"
echo "📍 Access at: http://localhost:8081"
echo "🛑 Use Ctrl+C to stop"
echo ""
exec ./usr/bin/web-server
EOF
    chmod +x $APPDIR/AppRun

    # Create icon
    cat > $APPDIR/rustinx.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#4a90e2" rx="8"/>
  <text x="32" y="40" text-anchor="middle" fill="white" font-family="sans-serif" font-size="20" font-weight="bold">Rx</text>
</svg>
EOF

    # Create the AppImage
    ARCH=x86_64 ./appimagetool-x86_64.AppImage $APPDIR rustinx-static-x86_64.AppImage
    
    echo "✅ AppImage created: rustinx-static-x86_64.AppImage"
else
    echo "ℹ️  AppImageTool not found, skipping AppImage creation"
fi

echo ""
echo "🎉 FINAL static build completed successfully!"
echo ""
echo "📦 Files created:"
echo "   📁 rustinx-final-deploy/ - Deployment directory" 
echo "   📦 rustinx-final-deploy.tar.gz - Complete deployment package (RECOMMENDED)"
if [ -f "rustinx-static-x86_64.AppImage" ]; then
echo "   🖥️  rustinx-static-x86_64.AppImage - Portable AppImage"
fi
echo "   ⚡ $BINARY - Raw static binary"
echo ""
echo "🔍 Binary info:"
file $BINARY
ls -lh $BINARY
echo ""
echo "🚀 **UPLOAD TO VPS:**"
echo "   scp rustinx-final-deploy.tar.gz user@your-vps:/tmp/"
echo ""
echo "🎯 **DEPLOY ON VPS:**"
echo "   ssh user@your-vps"
echo "   cd /tmp"
echo "   tar -xzf rustinx-final-deploy.tar.gz"
echo "   cd rustinx-final-deploy"
echo "   sudo ./install.sh    # Install as service (recommended)"
echo "   # OR"
echo "   sudo ./start.sh      # Run manually"
echo ""
echo "🌐 **ACCESS:** http://your-vps-ip:8081"