import React, { useState, useEffect } from "react";
import "./App.css";
import Logs from "./components/Logs/Logs";
import ControlPanel from "./components/ControlPanel";
import NginxStatus from "./components/Status/Status";
import Sidebar from "./components/Sidebar/Sidebar";
import Config from "./components/Config/Config";
import { invoke } from "@tauri-apps/api/tauri";

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
    { label: "Logs", view: "logs" },
    { label: "Control Panel", view: "controlPanel" },
    { label: "Config Info", view: "configInfo" },
  ];

  if (!isRoot) {
    return (
      <div className="App">
        <div className="error-container">
          <h1>Error: Insufficient Privileges</h1>
          <p>This application needs to be run as root. Please restart with sudo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <Sidebar links={links} onLinkClick={handleLinkClick} currentView={currentView} />
      <div className="main-content" style={{ marginLeft: "250px", padding: "20px" }}>
        {currentView === "logs" && <Logs />}
        {currentView === "controlPanel" && <ControlPanel />}
        {currentView === "configInfo" && <Config />}
      </div>
    </div>
  );
}

export default App;
