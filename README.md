# Rustinx
### A simple and easy to use GUI for Nginx.
- View Access and Error Events from Nginx in realtime
- Monitor resource usage and active connections
- Start, stop or restart nginx from the GUI
- Real time monitoring of Nginx configuration validity
- View Nginx state (inactive, active)
<!-- Screenshot -->
![Rustinx](https://i.imgur.com/KzkdGfc.png)

## macOS Installation and Usage Instructions
This application is available as a `.dmg` installer for macOS (Apple Silicon).

### Requirements
- macOS on Apple Silicon
- [Homebrew](https://brew.sh) Nginx (`brew install nginx`)
- Administrator / sudo access (entered in the app login screen)

### Installing the `.dmg`

1. Download `rustinx_0.1.3_aarch64.dmg` from the [GitHub Releases](https://github.com/charlesinwald/rustinx-react/releases) page.
2. Open the `.dmg` and drag **rustinx** into **Applications**.
3. Launch **rustinx** from Applications or Spotlight.

If macOS reports that the app cannot be opened because it is from an unidentified developer:

```bash
xattr -cr /Applications/rustinx.app
```

Then open **rustinx** again, or right-click the app and choose **Open**.

### Using Rustinx on macOS

Install and start Nginx with Homebrew if you have not already:

```bash
brew install nginx
brew services start nginx
```

When the app launches, enter your sudo password on the login screen. This is used for Nginx management; you do not need to run the app itself with `sudo`.

## Linux Installation and Usage Instructions
This application is available as a `.AppImage` and `.deb` package. You can choose the package that is most suitable for your system. Linux builds are currently published on the [v1.0.2](https://github.com/charlesinwald/rustinx-react/releases/tag/v1.0.2) release.
### For `.AppImage` Package

#### Using the `.AppImage` Package

1. Download the `.AppImage` file from the GitHub Releases page.
2. Make the `.AppImage` file executable:
   ```bash
   chmod +x rustinx_0.1.2_amd64.AppImage
   ```
    To run the application, you can use the following command:
    ### Must be run as root!
    ```bash
    sudo ./rustinx_0.1.2_amd64.AppImage
    ```
    ### Accessing the `.AppImage` Easily

    To run the `.AppImage` without navigating to its directory each time, you can create a symbolic link in a directory that is part of your system's `PATH`. Here’s how you can do it:

    1. Move the `.AppImage` to a permanent location, if it's not already in one. For example, you might want to place it in `/opt`:

    ```bash
    sudo mv rustinx_0.1.2_amd64.AppImage /opt/
    sudo ln -s /opt/rustinx_0.1.2_amd64.AppImage /usr/local/bin/rustinx
    ```
    Now you can run the application from anywhere using the command:
    ```bash
    sudo rustinx
    ```
### For `.deb` Package

#### Installing the `.deb` Package

1. Download the `.deb` file from the GitHub Releases page.
2. Open a terminal in the directory where the `.deb` file is downloaded.
3. Install the package using the following command:

   ```bash
   sudo apt-get update
   sudo apt-get install libgtk-3-dev
   sudo dpkg -i rustinx_0.1.2_amd64.deb
   ```
    If there are any missing dependencies, you may need to run:

    ```bash
    sudo apt-get install -f
    ```

    To run the application, you can use the following command:
    ### Must be run as root!
    ```bash
    sudo rustinx
    ```


## Development Instructions

1- install dependencies

```sh
#npm
npm install

#yarn
yarn
```

2- Run the App in development mode:

```sh
#npm
npm run tauri:dev

#yarn
yarn tauri:dev
```

note that the first run will take time as tauri download and compile dependencies.

## Production

run:

```sh
#npm
npm run tauri:build

#yarn
yarn tauri:build
```

On macOS this produces a `.dmg` at `src-tauri/target/release/bundle/dmg/`.

# Windows
- Ensure Visual C++ is installed 
https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170
- Ensure Rust is installed
