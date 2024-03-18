import React from "react";
import { useState, useEffect } from "react";
import "./App.css";
import Logo from "./logo.png";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";

function App() {
  const [accessEvent, setAccessEvent] = useState("");
  const [errorEvent, setErrorEvent] = useState("");
  const [configEvent, setConfigEvent] = useState("");
  const [restartResponse, setRestartResponse] = useState("");
  const [stopResponse, setStopResponse] = useState("");
  const [nginxStatus, setNginxStatus] = useState("Checking...");

  useEffect(() => {
    const handleAccessEvent = (event) => {
      console.log("Access Log from Rust:", event.payload);
      setAccessEvent((prevEvent) => prevEvent + "\n" + event.payload);
    };

    const handleErrorEvent = (event) => {
      console.log("Error Log from Rust:", event.payload);
      setErrorEvent((prevEvent) => prevEvent + "\n" + event.payload);
    };

    const unlistenAccess = listen("access_event", handleAccessEvent);
    const unlistenError = listen("error_event", handleErrorEvent);
    const unlistenConfigCheck = listen("nginx_config_check", (event) => {
      console.log("Nginx Config Check:", event.payload);
      setConfigEvent(event.payload as string);
    });
    const unlistenNginxStatus = listen("nginx_status_check", (event) => {
      console.log("Nginx Status:", event.payload);
      setNginxStatus(event.payload);
    });
    return () => {
      unlistenAccess.then((unlistenFn) => unlistenFn());
      unlistenError.then((unlistenFn) => unlistenFn());
      unlistenConfigCheck.then((unlistenFn) => unlistenFn());
      unlistenNginxStatus.then((unlistenFn) => unlistenFn());
    };
  }, []);

  const confirmAndRestartNginx = async () => {
    if (await window.confirm("Are you sure you want to restart Nginx?")) {
      restartNginx();
    }
  };

  const confirmAndStopNginx = async () => {
    if (await window.confirm("Are you sure you want to stop Nginx?")) {
      stopNginx();
    }
  };

  const startNginx = async () => {
    invoke("start_nginx")
      .then((response) => console.log("Nginx started:", response))
      .catch((error) => console.error("Error starting Nginx:", error));
  };

  const restartNginx = async () => {
    invoke("restart_nginx")
      .then((response) => setRestartResponse(response))
      .catch((error) => console.error("Error restarting Nginx:", error));
  };

  const stopNginx = async () => {
    invoke("stop_nginx")
      .then((response) => setStopResponse(response))
      .catch((error) => console.error("Error stopping Nginx:", error));
  };

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
        return <span>Checking...</span>;
    }
  };

  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="log-container">
          <h2 className="log-title">Access Events</h2>
          <p className="log">
            {accessEvent === ""
              ? "Waiting for access events from Rust..."
              : accessEvent}
          </p>
        </div>
        <div className="log-container">
          <h2 className="log-title">Error Events</h2>
          <p className="log">
            {errorEvent === ""
              ? "Waiting for error events from Rust..."
              : errorEvent}
          </p>
        </div>
      </header>
      <div className="bottom-bar">
        <button className="control-button" onClick={startNginx}>
          Start Nginx
        </button>
        <button className="control-button" onClick={confirmAndRestartNginx}>
          Restart Nginx
        </button>
        <button className="control-button" onClick={confirmAndStopNginx}>
          Stop Nginx
        </button>
        <h2>{restartResponse}</h2>
        <h2>{configEvent}</h2>
        <div className="status-container">
          <p className="status-text">Status: {capitalizeFirstLetter(nginxStatus)}</p>
          <div>{getStatusIcon(nginxStatus)}</div>
        </div>
      </div>
    </div>
  );
}

export default App;
