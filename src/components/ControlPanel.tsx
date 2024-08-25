import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import SystemMetrics from "./SystemMetrics/SystemMetrics";

function ControlPanel() {
  const [restartResponse, setRestartResponse] = useState("");

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
      .then((response) => console.log("Nginx stopped:", response))
      .catch((error) => console.error("Error stopping Nginx:", error));
  };

  return (
    <div>
      <button className="control-button" onClick={startNginx}>
        {"Start"}{" "}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 64 64"
          width="48"
          height="48"
          fill="#8ec07c"
          className="control-button-icon"
        >
          <circle cx="32" cy="32" r="30" fill="#3c3836" />
          <polygon points="24,16 48,32 24,48" fill="#8ec07c" />
        </svg>
      </button>
      <button className="control-button" onClick={confirmAndRestartNginx}>
        {"Restart"}{" "}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 64 64"
          width="48"
          height="48"
          fill="#8ec07c"
          className="control-button-icon"
        >
          <circle cx="32" cy="32" r="30" fill="#3c3836" />
          <path
            d="M28,18 A14,14 0 1,0 46,32"
            fill="none"
            stroke="#8ec07c"
            stroke-width="6"
          />
          <polygon
            points="46,18 46,32 32,32"
            fill="#8ec07c"
            transform="translate(-6, -6)"
          />
        </svg>
      </button>
      <button className="control-button" onClick={confirmAndStopNginx}>
        {"Stop"}{" "}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 64 64"
          width="48"
          height="48"
          fill="#8ec07c"
          className="control-button-icon"
        >
          <circle cx="32" cy="32" r="30" fill="#3c3836" />
          <rect x="22" y="22" width="20" height="20" fill="#8ec07c" />
        </svg>
      </button>
      <h2>{restartResponse}</h2>
      <SystemMetrics />
    </div>
  );
}

export default ControlPanel;
