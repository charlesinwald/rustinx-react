#!/bin/bash

# Build static binary using musl target for maximum compatibility

set -e

echo "🔨 Building static Rustinx binary using musl..."

# Build frontend first
echo "📦 Building frontend..."
yarn run build

# Build static Rust backend
echo "🦀 Building static Rust binary..."
cd src-tauri

# Add musl target if not present
rustup target add x86_64-unknown-linux-musl

# Build with musl for static linking
export RUSTFLAGS="-C target-feature=+crt-static"
cargo build --bin web-server --release --target x86_64-unknown-linux-musl

cd ..

# Check the binary
echo "🔍 Checking binary dependencies..."
BINARY="src-tauri/target/x86_64-unknown-linux-musl/release/web-server"
file $BINARY
echo "Checking dynamic dependencies (should be empty for static):"
ldd $BINARY 2>/dev/null || echo "✅ Static binary - no dynamic dependencies!"

# Create new AppImage with static binary
echo "🚀 Creating static AppImage..."

# Create AppDir structure
APPDIR="rustinx-static.AppDir"
rm -rf $APPDIR
mkdir -p $APPDIR/usr/bin
mkdir -p $APPDIR/usr/share/rustinx

# Copy the static binary
cp $BINARY $APPDIR/usr/bin/web-server
chmod +x $APPDIR/usr/bin/web-server

# Copy frontend files
# Frontend is embedded in web-server; AppImage does not need a separate dist tree.

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

# Create a simple icon
cat > $APPDIR/rustinx.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#4a90e2" rx="8"/>
  <text x="32" y="40" text-anchor="middle" fill="white" font-family="sans-serif" font-size="20" font-weight="bold">Rx</text>
</svg>
EOF

# Create the AppImage
echo "🔨 Creating static AppImage..."
if [ -f "appimagetool-x86_64.AppImage" ]; then
    ARCH=x86_64 ./appimagetool-x86_64.AppImage $APPDIR rustinx-static-x86_64.AppImage
else
    echo "❌ AppImageTool not found. Please run the original build script first."
    exit 1
fi

# Also create a simple deployment package
echo "📦 Creating simple deployment package..."
mkdir -p rustinx-static-deploy
cp $BINARY rustinx-static-deploy/web-server
# Frontend is embedded in web-server; no separate dist/ at runtime.
cat > rustinx-static-deploy/start.sh << 'EOF'
#!/bin/bash
export RUST_LOG=info
export RUST_BACKTRACE=1
echo "Starting Rustinx at http://localhost:8081"
sudo ./web-server
EOF
chmod +x rustinx-static-deploy/start.sh

tar -czf rustinx-static-deploy.tar.gz rustinx-static-deploy/

echo ""
echo "✅ Static build completed!"
echo ""
echo "📦 Files created:"
echo "   rustinx-static-x86_64.AppImage - Static AppImage (recommended)"
echo "   rustinx-static-deploy.tar.gz - Simple deployment package"
echo "   $BINARY - Standalone static binary"
echo ""
echo "🔍 Binary info:"
file rustinx-static-x86_64.AppImage
echo ""
echo "📤 Upload to VPS (choose one):"
echo "   scp rustinx-static-x86_64.AppImage user@your-vps:/opt/"
echo "   scp rustinx-static-deploy.tar.gz user@your-vps:/tmp/"
echo ""
echo "🚀 Run on VPS:"
echo "   AppImage: sudo /opt/rustinx-static-x86_64.AppImage"
echo "   Package:  cd /tmp && tar -xzf rustinx-static-deploy.tar.gz && cd rustinx-static-deploy && ./start.sh"