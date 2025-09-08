import React, { useState, useEffect, memo } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import apiClient from "../../api/axiosInstance";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Cpu, Microchip, HardDrive, Upload, Download, Activity } from "lucide-react";
import SystemMetricsGraph from "./SystemMetricsGraph";

const SystemMetrics: React.FC = memo(() => {
  const [cpuUsage, setCpuUsage] = useState<number>(0);
  const [totalMemory, setTotalMemory] = useState<number>(0);
  const [usedMemory, setUsedMemory] = useState<number>(0);
  const [tasks, setTasks] = useState<number>(0);
  const [workerCount, setWorkerCount] = useState<number>(0);
  const [txBytes, setTxBytes] = useState<number>(0);
  const [rxBytes, setRxBytes] = useState<number>(0);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Check if we're running in Tauri context
        if (typeof window !== 'undefined' && window.__TAURI_IPC__) {
          const [cpu, totalMem, usedMem, tasks, workerCount, txBytes, rxBytes] = await invoke<[number, number, number, number, number, number, number]>(
            "get_system_metrics"
          );
          setCpuUsage(cpu);
          setTotalMemory(totalMem);
          setUsedMemory(usedMem);
          setTasks(tasks);
          setWorkerCount(workerCount);
          setTxBytes(txBytes);
          setRxBytes(rxBytes);
        } else {
          // Running in browser mode - use HTTP API
          const response = await apiClient.get('/system-metrics');
          
          if (response.status === 200) {
            const data = response.data;
            setCpuUsage(data.cpu);
            setTotalMemory(data.totalMemory);
            setUsedMemory(data.usedMemory);
            setTasks(data.tasks);
            setWorkerCount(data.workerCount);
            setTxBytes(data.txBytes);
            setRxBytes(data.rxBytes);
          } else {
            console.error("Failed to fetch system metrics from HTTP API:", response.statusText);
          }
        }
      } catch (error) {
        console.error("Failed to fetch system metrics:", error);
      }
    };

    // Initial fetch
    fetchMetrics();
    
    // Reduced from 1000ms to 5000ms for better performance
    const interval = setInterval(fetchMetrics, 5000);
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
});


SystemMetrics.displayName = 'SystemMetrics';

export default SystemMetrics;
