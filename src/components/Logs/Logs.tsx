import React, { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import "./Logs.css";

function Logs() {
  const [accessEvent, setAccessEvent] = useState("");
  const [errorEvent, setErrorEvent] = useState("");
  const [searchQuery, setSearchQuery] = useState(""); // State for search query
  const [rawMode, setRawMode] = useState(false); // State for raw mode

  useEffect(() => {
    const handleAccessEvent = (event) => {
      setAccessEvent((prevEvent) => prevEvent + "\n" + event.payload);
    };

    const handleErrorEvent = (event) => {
      setErrorEvent((prevEvent) => prevEvent + "\n" + event.payload);
    };

    const unlistenAccess = listen("access_event", handleAccessEvent);
    const unlistenError = listen("error_event", handleErrorEvent);

    return () => {
      unlistenAccess.then((unlistenFn) => unlistenFn());
      unlistenError.then((unlistenFn) => unlistenFn());
    };
  }, []);

  // Function to handle search query changes
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Function to filter logs based on the search query
  const filterLogs = (logs) => {
    if (!searchQuery) return logs;
    return logs
      .split("\n")
      .filter((log) => log.toLowerCase().includes(searchQuery.toLowerCase()))
      .join("\n");
  };

  // Function to copy log text to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  // Function to format logs for readability
  const formatLog = (log) => {
    const logParts = log.match(
      /(\S+) - - \[(.+?)\] "(\S+) (.+?) (.+?)" (\d+) (\d+) "(.*?)" "(.*?)"/
    );
    if (!logParts) return log;

    const [
      _,
      ipAddress,
      timestamp,
      method,
      path,
      protocol,
      statusCode,
      responseSize,
      referrer,
      userAgent,
    ] = logParts;

    return (
      <div className="log-entry">
        <button
          className="copy-button"
          onClick={() => copyToClipboard(log)}
          title="Copy to clipboard"
        >
          Copy
        </button>
        <div>
          <strong>IP Address:</strong> {ipAddress}
        </div>
        <div>
          <strong>Date and Time:</strong> {timestamp}
        </div>
        <div>
          <strong>Request:</strong> {method} {path} ({protocol})
        </div>
        <div>
          <strong>Status Code:</strong> {statusCode}
        </div>
        <div>
          <strong>Response Size:</strong> {responseSize} bytes
        </div>
        <div>
          <strong>Referrer:</strong> {referrer}
        </div>
        <div>
          <strong>User-Agent:</strong> {userAgent}
        </div>
      </div>
    );
  };

  // Function to toggle between raw and formatted mode
  const handleToggleRawMode = () => {
    setRawMode(!rawMode);
  };

  return (
    <div className="logs-wrapper">
      <div className="logs-header">
        <div />
        <input
          type="text"
          placeholder="Search logs..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="search-input"
        />
        <button onClick={handleToggleRawMode} className="toggle-button">
          {rawMode ? "Switch to Formatted Mode" : "Switch to Raw Mode"}
        </button>
      </div>
      <div className="logs-container">
        <div className="log-container">
          <h2 className="log-title">Access Events</h2>
          <div className="log">
            {accessEvent === ""
              ? "Waiting for access events from Nginx..."
              : rawMode
              ? filterLogs(accessEvent)
                  .split("\n")
                  .map((log, index) => <div key={index}>{log}</div>)
              : filterLogs(accessEvent)
                  .split("\n")
                  .map((log, index) => <div key={index}>{formatLog(log)}</div>)}
          </div>
        </div>
        <div className="log-container">
          <h2 className="log-title">Error Events</h2>
          <div className="log">
            {errorEvent === ""
              ? "Waiting for error events from Nginx..."
              : rawMode
              ? filterLogs(errorEvent)
                  .split("\n")
                  .map((log, index) => <div key={index}>{log}</div>)
              : filterLogs(errorEvent)
                  .split("\n")
                  .map((log, index) => <div key={index}>{formatLog(log)}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Logs;
