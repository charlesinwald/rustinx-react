import React from "react";
import { useState, useEffect } from "react";
import "./App.css";
import Logo from "./logo.png";
import { listen } from "@tauri-apps/api/event";

function App() {
  const [accessEvent, setAccessEvent] = useState("");
  const [errorEvent, setErrorEvent] = useState("");

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

    return () => {
      unlistenAccess.then((unlistenFn) => unlistenFn());
      unlistenError.then((unlistenFn) => unlistenFn());
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
    </div>
  );
}

export default App;
