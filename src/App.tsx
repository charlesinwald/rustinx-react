import React, { useState } from "react";
import "./App.css";
import Logs from "./components/Logs/Logs";
import ControlPanel from "./components/ControlPanel";
import NginxStatus from "./components/Status/Status";
import Sidebar from "./components/Sidebar/Sidebar";
import Config from "./components/Config/Config";

function App() {
  const [currentView, setCurrentView] = useState("logs");

  const handleLinkClick = (link) => {
    setCurrentView(link.view);
  };

  const links = [
    { label: "Logs", view: "logs" },
    { label: "Control Panel", view: "controlPanel" },
    { label: "Config Info", view: "configInfo" },
  ];

  return (
    <div className="App">
      <Sidebar links={links} onLinkClick={handleLinkClick} currentView={currentView} />
      <div
        className="main-content"
        style={{ marginLeft: "250px", padding: "20px" }}
      >
        {currentView === "logs" && <Logs />}
        {currentView === "controlPanel" && <ControlPanel />}
        {currentView === "configInfo" && <Config />}
      </div>
    </div>
  );
}

export default App;
