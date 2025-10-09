#!/bin/bash

# Build script using Docker to create a glibc-compatible binary

set -e

echo "🐳 Building Rustinx with Docker for Ubuntu 18.04 compatibility..."

# Build using Docker
docker build -f Dockerfile.build -t rustinx-builder .

# Extract the built binary
echo "📦 Extracting built binary..."
docker create --name temp-container rustinx-builder
docker cp temp-container:/app/src-tauri/target/release/web-server ./web-server-compatible
docker cp temp-container:/app/dist ./dist-compatible
docker rm temp-container

# Check the binary
echo "🔍 Checking binary compatibility..."
file web-server-compatible
ldd web-server-compatible || echo "Static binary - good!"

# Create new AppImage with compatible binary
echo "🚀 Creating compatible AppImage..."

# Create AppDir structure
APPDIR="rustinx-compatible.AppDir"
rm -rf $APPDIR
mkdir -p $APPDIR/usr/bin
mkdir -p $APPDIR/usr/share/rustinx

# Copy the compatible binary
cp web-server-compatible $APPDIR/usr/bin/web-server
chmod +x $APPDIR/usr/bin/web-server

# Copy frontend files
cp -r dist-compatible/* $APPDIR/usr/share/rustinx/

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
echo "🔨 Creating compatible AppImage..."
if [ -f "appimagetool-x86_64.AppImage" ]; then
    ARCH=x86_64 ./appimagetool-x86_64.AppImage $APPDIR rustinx-compatible-x86_64.AppImage
else
    echo "❌ AppImageTool not found. Please run the original build script first."
    exit 1
fi

echo ""
echo "✅ Compatible AppImage created!"
echo ""
echo "📦 Files created:"
echo "   rustinx-compatible-x86_64.AppImage - Ubuntu 18.04+ compatible executable"
echo "   web-server-compatible - Standalone binary"
echo ""
echo "🔍 Binary info:"
file rustinx-compatible-x86_64.AppImage
echo ""
echo "📤 Upload to VPS:"
echo "   scp rustinx-compatible-x86_64.AppImage user@your-vps:/opt/"
echo ""
echo "🚀 Run on VPS:"
echo "   sudo /opt/rustinx-compatible-x86_64.AppImage"