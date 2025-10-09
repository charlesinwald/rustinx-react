#!/bin/bash

# Install Rustinx as a system service

set -e

echo "🚀 Installing Rustinx Nginx Dashboard"
echo ""

# Install to /opt/rustinx
echo "📦 Installing to /opt/rustinx..."
sudo mkdir -p /opt/rustinx
sudo cp -r * /opt/rustinx/
sudo chmod +x /opt/rustinx/web-server
sudo chmod +x /opt/rustinx/start.sh

# Create service user
echo "👤 Creating service user..."
sudo useradd -r -s /bin/false rustinx 2>/dev/null || echo "User already exists"

# Set permissions
sudo chown -R root:rustinx /opt/rustinx
sudo chmod -R 755 /opt/rustinx

# Create systemd service
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
Environment=RUST_BACKTRACE=1
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOL

# Enable and start service
echo "🔥 Starting service..."
sudo systemctl daemon-reload
sudo systemctl enable rustinx.service
sudo systemctl start rustinx.service

# Setup firewall
echo "🔓 Configuring firewall..."
if command -v ufw >/dev/null 2>&1; then
    sudo ufw allow 8081/tcp
    echo "✅ UFW rule added for port 8081"
elif command -v firewall-cmd >/dev/null 2>&1; then
    sudo firewall-cmd --permanent --add-port=8081/tcp
    sudo firewall-cmd --reload
    echo "✅ Firewalld rule added for port 8081"
else
    echo "⚠️  Please manually open port 8081 in your firewall"
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "📊 Access Rustinx at: http://$(hostname -I | awk '{print $1}'):8081"
echo ""
echo "📋 Service Management:"
echo "   sudo systemctl status rustinx     # Check status"
echo "   sudo systemctl restart rustinx    # Restart service"
echo "   sudo systemctl stop rustinx       # Stop service"
echo "   sudo journalctl -u rustinx -f     # View logs"
echo ""
echo "🔐 On first access, you'll need to enter your sudo password"
echo "   to allow nginx management operations."
