import React from "react";
import { useState, useEffect } from "react";
import "./App.css";
import Logo from "./logo.png";
import { listen } from "@tauri-apps/api/event";

function App() {
  const [event, setEvent] = useState("");

  useEffect(() => {
    // Function to handle the event
    const handleMyEvent = (event: { payload: any }) => {
      console.log("Data from Rust:", event.payload);
      setEvent(event.payload);
    };

    // Start listening for the event
    const unlisten = listen("test_event", handleMyEvent);

    // Cleanup listener on component unmount
    return () => {
      unlisten.then((unlistenFn) => unlistenFn());
    };
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <img src={Logo} className="App-logo" alt="logo" />
        <p>Hello Parcel + React!</p>
        <p></p>
        <p>
          {event === "" ? "Waiting for event from Rust..." : event}
        </p>
      </header>
    </div>
  );
}

export default App;
