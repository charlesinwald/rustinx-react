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
