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
  Tooltip,
} from "chart.js";
import { invoke } from "@tauri-apps/api/tauri";
import zoomPlugin from "chartjs-plugin-zoom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";

Chart.register(
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Legend,
  Tooltip,
  zoomPlugin
);

const SystemMetricsGraph: React.FC = () => {
  const [cpuData, setCpuData] = useState<number[]>([]);
  const [ramData, setRamData] = useState<number[]>([]);
  const [txData, setTxData] = useState<number[]>([]);
  const [rxData, setRxData] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [intervalTime, setIntervalTime] = useState<number>(5000);
  const [isRelative, setIsRelative] = useState<boolean>(false);

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

    const interval = setInterval(fetchMetrics, intervalTime);
    return () => clearInterval(interval);
  }, [intervalTime, isRelative]);

  const data = {
    labels: labels,
    datasets: [
      {
        label: "CPU Usage",
        data: cpuData,
        borderColor: "hsl(var(--graph-color-1))",
        backgroundColor: "hsla(var(--graph-color-1), 0.2)",
        fill: true,
        tension: 0.1,
      },
      {
        label: "RAM Usage",
        data: ramData,
        borderColor: "hsl(var(--graph-color-2))",
        backgroundColor: "hsla(var(--graph-color-2), 0.2)",
        fill: true,
        tension: 0.1,
      },
      {
        label: "TX Bandwidth (MB)",
        data: txData,
        borderColor: "hsl(var(--graph-color-3))",
        backgroundColor: "hsla(var(--graph-color-3), 0.2)",
        fill: true,
        tension: 0.1,
      },
      {
        label: "RX Bandwidth (MB)",
        data: rxData,
        borderColor: "hsl(var(--graph-color-4))", // Assuming a fourth color variable
        backgroundColor: "hsla(var(--graph-color-4), 0.2)",
        fill: true,
        tension: 0.1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: isRelative ? 100 : undefined,
        title: {
          display: true,
          text: isRelative ? "Percentage (%)" : "Value",
        },
      },
      x: {
        title: {
          display: true,
          text: "Time",
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: "top",
        labels: {
          color: "hsl(var(--foreground))",
        },
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
      },
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          mode: "xy" as const,
        },
        pan: {
          enabled: true,
          mode: "xy" as const,
        },
      },
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="flex items-center gap-2">
          <Label htmlFor="granularity">Update Interval:</Label>
          <Select
            value={intervalTime.toString()}
            onValueChange={(value) => setIntervalTime(parseInt(value, 10))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select interval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1000">1 Second</SelectItem>
              <SelectItem value="2000">2 Seconds</SelectItem>
              <SelectItem value="5000">5 Seconds</SelectItem>
              <SelectItem value="10000">10 Seconds</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="relativeMode"
            checked={isRelative}
            onCheckedChange={setIsRelative}
          />
          <Label htmlFor="relativeMode">Relative Mode</Label>
        </div>
      </div>
      <div className="h-[400px]">
        <Line data={data} options={options} />
      </div>
    </div>
  );
};

export default SystemMetricsGraph;
