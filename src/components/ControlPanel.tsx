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
        Start Nginx
      </button>
      <button className="control-button" onClick={confirmAndRestartNginx}>
        Restart Nginx
      </button>
      <button className="control-button" onClick={confirmAndStopNginx}>
        Stop Nginx
      </button>
      <h2>{restartResponse}</h2>
      <SystemMetrics />
    </div>
  );
}

export default ControlPanel;
