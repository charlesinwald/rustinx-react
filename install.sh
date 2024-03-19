#!/bin/bash

# Define the URL of the service file
SERVICE_URL="https://raw.githubusercontent.com/charlesinwald/rustinx-react/main/rustinx.service"

# Define where to save the downloaded service file (temporary location)
TEMP_SERVICE_PATH="/tmp/rustinx.service"

# Download the service file
curl -o "$TEMP_SERVICE_PATH" "$SERVICE_URL"

# Get the current username
USERNAME=$(whoami)

sed -i "s|/username/|/$USERNAME/|g" "$TEMP_SERVICE_PATH"

# Now move the modified service file to the systemd directory
sudo mv "$TEMP_SERVICE_PATH" "/etc/systemd/system/rustinx.service"

# Reload systemd, enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable rustinx.service
sudo systemctl start rustinx.service