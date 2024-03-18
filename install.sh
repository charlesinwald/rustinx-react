#!/bin/bash

# Exit on error
set -e

# Create a system user and group for the service
echo "Creating system user and group 'rustinx'..."
sudo adduser --system --no-create-home --group rustinx

# Define the URL of the service file
SERVICE_URL="https://github.com/charlesinwald/rustinx-react/raw/main/rustinx.service"

# Define the destination directory
DEST_DIR="/etc/systemd/system"

# Download the service file
echo "Downloading the service file..."
sudo wget -O "${DEST_DIR}/rustinx.service" "${SERVICE_URL}"

# Reload systemd to recognize the new service
echo "Reloading systemd..."
sudo systemctl daemon-reload

# Enable and start the service
echo "Enabling and starting the service..."
sudo systemctl enable rustinx.service
sudo systemctl start rustinx.service

echo "Service installed and started successfully."
