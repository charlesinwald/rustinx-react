import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import "./Systemd.css";

const Systemd = () => {
  const [logs, setLogs] = useState([]);
  const [serviceName, setServiceName] = useState("nginx.service");
  const [numLines, setNumLines] = useState(100);
  const [noPager, setNoPager] = useState(true);
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [reverse, setReverse] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const output = await invoke("get_systemd_logs", {
        options: {
          service_name: serviceName,
          no_pager: noPager,
          num_lines: numLines,
          since: since || null,
          until: until || null,
          reverse: reverse,
        },
      });
      const parsedLogs = output
        .split("\n")
        .filter((line) => line.trim() !== "");
      setLogs(parsedLogs);
    } catch (err) {
      console.error("Failed to fetch systemd logs:", err);
      setError(typeof err === "string" ? err : "Error fetching logs.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  // Fetch logs on component mount and when dependencies change
  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceName, numLines, noPager, since, until, reverse]);

  // Format datetime-local input to match journalctl expected format
  const formatDateTime = (datetime) => {
    return datetime ? datetime.replace("T", " ") : "";
  };

  return (
    <div className="systemd-container">
      <div className="systemd-header">
        <h2>System Logs for {serviceName}</h2>
        <div className="service-controls">
          <div className="control-group">
            <label htmlFor="service-select">Service:</label>
            <select
              id="service-select"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              className="service-select"
            >
              <option value="nginx.service">nginx</option>
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="num-lines">Lines:</label>
            <input
              id="num-lines"
              type="number"
              min="1"
              value={numLines}
              onChange={(e) => setNumLines(parseInt(e.target.value, 10) || 1)}
              className="num-lines-input"
            />
          </div>

          {process.platform === "linux" ? (
            <>
              <div className="control-group">
                <label htmlFor="since">Since:</label>
                <input
                  id="since"
                  type="datetime-local"
                  value={since}
                  onChange={(e) => setSince(e.target.value)}
                  className="datetime-input"
                />
              </div>

              <div className="control-group">
                <label htmlFor="until">Until:</label>
                <input
                  id="until"
                  type="datetime-local"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  className="datetime-input"
                />
              </div>
            </>
          ) : (
            <div></div>
          )}
          <div className="control-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={noPager}
                onChange={(e) => setNoPager(e.target.checked)}
              />
              <span></span>
              No Pager
            </label>
            {process.platform === "linux" ? (
              <label>
                <input
                  type="checkbox"
                  checked={reverse}
                  onChange={(e) => setReverse(e.target.checked)}
                />
                <span></span>
                Reverse Order
              </label>
            ) : (
              <div></div>
            )}
          </div>

          <div className="control-group button-group">
            <button
              onClick={fetchLogs}
              className="refresh-button"
              disabled={loading}
            >
              {loading ? (
                "..."
              ) : ("Refresh")
                }
            </button>

            <button onClick={clearLogs} className="clear-button">
              Clear
            </button>
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="systemd-logs-output">
        {logs.length > 0 ? (
          logs.map((log, index) => (
            <div key={index} className="log-entry">
              {log}
            </div>
          ))
        ) : (
          <div className="no-logs">No logs available.</div>
        )}
      </div>
    </div>
  );
};

export default Systemd;
