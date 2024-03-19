# Rustinx
### A simple and easy to use GUI for Nginx.
<!-- Screenshot -->
![Rustinx](https://i.imgur.com/ty9oqBo.png)
## Linux Installation and Usage Instructions
This application is available as a `.AppImage` and `.deb` package. You can choose the package that is most suitable for your system.
### For `.AppImage` Package

#### Using the `.AppImage` Package

1. Download the `.AppImage` file from the GitHub Releases page.
2. Make the `.AppImage` file executable:
   ```bash
   chmod +x rustinx_0.1.0_amd64.AppImage
   ```
    To run the application, you can use the following command:
    ### Must be run as root!
    ```bash
    sudo ./rustinx_0.1.0_amd64.AppImage
    ```
    ### Accessing the `.AppImage` Easily

    To run the `.AppImage` without navigating to its directory each time, you can create a symbolic link in a directory that is part of your system's `PATH`. Here’s how you can do it:

    1. Move the `.AppImage` to a permanent location, if it's not already in one. For example, you might want to place it in `/opt`:

    ```bash
    sudo mv rustinx_0.1.0_amd64.AppImage /opt/
    sudo ln -s /opt/rustinx_0.1.0_amd64.AppImage /usr/local/bin/rustinx
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
   sudo dpkg -i rustinx_0.1.0_amd64.deb
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
