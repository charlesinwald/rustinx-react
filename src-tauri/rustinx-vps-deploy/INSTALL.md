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
