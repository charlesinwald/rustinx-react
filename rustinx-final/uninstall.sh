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
