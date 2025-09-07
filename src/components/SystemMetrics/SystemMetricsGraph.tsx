import type React from "react";
import { useState, useEffect, useCallback, useMemo, memo } from "react";
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
  Filler,
} from "chart.js";
import { invoke } from "@tauri-apps/api/tauri";
import zoomPlugin from "chartjs-plugin-zoom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { useToast } from "../../hooks/use-toast";
import {
  TrendingUp,
  Pause,
  Play,
  RotateCcw,
  Download,
  Activity,
  Cpu,
  MemoryStick,
  Wifi,
  Clock,
} from "lucide-react";
import { cn } from "../../lib/utils";

Chart.register(
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Legend,
  Tooltip,
  Filler,
  zoomPlugin
);

interface MetricData {
  cpu: number[];
  ram: number[];
  tx: number[];
  rx: number[];
  labels: string[];
}

interface SystemMetric {
  cpu: number;
  totalMemory: number;
  usedMemory: number;
  tasks: number;
  txBytes: number;
  rxBytes: number;
}

const INTERVAL_OPTIONS = [
  { value: "1000", label: "1 Second", icon: "⚡" },
  { value: "2000", label: "2 Seconds", icon: "🔥" },
  { value: "5000", label: "5 Seconds", icon: "⭐" },
  { value: "10000", label: "10 Seconds", icon: "🕐" },
  { value: "30000", label: "30 Seconds", icon: "⏰" },
];

const MAX_DATA_POINTS = 50;

