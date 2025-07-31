import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Cpu, Microchip, HardDrive, Upload, Download, Activity } from "lucide-react";
import SystemMetricsGraph from "./SystemMetricsGraph";

const SystemMetrics: React.FC = () => {
  const [cpuUsage, setCpuUsage] = useState<number>(0);
  const [totalMemory, setTotalMemory] = useState<number>(0);
  const [usedMemory, setUsedMemory] = useState<number>(0);
  const [tasks, setTasks] = useState<number>(0);
  const [txBytes, setTxBytes] = useState<number>(0);
  const [rxBytes, setRxBytes] = useState<number>(0);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const [cpu, totalMem, usedMem, tasks, txBytes, rxBytes] = await invoke<[number, number, number, number, number, number]>(
          "get_system_metrics"
        );
        setCpuUsage(cpu);
        setTotalMemory(totalMem);
        setUsedMemory(usedMem);
        setTasks(tasks);
        setTxBytes(txBytes);
        setRxBytes(rxBytes);
      } catch (error) {
        console.error("Failed to fetch system metrics:", error);
      }
    };

    const interval = setInterval(fetchMetrics, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            NGINX System Metrics
          </CardTitle>
          <CardDescription>
            Real-time performance overview of your system.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center space-x-2">
            <Cpu className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">CPU Usage</p>
              <Badge variant="outline">{cpuUsage.toFixed(2)}%</Badge>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Microchip className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Memory Usage</p>
              <Badge variant="outline">
                {((usedMemory / totalMemory) * 100).toFixed(2)}% (
                {(usedMemory / (1024 * 1024 * 1024)).toFixed(2)} GB /{" "}
                {(totalMemory / (1024 * 1024 * 1024)).toFixed(2)} GB)
              </Badge>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <HardDrive className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Active Tasks/Workers</p>
              <Badge variant="outline">{tasks}</Badge>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Transmitted Bandwidth</p>
              <Badge variant="outline">
                {(txBytes / (1024 * 1024)).toFixed(2)} MB
              </Badge>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Download className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Received Bandwidth</p>
              <Badge variant="outline">
                {(rxBytes / (1024 * 1024)).toFixed(2)} MB
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Metrics Graph
          </CardTitle>
          <CardDescription>
            Visual representation of system performance over time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SystemMetricsGraph />
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemMetrics;
