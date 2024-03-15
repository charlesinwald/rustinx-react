import React from "react";
import { useState, useEffect } from "react";
import "./App.css";
import Logo from "./logo.png";
import { listen } from "@tauri-apps/api/event";

function App() {
  const [accessEvent, setAccessEvent] = useState("");
  const [errorEvent, setErrorEvent] = useState("");
  const [configEvent, setConfigEvent] = useState("");

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
    return () => {
      unlistenAccess.then((unlistenFn) => unlistenFn());
      unlistenError.then((unlistenFn) => unlistenFn());
      unlistenConfigCheck.then((unlistenFn) => unlistenFn());
    };
  }, []);

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
        <button className="control-button" onClick={() => {}}>
          Restart Nginx
        </button>
        <h2>{configEvent}</h2>
      </div>
    </div>
  );
}

export default App;
