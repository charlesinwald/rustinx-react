#!/bin/bash

# Resolve the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Set the absolute path to the application
APP_PATH="$SCRIPT_DIR/rustinx.app/Contents/MacOS/rustinx"
LINK_NAME="rustinx"

if [ ! -e "$APP_PATH" ]; then
    echo "Error: App executable not found at $APP_PATH"
    exit 1
fi

# Create symlink in /usr/local/bin
sudo ln -sf "$APP_PATH" /usr/local/bin/"$LINK_NAME"

echo "Symlink created. You can now run the app using 'sudo $LINK_NAME'."
