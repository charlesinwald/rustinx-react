import React, { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import "./Status.css";
function NginxStatus() {
  const [nginxStatus, setNginxStatus] = useState("Checking...");
  const [configEvent, setConfigEvent] = useState("");
  const [nginxConfigPath, setNginxConfigPath] = useState("");

  useEffect(() => {
    const unlistenNginxStatus = listen("nginx_status_check", (event) => {
      console.log("Nginx Status:", event.payload);
      setNginxStatus(event.payload);
    });

    const unlistenConfigCheck = listen("nginx_config_check", (event) => {
      console.log("Nginx Config Check:", event.payload);
      setConfigEvent(event.payload as string);
    });

    return () => {
      unlistenNginxStatus.then((unlistenFn) => unlistenFn());
      unlistenConfigCheck.then((unlistenFn) => unlistenFn());
    };
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case "active":
        return (
          <svg
            className="status-icon"
            width="25"
            height="25"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="12" cy="12" r="12" fill="#8ec07c" />
          </svg>
        );
      case "inactive":
        return (
          <svg
            className="status-icon"
            width="25"
            height="25"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="12" cy="12" r="12" fill="#cc241d" />
          </svg>
        );
      default:
        return <span></span>;
    }
  };

  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  async function fetchNginxConfPath() {
    try {
      const confPath = await invoke<string>("get_nginx_conf_path");
      console.log(`NGINX configuration file path: ${confPath}`);
      setNginxConfigPath(confPath);
    } catch (error) {
      console.error("Error fetching NGINX configuration path:", error);
    }
  }

  async function openFile(filePath: string) {
    try {
      await invoke("open_file", { filePath });
      console.log(`Opened file: ${filePath}`);
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  }

  fetchNginxConfPath();

  return (
    <div className="status-container">
      <div className="online-status">
        <p className="status-text">
          Status: <b>{capitalizeFirstLetter(nginxStatus)}</b>
        </p>
        <div>{getStatusIcon(nginxStatus)}</div>
      </div>
      <h2>{configEvent}</h2>
      <p className="open-file-link" onClick={() => openFile(nginxConfigPath)}>
        Open Config {nginxConfigPath}
      </p>
      <div></div>
    </div>
  );
}

export default NginxStatus;
