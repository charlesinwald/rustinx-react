import React, { useState, useEffect } from "react";
import Logs from "./components/Logs/Logs";
import ControlPanel from "./components/ControlPanel";
import NginxStatus from "./components/Status/Status";
import Sidebar from "./components/Sidebar/Sidebar";
import Config from "./components/Config/Config";
import { invoke } from "@tauri-apps/api/tauri";
import Systemd from "./components/Systemd/Systemd";
import Login from "./components/Login";

function App() {
  const [currentView, setCurrentView] = useState("logs");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuthentication = async () => {
    try {
      const response = await fetch("/api/authenticated");
      setIsAuthenticated(response.ok);
    } catch {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuthentication();
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLinkClick = (link) => {
    setCurrentView(link.view);
  };

  const links = [
    { label: "Access Logs", view: "logs" },
    { label: "Control Panel", view: "controlPanel" },
    { label: "Config Info", view: "configInfo" },
    { label: "System Logs", view: "systemdLogs" },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
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
