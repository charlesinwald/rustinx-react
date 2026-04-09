#!/bin/bash

# Build truly static web-server binary without GUI dependencies

set -e

echo "🔨 Building static web-server binary (no GUI dependencies)..."

# Build frontend first
echo "📦 Building frontend..."
yarn run build

# Build static web-server using clean dependencies
echo "🦀 Building static web-server binary..."
cd src-tauri

# Add musl target if not present
rustup target add x86_64-unknown-linux-musl

# Build using the clean Cargo.toml without GUI dependencies
export RUSTFLAGS="-C target-feature=+crt-static"
cargo build --bin web-server --release --target x86_64-unknown-linux-musl --manifest-path ./standalone-web-server/Cargo.toml

cd ..

# Check the binary
echo "🔍 Checking binary dependencies..."
BINARY="src-tauri/target/x86_64-unknown-linux-musl/release/web-server"
file $BINARY
echo "Checking dynamic dependencies (should be minimal for static):"
ldd $BINARY 2>/dev/null || echo "✅ Static or minimal dependencies!"

# Create deployment packages
echo "🚀 Creating deployment packages..."

# 1. Simple deployment package
mkdir -p rustinx-clean-deploy
cp $BINARY rustinx-clean-deploy/web-server
# Frontend is embedded in web-server; no separate dist/ at runtime.
cat > rustinx-clean-deploy/start.sh << 'EOF'
#!/bin/bash
export RUST_LOG=info
export RUST_BACKTRACE=1
echo "Starting Rustinx at http://localhost:8081"
echo "Use Ctrl+C to stop the server"
sudo ./web-server
EOF
chmod +x rustinx-clean-deploy/start.sh

cat > rustinx-clean-deploy/README.md << 'EOF'
# Rustinx Clean Deploy

## Quick Start
```bash
sudo ./start.sh
```

Access at: http://localhost:8081

## Manual Start
```bash
sudo ./web-server
```

## System Service
```bash
# Copy files
sudo cp -r . /opt/rustinx/

# Create service
sudo tee /etc/systemd/system/rustinx.service << 'EOL'
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

sudo systemctl enable rustinx.service
sudo systemctl start rustinx.service
```

## Firewall
```bash
sudo ufw allow 8081
```
EOF

tar -czf rustinx-clean-deploy.tar.gz rustinx-clean-deploy/

# 2. Create AppImage if tools are available
if [ -f "appimagetool-x86_64.AppImage" ]; then
    echo "🔨 Creating clean AppImage..."
    
    # Create AppDir structure
    APPDIR="rustinx-clean.AppDir"
    rm -rf $APPDIR
    mkdir -p $APPDIR/usr/bin
    mkdir -p $APPDIR/usr/share/rustinx

    # Copy the static binary
    cp $BINARY $APPDIR/usr/bin/web-server
    chmod +x $APPDIR/usr/bin/web-server

    # Frontend is embedded in web-server; no separate dist tree in the AppImage.

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
echo "Starting Rustinx Nginx Dashboard..."
echo "Access at: http://localhost:8081"
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
    ARCH=x86_64 ./appimagetool-x86_64.AppImage $APPDIR rustinx-clean-x86_64.AppImage
    
    echo "✅ AppImage created: rustinx-clean-x86_64.AppImage"
else
    echo "ℹ️  AppImageTool not found, skipping AppImage creation"
fi

echo ""
echo "✅ Clean static build completed!"
echo ""
echo "📦 Files created:"
echo "   rustinx-clean-deploy.tar.gz - Simple deployment package (recommended)"
if [ -f "rustinx-clean-x86_64.AppImage" ]; then
echo "   rustinx-clean-x86_64.AppImage - Static AppImage"
fi
echo "   $BINARY - Standalone static binary"
echo ""
echo "🔍 Binary info:"
file $BINARY
echo ""
echo "📤 Upload to VPS (choose one):"
echo "   scp rustinx-clean-deploy.tar.gz user@your-vps:/tmp/"
if [ -f "rustinx-clean-x86_64.AppImage" ]; then
echo "   scp rustinx-clean-x86_64.AppImage user@your-vps:/opt/"
fi
echo ""
echo "🚀 Deploy on VPS:"
echo "   Package: cd /tmp && tar -xzf rustinx-clean-deploy.tar.gz && cd rustinx-clean-deploy && sudo ./start.sh"
if [ -f "rustinx-clean-x86_64.AppImage" ]; then
echo "   AppImage: sudo /opt/rustinx-clean-x86_64.AppImage"
fi