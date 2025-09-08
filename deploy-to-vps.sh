#!/bin/bash

# Deployment script for Ubuntu VPS
# This script packages the built application for deployment

echo "Creating deployment package for Ubuntu VPS..."

# Create deployment directory
DEPLOY_DIR="rustinx-vps-deploy"
rm -rf $DEPLOY_DIR
mkdir -p $DEPLOY_DIR

# Copy the built frontend
echo "Packaging frontend..."
cp -r dist $DEPLOY_DIR/

# Copy the built web server binary
echo "Packaging web server binary..."
if [ -f "src-tauri/target/release/web-server" ]; then
    cp src-tauri/target/release/web-server $DEPLOY_DIR/
elif [ -f "src-tauri/target/debug/web-server" ]; then
    echo "Warning: Using debug build (release build not found)"
    cp src-tauri/target/debug/web-server $DEPLOY_DIR/
else
    echo "Error: web-server binary not found!"
    exit 1
fi

# Create a startup script for the VPS
cat > $DEPLOY_DIR/start-server.sh << 'EOF'
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
EOF

# Make the startup script executable
chmod +x $DEPLOY_DIR/start-server.sh

# Create a systemd service file (optional)
cat > $DEPLOY_DIR/rustinx.service << 'EOF'
[Unit]
Description=Rustinx Nginx Dashboard
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rustinx
ExecStart=/opt/rustinx/web-server
Environment=RUST_LOG=debug
Environment=RUST_BACKTRACE=1
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create installation instructions
cat > $DEPLOY_DIR/INSTALL.md << 'EOF'
# Rustinx VPS Installation

## Quick Start

1. Upload this entire directory to your Ubuntu VPS
2. Run: `./start-server.sh`
3. Access the dashboard at: `http://your-vps-ip:8081`

## Manual Installation

```bash
# Copy files to /opt/rustinx
sudo mkdir -p /opt/rustinx
sudo cp -r * /opt/rustinx/
sudo chmod +x /opt/rustinx/web-server
sudo chmod +x /opt/rustinx/start-server.sh

# Start the server
cd /opt/rustinx
sudo ./start-server.sh
```

## Install as System Service (Optional)

```bash
# Copy the service file
sudo cp rustinx.service /etc/systemd/system/

# Enable and start the service
sudo systemctl enable rustinx.service
sudo systemctl start rustinx.service

# Check status
sudo systemctl status rustinx.service
```

## Requirements

- Ubuntu 18.04+ (or other Linux distributions)
- Root/sudo access (required for system metrics)
- Port 8081 open in firewall

## Firewall Configuration

```bash
# For UFW (Ubuntu default)
sudo ufw allow 8081

# For iptables
sudo iptables -I INPUT -p tcp --dport 8081 -j ACCEPT
```

## Troubleshooting

- Check logs: `sudo journalctl -u rustinx.service -f`
- Test manually: `sudo ./web-server`
- Verify port is open: `netstat -tlnp | grep 8081`
EOF

# Create a tar archive for easy upload
tar -czf rustinx-vps-deploy.tar.gz $DEPLOY_DIR

echo "✅ Deployment package created!"
echo ""
echo "Files created:"
echo "  📁 $DEPLOY_DIR/ - Deployment directory"
echo "  📦 rustinx-vps-deploy.tar.gz - Archive for upload"
echo ""
echo "Next steps:"
echo "1. Upload rustinx-vps-deploy.tar.gz to your VPS"
echo "2. Extract: tar -xzf rustinx-vps-deploy.tar.gz"
echo "3. Run: cd rustinx-vps-deploy && ./start-server.sh"
echo ""
echo "Your app will be available at: http://your-vps-ip:8081"