import React, { useState, useEffect } from "react";
import "./SystemMetrics.css";
import { invoke } from "@tauri-apps/api/tauri";
import SystemMetricsGraph from "./SystemMetricsGraph";

const SystemMetrics: React.FC = () => {
  const [cpuUsage, setCpuUsage] = useState<number>(0);
  const [totalMemory, setTotalMemory] = useState<number>(0);
  const [usedMemory, setUsedMemory] = useState<number>(0);
  const [tasks, setTasks] = useState<number>(0);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const [cpu, totalMem, usedMem, tasks] = await invoke<[number, number, number, number]>("get_system_metrics");
        setCpuUsage(cpu);
        setTotalMemory(totalMem);
        setUsedMemory(usedMem);
        setTasks(tasks);
      } catch (error) {
        console.error("Failed to fetch system metrics:", error);
      }
    };

    // Fetch metrics every second
    const interval = setInterval(fetchMetrics, 1000);

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="metrics-container">
      <h2 className="metrics-title">NGINX System Metrics</h2>
      <div className="metric">
        <h3>CPU Usage</h3>
        <p>{cpuUsage.toFixed(2)}%</p>
      </div>
      <div className="metric">
        <h3>Memory Usage</h3>
        <p>{((usedMemory / totalMemory) * 100).toFixed(2)}% ({usedMemory / 1024} MB / {totalMemory / 1024} MB)</p>
      </div>
      <div className="metric">
        <h3>Active Tasks/Workers</h3>
        <p>{tasks}</p>
      </div>
      <SystemMetricsGraph />
    </div>
  );
};

export default SystemMetrics;
