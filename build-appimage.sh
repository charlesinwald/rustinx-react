#!/bin/bash

# Build script to create a portable AppImage for Ubuntu VPS deployment
# This creates a self-contained executable that works across different Linux distributions

set -e

echo "🚀 Building Rustinx AppImage for universal Linux compatibility..."

# Clean and build with static linking where possible
echo "📦 Building with static linking..."
cd src-tauri

# Build with musl target for better compatibility
rustup target add x86_64-unknown-linux-musl 2>/dev/null || echo "musl target already installed"

# Install musl-gcc if not available
if ! command -v musl-gcc &> /dev/null; then
    echo "⚠️  musl-gcc not found. Falling back to regular build."
    echo "   For better compatibility, install musl-tools: sudo pacman -S musl"
    CARGO_TARGET=""
else
    echo "✅ Using musl for static linking"
    CARGO_TARGET="--target x86_64-unknown-linux-musl"
fi

# Build the web server
export CARGO_TARGET_DIR="./target-musl"
cargo build --bin web-server --release $CARGO_TARGET

cd ..

# Create AppDir structure
APPDIR="rustinx.AppDir"
rm -rf $APPDIR
mkdir -p $APPDIR/usr/bin
mkdir -p $APPDIR/usr/share/rustinx

# Copy the binary
if [ -f "src-tauri/target-musl/x86_64-unknown-linux-musl/release/web-server" ]; then
    echo "✅ Using musl binary for maximum compatibility"
    cp src-tauri/target-musl/x86_64-unknown-linux-musl/release/web-server $APPDIR/usr/bin/
elif [ -f "src-tauri/target-musl/release/web-server" ]; then
    cp src-tauri/target-musl/release/web-server $APPDIR/usr/bin/
else
    echo "⚠️  Using regular binary (may have glibc dependencies)"
    cp src-tauri/target/release/web-server $APPDIR/usr/bin/
fi

# Build frontend
echo "📦 Building frontend..."
yarn run build

# Frontend is embedded in web-server; no separate dist tree in the AppImage.

# Create desktop file
cat > $APPDIR/rustinx.desktop << EOF
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

# AppImage launcher for Rustinx
cd "$(dirname "$0")"

# Set environment
export RUST_LOG=info
export RUST_BACKTRACE=1

# Start the web server
echo "Starting Rustinx Nginx Dashboard..."
echo "Access at: http://localhost:8081"

exec ./usr/bin/web-server
EOF

chmod +x $APPDIR/AppRun

# Create a simple icon (you can replace with a real icon)
cat > $APPDIR/rustinx.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#4a90e2" rx="8"/>
  <text x="32" y="40" text-anchor="middle" fill="white" font-family="sans-serif" font-size="20" font-weight="bold">Rx</text>
</svg>
EOF

# Download AppImageTool if not present
if [ ! -f "appimagetool-x86_64.AppImage" ]; then
    echo "📥 Downloading AppImageTool..."
    wget -O appimagetool-x86_64.AppImage "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
    chmod +x appimagetool-x86_64.AppImage
fi

# Create the AppImage
echo "🔨 Creating AppImage..."
ARCH=x86_64 ./appimagetool-x86_64.AppImage $APPDIR rustinx-x86_64.AppImage

# Create deployment instructions
cat > rustinx-appimage-deploy.md << 'EOF'
# Rustinx AppImage Deployment

## What is this?
The `rustinx-x86_64.AppImage` is a self-contained, portable version of Rustinx that runs on most Linux distributions without installation.

## Quick Start on VPS

1. Upload the AppImage to your VPS:
```bash
scp rustinx-x86_64.AppImage user@your-vps:/opt/
```

2. Make it executable and run:
```bash
ssh user@your-vps
sudo chmod +x /opt/rustinx-x86_64.AppImage
sudo /opt/rustinx-x86_64.AppImage
```

3. Access at: `http://your-vps-ip:8081`

## Install as System Service

Create a systemd service:

```bash
sudo tee /etc/systemd/system/rustinx.service << 'EOL'
[Unit]
Description=Rustinx Nginx Dashboard
After=network.target

[Service]
Type=simple
User=root
ExecStart=/opt/rustinx-x86_64.AppImage
Environment=RUST_LOG=info
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOL

sudo systemctl enable rustinx.service
sudo systemctl start rustinx.service
```

## Advantages
- ✅ Works on Ubuntu 14.04+ and most Linux distributions
- ✅ No dependency hell or glibc version conflicts  
- ✅ Single file deployment
- ✅ Self-contained with all dependencies

## Requirements
- Linux x86_64
- Root access (for system metrics)
- Port 8081 available

## Firewall Setup
```bash
sudo ufw allow 8081
```

## Troubleshooting
- Check if running: `ps aux | grep rustinx`
- View service logs: `sudo journalctl -u rustinx -f`  
- Test manually: `sudo ./rustinx-x86_64.AppImage`
EOF

echo ""
echo "✅ AppImage created successfully!"
echo ""
echo "📦 Files created:"
echo "   rustinx-x86_64.AppImage - Portable executable (upload this to VPS)"
echo "   rustinx-appimage-deploy.md - Deployment instructions"
echo ""
echo "📤 Upload to VPS:"
echo "   scp rustinx-x86_64.AppImage user@your-vps:/opt/"
echo ""
echo "🚀 Run on VPS:"
echo "   sudo /opt/rustinx-x86_64.AppImage"