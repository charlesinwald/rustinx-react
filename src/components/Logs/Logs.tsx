import { useState, useEffect, useMemo, memo, useCallback } from "react";
import apiClient from "../../api/axiosInstance";

// Check if we're running in Tauri environment
const isTauri = typeof window !== "undefined" && (window as any).__TAURI__;
const listen = isTauri ? require("@tauri-apps/api/event").listen : null;
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import {
  Copy,
  Search,
  Eye,
  EyeOff,
  Activity,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { Button } from "../ui/button";

import { Input } from "../ui/input";

interface LogEvent {
  payload: string;
}

const MAX_LOG_LINES = 1000; // Maximum number of log lines to keep in memory

const Logs = memo(() => {
  const [accessLogs, setAccessLogs] = useState<string[]>([]);
  const [errorLogs, setErrorLogs] = useState<string[]>([]);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [errorError, setErrorError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [rawMode, setRawMode] = useState(false);
  const { toast } = useToast();

  const fetchLogs = useCallback(async () => {
    console.log("📋 Starting to fetch logs...");

    // Fetch access and error logs independently to avoid cross-contamination
    console.log("🌐 Making parallel requests for access and error logs");

    // Handle access logs
    const fetchAccessLogs = async () => {
      try {
        const accessResponse = await apiClient.get(
          "/nginx/logs?type=access&lines=100"
        );
        console.log("📊 Access response status:", accessResponse.status);
        console.log("📊 Access response data:", accessResponse.data);

        if (accessResponse.status === 200) {
          const accessData = accessResponse.data;
          console.log("✅ Access logs data:", accessData);
          console.log("📝 Access logs count:", accessData.logs?.length || 0);
          setAccessLogs(accessData.logs || []);
          setAccessError(null); // Clear any previous errors
          console.log("✅ Access logs state updated");
        } else {
          console.log("❌ Access response failed:", accessResponse.status);
          const accessErrorData = accessResponse.data || {};
          setAccessError(
            accessErrorData.error || "Failed to fetch access logs"
          );
          setAccessLogs([]);
        }
      } catch (error: any) {
        console.error("❌ Error fetching access logs:", error);
        const errorMessage =
          error.response?.data?.error ||
          "Network error: Failed to connect to server";
        setAccessError(errorMessage);
        setAccessLogs([]);
      }
    };

    // Handle error logs
    const fetchErrorLogs = async () => {
      try {
        const errorResponse = await apiClient.get(
          "/nginx/logs?type=error&lines=100"
        );
        console.log("📊 Error response status:", errorResponse.status);
        console.log("📊 Error response data:", errorResponse.data);

        if (errorResponse.status === 200) {
          const errorData = errorResponse.data;
          console.log("✅ Error logs data:", errorData);
          console.log("📝 Error logs count:", errorData.logs?.length || 0);
          setErrorLogs(errorData.logs || []);
          setErrorError(null); // Clear any previous errors
          console.log("✅ Error logs state updated");
        } else {
          console.log("❌ Error response failed:", errorResponse.status);
          const errorErrorData = errorResponse.data || {};
          setErrorError(errorErrorData.error || "Failed to fetch error logs");
          setErrorLogs([]);
        }
      } catch (error: any) {
        console.error("❌ Error fetching error logs:", error);
        const errorMessage =
          error.response?.data?.error ||
          "Network error: Failed to connect to server";
        setErrorError(errorMessage);
        setErrorLogs([]);
      }
    };

    // Run both requests in parallel but handle errors independently
    await Promise.allSettled([fetchAccessLogs(), fetchErrorLogs()]);
    console.log("✅ Log fetch operations completed");
  }, []);

  useEffect(() => {
    if (isTauri && listen) {
      // Use Tauri events in desktop mode
      const handleAccessEvent = (event: LogEvent) => {
        setAccessLogs((prevLogs) => {
          const newLogs = [...prevLogs, event.payload];
          return newLogs.slice(-MAX_LOG_LINES);
        });
      };

      const handleErrorEvent = (event: LogEvent) => {
        setErrorLogs((prevLogs) => {
          const newLogs = [...prevLogs, event.payload];
          return newLogs.slice(-MAX_LOG_LINES);
        });
      };

      const unlistenAccess = listen("access_event", handleAccessEvent);
      const unlistenError = listen("error_event", handleErrorEvent);

      return () => {
        unlistenAccess.then((unlistenFn: any) => unlistenFn());
        unlistenError.then((unlistenFn: any) => unlistenFn());
      };
    } else {
      // Use HTTP API in browser mode
      fetchLogs();

      // Poll for new logs every 10 seconds
      const interval = setInterval(fetchLogs, 10000);
      return () => clearInterval(interval);
    }
  }, [fetchLogs]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleToggleRawMode = () => {
    setRawMode(!rawMode);
  };

  const filterLogs = useMemo(() => {
    return (logs: string[]) => {
      if (!searchQuery) return logs;
      return logs.filter((log: string) =>
        log.toLowerCase().includes(searchQuery.toLowerCase())
      );
    };
  }, [searchQuery]);

  const filteredAccessLogs = useMemo(
    () => filterLogs(accessLogs),
    [accessLogs, filterLogs]
  );
  const filteredErrorLogs = useMemo(
    () => filterLogs(errorLogs),
    [errorLogs, filterLogs]
  );

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: "Log entry has been copied to your clipboard.",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  const getStatusCodeVariant = (statusCode: string) => {
    const code = Number.parseInt(statusCode);
    if (code >= 200 && code < 300) return "default";
    if (code >= 300 && code < 400) return "secondary";
    if (code >= 400 && code < 500) return "destructive";
    if (code >= 500) return "destructive";
    return "outline";
  };

  const formatLog = (log: string, index: number) => {
    if (rawMode) {
      return (
        <div
          key={index}
          className="mb-2 p-3 bg-card rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => copyToClipboard(log)}
        >
          <pre className="text-sm font-mono whitespace-pre-wrap break-all">
            {log}
          </pre>
        </div>
      );
    }

    // Parse log entry (simplified example - adjust based on your log format)
    const parts = log.split(" ");
    const ip = parts[0] || "Unknown";
    const timestamp = parts[3]?.replace("[", "") || "Unknown time";
    const method = parts[5]?.replace('"', "") || "GET";
    const path = parts[6] || "/";
    const statusCode = parts[8] || "200";
    const size = parts[9] || "0";

    return (
      <div
        key={index}
        className="mb-2 p-3 bg-card rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => copyToClipboard(log)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
              {method}
            </span>
            <span
              className={`text-xs px-2 py-1 rounded ${
                getStatusCodeVariant(statusCode) === "destructive"
                  ? "bg-destructive text-destructive-foreground"
                  : getStatusCodeVariant(statusCode) === "secondary"
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {statusCode}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{timestamp}</span>
        </div>
        <div className="text-sm">
          <span className="font-medium">{path}</span>
        </div>
        <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
          <span>{ip}</span>
          <span>{size} bytes</span>
        </div>
      </div>
    );
  };

  const clearLogs = () => {
    setAccessLogs([]);
    setErrorLogs([]);
    toast({
      title: "Logs cleared",
      description: "All logs have been cleared.",
    });
  };

  const renderLogs = (
    logs: string[],
    title: string,
    icon: React.ReactNode,
    errorMessage?: string | null
  ) => {
    console.log(`🔍 Rendering ${title}:`, {
      logsCount: logs.length,
      errorMessage,
      sampleLogs: logs.slice(0, 2),
    });

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
            <span className="text-sm font-normal text-muted-foreground">
              ({logs.length} entries)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] w-full">
            <div className="space-y-2">
              {errorMessage ? (
                <div className="flex items-center justify-center h-32 text-center">
                  <div className="space-y-3 max-w-md text-center flex">
                    <div className="space-y-2 text-center flex flex-1 flex-col items-center">
                      <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                      <p className="font-medium text-foreground">
                        Logging Configuration Issue
                      </p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap text-center">
                        {errorMessage}
                      </p>
                    </div>
                  </div>
                </div>
              ) : logs.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-center">
                  <div className="space-y-2">
                    <Activity className="h-8 w-8 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">
                      {searchQuery
                        ? "No logs found matching your search"
                        : "No logs available"}
                    </p>
                    {searchQuery && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearchQuery("")}
                      >
                        Clear search
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                logs.map((log, index) => formatLog(log, index))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Nginx Logs</h1>
          <p className="text-muted-foreground">
            Monitor access and error events in real-time
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-10 w-full sm:w-[300px]"
            />
          </div>

          <Button
            variant="outline"
            onClick={handleToggleRawMode}
            className="flex items-center gap-2"
          >
            {rawMode ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            {rawMode ? "Formatted" : "Raw"} Mode
          </Button>

          {!isTauri && (
            <Button
              variant="outline"
              onClick={fetchLogs}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          )}

          <Button
            variant="outline"
            onClick={clearLogs}
            className="flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4" />
            Clear All
          </Button>
        </div>
      </div>

      <Separator />

      {/* Logs Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Access Events */}
        {renderLogs(
          filteredAccessLogs,
          "Access Logs",
          <Activity className="h-5 w-5 text-blue-500" />,
          accessError
        )}

        {/* Error Events */}
        {renderLogs(
          filteredErrorLogs,
          "Error Logs",
          <AlertTriangle className="h-5 w-5 text-red-500" />,
          errorError
        )}
      </div>
    </div>
  );
});

Logs.displayName = "Logs";

export default Logs;
