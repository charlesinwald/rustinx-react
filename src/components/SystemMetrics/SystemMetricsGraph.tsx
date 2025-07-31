import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Legend,
} from "chart.js";
import { invoke } from "@tauri-apps/api/tauri";

import zoomPlugin from "chartjs-plugin-zoom";

Chart.register(
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Legend,
  zoomPlugin
);

const SystemMetricsGraph: React.FC = () => {
  const [cpuData, setCpuData] = useState<number[]>([]);
  const [ramData, setRamData] = useState<number[]>([]);
  const [txData, setTxData] = useState<number[]>([]); // Transmitted bandwidth data
  const [rxData, setRxData] = useState<number[]>([]); // Received bandwidth data
  const [labels, setLabels] = useState<string[]>([]);
  const [intervalTime, setIntervalTime] = useState<number>(5000); // Default to 5 seconds
  const [isRelative, setIsRelative] = useState<boolean>(false); // Toggle for relative or absolute values

  useEffect(() => {
    const fetchMetrics = () => {
      invoke<[number, number, number, number, number, number]>("get_system_metrics")
        .then(([cpu, totalMemory, usedMemory, tasks, txBytes, rxBytes]) => {
          const timestamp = new Date().toLocaleTimeString();

          const newCpuValue = isRelative
            ? (cpu / Math.max(...cpuData, cpu)) * 100
            : cpu;
          const newRamValue = isRelative
            ? ((usedMemory / totalMemory) / Math.max(...ramData, (usedMemory / totalMemory) * 100)) * 100
            : (usedMemory / totalMemory) * 100;
          const newTxValue = isRelative
            ? (txBytes / Math.max(...txData, txBytes)) * 100
            : txBytes / (1024 * 1024); // Convert to MB
          const newRxValue = isRelative
            ? (rxBytes / Math.max(...rxData, rxBytes)) * 100
            : rxBytes / (1024 * 1024); // Convert to MB

          setCpuData((prevData) => [...prevData.slice(-19), newCpuValue]);
          setRamData((prevData) => [...prevData.slice(-19), newRamValue]);
          setTxData((prevData) => [...prevData.slice(-19), newTxValue]);
          setRxData((prevData) => [...prevData.slice(-19), newRxValue]);
          setLabels((prevLabels) => [...prevLabels.slice(-19), timestamp]);
        })
        .catch((error) =>
          console.error("Error fetching system metrics:", error)
        );
    };

    // Fetch metrics based on the selected interval time
    const interval = setInterval(fetchMetrics, intervalTime);

    // Cleanup interval on component unmount or when intervalTime or isRelative changes
    return () => clearInterval(interval);
  }, [intervalTime, isRelative]);

  const data = {
    labels: labels,
    datasets: [
      {
        borderColor: "hsl(var(--graph-color-1))",
        backgroundColor: "hsla(var(--graph-color-1), 0.2)",
        fill: true,
      },
      {
        borderColor: "hsl(var(--graph-color-2))",
        backgroundColor: "hsla(var(--graph-color-2), 0.2)",
        fill: true,
      },
      {
        borderColor: "hsl(var(--graph-color-3))",
        backgroundColor: "hsla(var(--graph-color-3), 0.2)",
        fill: true,
      },
      {
        borderColor: "hsl(var(--graph-color-1))",
        backgroundColor: "hsla(var(--graph-color-1), 0.2)",
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
      },
    },
    plugins: {
      legend: {
        display: true,
        position: "top",
      },
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          mode: "y",
        },
      },
    },
  };

  const handleGranularityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIntervalTime(parseInt(e.target.value, 10));
  };

  const handleModeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsRelative(e.target.checked);
  };

  return (
    <div className="graph-container">
      <div className="controls">
        <label htmlFor="granularity">Update Interval: </label>
        <select
          id="granularity"
          onChange={handleGranularityChange}
          value={intervalTime}
        >
          <option value={1000}>1 Second</option>
          <option value={2000}>2 Seconds</option>
          <option value={5000}>5 Seconds</option>
          <option value={10000}>10 Seconds</option>
        </select>
        <label htmlFor="relativeMode">
          <input
            type="checkbox"
            id="relativeMode"
            checked={isRelative}
            onChange={handleModeChange}
          />
          Relative Mode
        </label>
      </div>
      <Line data={data} options={options} />
    </div>
  );
};

export default SystemMetricsGraph;
