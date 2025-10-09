#!/bin/bash

# Build final deployment package with regular dependencies

set -e

echo "🔨 Building final Rustinx deployment package..."

# Go to root directory
cd /home/charles/Code/rustinx-react

# Build frontend
echo "📦 Building frontend..."
yarn run build

# Build web-server
echo "🦀 Building web-server binary..."
cd src-tauri
cargo build --bin web-server --release
cd ..

# Check binary
BINARY="src-tauri/target/release/web-server"
echo "🔍 Binary info:"
file $BINARY
ls -lh $BINARY

# Create final deployment package
echo "🚀 Creating final deployment package..."

mkdir -p rustinx-final
cp $BINARY rustinx-final/web-server
cp -r dist rustinx-final/

# Create startup script
cat > rustinx-final/start.sh << 'EOF'
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
EOF
chmod +x rustinx-final/start.sh

# Create installation script
cat > rustinx-final/install.sh << 'EOF'
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
EOF
chmod +x rustinx-final/install.sh

# Create README
cat > rustinx-final/README.md << 'EOF'
# 🚀 Rustinx - Nginx Dashboard

A modern, web-based dashboard for monitoring and managing Nginx servers.

## ✨ Features

- 📊 **Real-time System Metrics** - CPU, memory, and process monitoring
- 🌐 **Nginx Control** - Start, stop, restart nginx services
- 📝 **Live Logs** - View nginx and systemd logs in real-time
- 🔐 **Secure Access** - Password-protected sudo operations
- 📱 **Responsive Design** - Works on desktop and mobile
- ⚡ **Fast & Lightweight** - Built with Rust and React

## 🚀 Quick Install

```bash
# Extract and install
tar -xzf rustinx-final.tar.gz
cd rustinx-final
sudo ./install.sh
```

Access at: `http://your-server-ip:8081`

## 📋 Manual Setup

### Requirements
- Linux x86_64 (Ubuntu 18.04+, Debian 9+, CentOS 7+)
- Root/sudo access
- Port 8081 available
- Nginx installed (for management features)

### Manual Start
```bash
sudo ./start.sh
```

### Service Management
```bash
sudo systemctl status rustinx     # Check status
sudo systemctl restart rustinx    # Restart
sudo systemctl stop rustinx       # Stop
sudo journalctl -u rustinx -f     # View logs
```

### Firewall Setup
```bash
# Ubuntu/Debian
sudo ufw allow 8081

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=8081/tcp
sudo firewall-cmd --reload

# Manual iptables
sudo iptables -I INPUT -p tcp --dport 8081 -j ACCEPT
```

## 🔧 Configuration

The dashboard runs on port 8081 by default. On first access:

1. You'll be prompted for your sudo password
2. This enables nginx service management
3. Password is stored securely in memory only

## 🛠️ Troubleshooting

### Service Not Starting
```bash
sudo journalctl -u rustinx -e
```

### Port Already in Use
```bash
sudo netstat -tlnp | grep 8081
# Kill process using port 8081 if needed
```

### Permission Issues
```bash
sudo chown -R root:rustinx /opt/rustinx
sudo chmod -R 755 /opt/rustinx
```

### Nginx Not Found
```bash
# Install nginx
sudo apt update && sudo apt install nginx  # Ubuntu/Debian
sudo yum install nginx                      # CentOS/RHEL
```

## 📝 Logs

Application logs are available via journald:
```bash
sudo journalctl -u rustinx -f --no-pager
```

## 🔄 Updates

To update Rustinx:
1. Stop the service: `sudo systemctl stop rustinx`
2. Replace files in `/opt/rustinx/`
3. Start the service: `sudo systemctl start rustinx`

## 📞 Support

- Check system requirements
- Verify nginx is installed
- Ensure port 8081 is not in use
- Check firewall settings
- Review service logs

---

Built with ❤️ using Rust + React
EOF

# Create uninstall script
cat > rustinx-final/uninstall.sh << 'EOF'
#!/bin/bash

echo "🗑️  Uninstalling Rustinx..."

# Stop and disable service
sudo systemctl stop rustinx 2>/dev/null || true
sudo systemctl disable rustinx 2>/dev/null || true

# Remove service file
sudo rm -f /etc/systemd/system/rustinx.service

# Remove application files
sudo rm -rf /opt/rustinx

# Remove user (optional)
read -p "Remove rustinx user? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo userdel rustinx 2>/dev/null || true
fi

# Reload systemd
sudo systemctl daemon-reload

echo "✅ Rustinx uninstalled"
EOF
chmod +x rustinx-final/uninstall.sh

# Create the final package
tar -czf rustinx-final.tar.gz rustinx-final/

echo ""
echo "🎉 FINAL BUILD COMPLETE!"
echo ""
echo "📦 Package created: rustinx-final.tar.gz"
echo "📁 Directory: rustinx-final/"
echo ""
echo "🔍 Binary info:"
file $BINARY
ls -lh $BINARY
echo ""
echo "📤 **TO DEPLOY ON YOUR VPS:**"
echo ""
echo "1. Upload package:"
echo "   scp rustinx-final.tar.gz user@your-vps:/tmp/"
echo ""
echo "2. Install on VPS:"
echo "   ssh user@your-vps"
echo "   cd /tmp"
echo "   tar -xzf rustinx-final.tar.gz"
echo "   cd rustinx-final"
echo "   sudo ./install.sh"
echo ""
echo "3. Access dashboard:"
echo "   http://your-vps-ip:8081"
echo ""
echo "💡 This build should work on Ubuntu 18.04+ and most modern Linux systems."
echo "   If you still get glibc errors, your VPS may be using a very old distribution."
echo "   Consider upgrading to Ubuntu 20.04+ or Debian 10+."