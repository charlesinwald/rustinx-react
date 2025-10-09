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