const SystemMetricsGraph: React.FC = memo(() => {
  const [metricData, setMetricData] = useState<MetricData>({
    cpu: [],
    ram: [],
    tx: [],
    rx: [],
    labels: [],
  });
  const [intervalTime, setIntervalTime] = useState<number>(10000); // Changed default to 10 seconds
  const [isRelative, setIsRelative] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [currentMetrics, setCurrentMetrics] = useState<SystemMetric | null>(
    null
  );
  const { toast } = useToast();

  const fetchMetrics = useCallback(async () => {
    if (isPaused) return;

    try {
      let cpu, totalMemory, usedMemory, tasks, txBytes, rxBytes, workerCount;

      // Check if we're running in Tauri context
      if (typeof window !== 'undefined' && window.__TAURI_IPC__) {
        [cpu, totalMemory, usedMemory, tasks, workerCount, txBytes, rxBytes] = 
          await invoke<[number, number, number, number, number, number, number]>(
            "get_system_metrics"
          );
      } else {
        // Running in browser mode - use HTTP API
        const response = await fetch('/api/system-metrics', {
          method: 'GET',
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          cpu = data.cpu;
          totalMemory = data.totalMemory;
          usedMemory = data.usedMemory;
          tasks = data.tasks;
          workerCount = data.workerCount;
          txBytes = data.txBytes;
          rxBytes = data.rxBytes;
        } else {
          throw new Error(`HTTP API error: ${response.statusText}`);
        }
      }

      const timestamp = new Date().toLocaleTimeString();
      const currentTime = new Date();

      // Store current metrics for display
      setCurrentMetrics({
        cpu,
        totalMemory,
        usedMemory,
        tasks,
        txBytes,
        rxBytes,
      });

      // Calculate values based on mode
      const ramPercentage = (usedMemory / totalMemory) * 100;
      const txMB = txBytes / (1024 * 1024);
      const rxMB = rxBytes / (1024 * 1024);

      setMetricData((prevData) => {
        let newCpuValue = cpu;
        let newRamValue = ramPercentage;
        let newTxValue = txMB;
        let newRxValue = rxMB;

        if (isRelative && prevData.cpu.length > 0) {
          const maxCpu = Math.max(...prevData.cpu, cpu);
          const maxRam = Math.max(...prevData.ram, ramPercentage);
          const maxTx = Math.max(...prevData.tx, txMB);
          const maxRx = Math.max(...prevData.rx, rxMB);

          newCpuValue = maxCpu > 0 ? (cpu / maxCpu) * 100 : 0;
          newRamValue = maxRam > 0 ? (ramPercentage / maxRam) * 100 : 0;
          newTxValue = maxTx > 0 ? (txMB / maxTx) * 100 : 0;
          newRxValue = maxRx > 0 ? (rxMB / maxRx) * 100 : 0;
        }

        return {
          cpu: [...prevData.cpu.slice(-(MAX_DATA_POINTS - 1)), newCpuValue],
          ram: [...prevData.ram.slice(-(MAX_DATA_POINTS - 1)), newRamValue],
          tx: [...prevData.tx.slice(-(MAX_DATA_POINTS - 1)), newTxValue],
          rx: [...prevData.rx.slice(-(MAX_DATA_POINTS - 1)), newRxValue],
          labels: [...prevData.labels.slice(-(MAX_DATA_POINTS - 1)), timestamp],
        };
      });

      setLastUpdate(currentTime);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching system metrics:", error);
      toast({
        title: "Error",
        description: "Failed to fetch system metrics",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  }, [isPaused, isRelative, toast]);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(fetchMetrics, intervalTime);
    return () => clearInterval(interval);
  }, [fetchMetrics, intervalTime, isPaused]);

  // Initial fetch
  useEffect(() => {
    fetchMetrics();
  }, []);

  const resetChart = () => {
    setMetricData({
      cpu: [],
      ram: [],
      tx: [],
      rx: [],
      labels: [],
    });
    setIsLoading(true);
    toast({
      title: "Chart Reset",
      description: "Chart data has been cleared",
    });
  };

  const exportData = () => {
    const csvContent = [
      ["Time", "CPU (%)", "RAM (%)", "TX (MB)", "RX (MB)"],
      ...metricData.labels.map((label, index) => [
        label,
        metricData.cpu[index]?.toFixed(2) || "0",
        metricData.ram[index]?.toFixed(2) || "0",
        metricData.tx[index]?.toFixed(2) || "0",
        metricData.rx[index]?.toFixed(2) || "0",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-metrics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "System metrics data exported successfully",
    });
  };

  // Memoize chart data to prevent unnecessary re-renders
  const chartData = useMemo(
    () => ({
      labels: metricData.labels,
      datasets: [
        {
          label: "CPU Usage",
          data: metricData.cpu,
          borderColor: "rgb(209, 120, 100)",
          backgroundColor: "rgba(209, 120, 100, 0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
        {
          label: "RAM Usage",
          data: metricData.ram,
          borderColor: "rgb(40, 148, 120)",
          backgroundColor: "rgba(40, 148, 120, 0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
        {
          label: "TX Bandwidth",
          data: metricData.tx,
          borderColor: "rgb(39, 80, 97)",
          backgroundColor: "rgba(39, 80, 97, 0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
        {
          label: "RX Bandwidth",
          data: metricData.rx,
          borderColor: "rgb(209, 179, 67)",
          backgroundColor: "rgba(209, 179, 67, 0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
      ],
    }),
    [metricData]
  );

  // Memoize chart options to prevent recreation on every render
  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index" as const,
        intersect: false,
      },
      scales: {
        y: {
          beginAtZero: true,
          max: isRelative ? 100 : undefined,
          title: {
            display: true,
            text: isRelative ? "Relative (%)" : "Value",
            color: "#ebdbb2",
          },
          grid: {
            color: "#3c3836",
          },
          ticks: {
            color: "#ebdbb2",
            callback: function (value: any) {
              if (isRelative) return `${value}%`;
              return value;
            },
          },
        },
        x: {
          title: {
            display: true,
            text: "Time",
            color: "#ebdbb2",
          },
          grid: {
            color: "#282828",
          },
          ticks: {
            color: "#ebdbb2",
            maxTicksLimit: 10,
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
          labels: {
            color: "#ebdbb2",
            usePointStyle: true,
            padding: 20,
          },
        },
        tooltip: {
          mode: "index" as const,
          intersect: false,
          backgroundColor: "#3c3836",
          titleColor: "#ebdbb2",
          bodyColor: "#ebdbb2",
          borderColor: "#3c3836",
          borderWidth: 1,
          callbacks: {
            label: function (context: any) {
              let label = context.dataset.label || "";
              if (label) {
                label += ": ";
              }
              if (isRelative) {
                label += `${context.parsed.y.toFixed(1)}%`;
              } else {
                if (context.dataset.label?.includes("Bandwidth")) {
                  label += `${context.parsed.y.toFixed(2)} MB`;
                } else {
                  label += `${context.parsed.y.toFixed(1)}%`;
                }
              }
              return label;
            },
          },
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
      animation: {
        duration: 200, // Reduced from 750ms to 200ms
        easing: "easeOutQuart" as const,
      },
    }),
    [isRelative]
  );

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const formatMB = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Current Metrics Cards */}
      {currentMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="flex items-center p-4">
              <Cpu className="h-8 w-8 text-blue-500 mr-3" />
              <div>
                <p className="text-sm font-medium">CPU Usage</p>
                <p className="text-2xl font-bold">
                  {currentMetrics.cpu.toFixed(1)}%
                </p>
                <p className="text-xs">Active Tasks: {currentMetrics.tasks}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-4">
              <MemoryStick className="h-8 w-8 text-purple-500 mr-3" />
              <div>
                <p className="text-sm font-medium">RAM Usage</p>
                <p className="text-2xl font-bold">
                  {(
                    (currentMetrics.usedMemory / currentMetrics.totalMemory) *
                    100
                  ).toFixed(1)}
                  %
                </p>
                <p className="text-xs">
                  {formatBytes(currentMetrics.usedMemory)} /{" "}
                  {formatBytes(currentMetrics.totalMemory)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-4">
              <TrendingUp className="h-8 w-8 text-green-500 mr-3" />
              <div>
                <p className="text-sm font-medium">TX Bandwidth</p>
                <p className="text-2xl font-bold">
                  {formatMB(currentMetrics.txBytes)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-4">
              <Wifi className="h-8 w-8 text-cyan-500 mr-3" />
              <div>
                <p className="text-sm font-medium">RX Bandwidth</p>
                <p className="text-2xl font-bold">
                  {formatMB(currentMetrics.rxBytes)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Chart Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Performance Monitor
              </CardTitle>
              <CardDescription>
                Real-time system metrics visualization with interactive controls
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {lastUpdate && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {lastUpdate.toLocaleTimeString()}
                </Badge>
              )}
              {isPaused && (
                <Badge variant="secondary" className="text-xs">
                  Paused
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Controls */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              {/* Update Interval */}
              <div className="flex items-center gap-2">
                <Label htmlFor="interval" className="text-sm font-medium">
                  Update Interval:
                </Label>
                <Select
                  value={intervalTime.toString()}
                  onValueChange={(value) =>
                    setIntervalTime(Number.parseInt(value, 10))
                  }
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2">
                          {/* <span>{option.icon}</span> */}
                          {option.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Relative Mode Toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="relativeMode"
                  checked={isRelative}
                  onCheckedChange={setIsRelative}
                />
                <Label htmlFor="relativeMode" className="text-sm font-medium">
                  Relative Mode
                </Label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPaused(!isPaused)}
                className={cn("gap-2", isPaused && "text-green-600")}
              >
                {isPaused ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
                {isPaused ? "Resume" : "Pause"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={resetChart}
                className="gap-2 bg-transparent"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={exportData}
                className="gap-2 bg-transparent"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          <Separator />

          {/* Chart */}
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  Loading metrics...
                </div>
              </div>
            )}
            <div className="h-[400px] w-full">
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>

          {/* Chart Info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Data points: {metricData.labels.length}/{MAX_DATA_POINTS}
            </span>
            <span>Use mouse wheel to zoom, drag to pan</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

SystemMetricsGraph.displayName = "SystemMetricsGraph";

export default SystemMetricsGraph;
