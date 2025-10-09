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
