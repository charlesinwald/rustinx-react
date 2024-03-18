#!/bin/bash

SERVICE_URL="https://github.com/charlesinwald/rustinx-react/raw/main/rustinx.service"
TEMP_SERVICE_PATH="/tmp/rustinx.service"

echo "Downloading the service file from $SERVICE_URL..."
curl -o "$TEMP_SERVICE_PATH" "$SERVICE_URL"

USERNAME=$(whoami)
HOME_DIR=$(eval echo ~$USERNAME)
SERVICE_PATH="/etc/systemd/system/rustinx.service"

echo "Configuring the service file for user $USERNAME..."
sed "s|/username/|$HOME_DIR/|g" "$TEMP_SERVICE_PATH" | sed "s/myuser/$USERNAME/g" > "$SERVICE_PATH"

# Clean up the temporary file
rm "$TEMP_SERVICE_PATH"

echo "Reloading systemd..."
sudo systemctl daemon-reload

# Unmask the service before enabling and starting
echo "Unmasking the service..."
sudo systemctl unmask rustinx.service

echo "Enabling and starting the rustinx service..."
sudo systemctl enable rustinx.service
sudo systemctl start rustinx.service

echo "Rustinx service installation and startup process complete."
