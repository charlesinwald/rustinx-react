import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import { Chart, LineElement, PointElement, LinearScale, Title, CategoryScale, Legend, Tooltip } from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import { invoke } from "@tauri-apps/api/tauri";
import "./SystemMetricsGraph.css";

Chart.register(LineElement, PointElement, LinearScale, Title, CategoryScale, Legend, Tooltip, zoomPlugin);

const SystemMetricsGraph: React.FC = () => {
  const [cpuData, setCpuData] = useState<number[]>([]);
  const [ramData, setRamData] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [intervalTime, setIntervalTime] = useState<number>(1000); // Default to 1 second

  useEffect(() => {
    const fetchMetrics = () => {
      invoke<[number, number, number]>("get_system_metrics")
        .then(([cpu, totalMemory, usedMemory]) => {
          const timestamp = new Date().toLocaleTimeString();

          setCpuData((prevData) => [...prevData.slice(-19), cpu]);
          setRamData((prevData) => [
            ...prevData.slice(-19),
            (usedMemory / totalMemory) * 100,
          ]);
          setLabels((prevLabels) => [...prevLabels.slice(-19), timestamp]);
        })
        .catch((error) => console.error("Error fetching system metrics:", error));
    };

    // Fetch metrics based on the selected interval time
    const interval = setInterval(fetchMetrics, intervalTime);

    // Cleanup interval on component unmount or when intervalTime changes
    return () => clearInterval(interval);
  }, [intervalTime]);

  const data = {
    labels: labels,
    datasets: [
      {
        label: "CPU Usage (%)",
        data: cpuData,
        borderColor: "rgba(75,192,192,1)",
        backgroundColor: "rgba(75,192,192,0.2)",
        fill: true,
      },
      {
        label: "RAM Usage (%)",
        data: ramData,
        borderColor: "rgba(255,99,132,1)",
        backgroundColor: "rgba(255,99,132,0.2)",
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
      x: {
        type: 'time',
        time: {
          unit: 'second',
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: "top",
      },
      zoom: {
        pan: {
          enabled: true,
          mode: "x", // Allow panning only in the x-axis
        },
        zoom: {
          wheel: {
            enabled: true, // Enable zooming with the mouse wheel
          },
          pinch: {
            enabled: true, // Enable zooming with pinch gestures
          },
          mode: "x", // Allow zooming only in the x-axis
        },
      },
    },
  };

  const handleGranularityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIntervalTime(parseInt(e.target.value, 10));
  };

  return (
    <div className="graph-container">
      <div className="controls">
        <label htmlFor="granularity">Update Interval: </label>
        <select id="granularity" onChange={handleGranularityChange} value={intervalTime}>
          <option value={1000}>1 Second</option>
          <option value={2000}>2 Seconds</option>
          <option value={5000}>5 Seconds</option>
          <option value={10000}>10 Seconds</option>
        </select>
      </div>
      <Line data={data} options={options} />
    </div>
  );
};

export default SystemMetricsGraph;
