import React, { useState, useEffect } from "react";
import Logs from "./components/Logs/Logs";
import ControlPanel from "./components/ControlPanel";
import NginxStatus from "./components/Status/Status";
import Sidebar from "./components/Sidebar/Sidebar";
import Config from "./components/Config/Config";
import { invoke } from "@tauri-apps/api/tauri";
import Systemd from "./components/Systemd/Systemd";

function App() {
  const [currentView, setCurrentView] = useState("logs");
  const [isRoot, setIsRoot] = useState(true);

  useEffect(() => {
    // Check if the app is running as root
    invoke("check_sudo_status")
      .then((rootStatus) => {
        setIsRoot(rootStatus);
      })
      .catch((error) => {
        console.error("Failed to check root status:", error);
        setIsRoot(false);
      });
  }, []);

  const handleLinkClick = (link) => {
    setCurrentView(link.view);
  };

  const links = [
    { label: "Access Logs", view: "logs" },
    { label: "Control Panel", view: "controlPanel" },
    { label: "Config Info", view: "configInfo" },
    { label: "System Logs", view: "systemdLogs" },
  ];

  if (!isRoot) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground">
        <div className="text-center p-12 bg-card text-card-foreground rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold text-destructive mb-4">Error: Insufficient Privileges</h1>
          <p className="text-lg">This application needs to be run as root. Please restart with sudo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar links={links} onLinkClick={handleLinkClick} currentView={currentView} />
      <div className="flex-1 overflow-y-auto p-6">
        {currentView === "logs" && <Logs />}
        {currentView === "controlPanel" && <ControlPanel />}
        {currentView === "configInfo" && <Config />}
        {currentView === "systemdLogs" && <Systemd />}
      </div>
    </div>
  );
}

export default App;
