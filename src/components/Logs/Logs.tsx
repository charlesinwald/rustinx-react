import { useState, useEffect, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
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
} from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { Button } from "../ui/button";

import { Input } from "../ui/input";

interface LogEvent {
  payload: string;
}

const MAX_LOG_LINES = 1000; // Maximum number of log lines to keep in memory

function Logs() {
  const [accessLogs, setAccessLogs] = useState<string[]>([]);
  const [errorLogs, setErrorLogs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [rawMode, setRawMode] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const handleAccessEvent = (event: LogEvent) => {
      setAccessLogs((prevLogs) => {
        const newLogs = [...prevLogs, event.payload];
        // Keep only the last MAX_LOG_LINES entries
        return newLogs.slice(-MAX_LOG_LINES);
      });
    };

    const handleErrorEvent = (event: LogEvent) => {
      setErrorLogs((prevLogs) => {
        const newLogs = [...prevLogs, event.payload];
        // Keep only the last MAX_LOG_LINES entries
        return newLogs.slice(-MAX_LOG_LINES);
      });
    };

    const unlistenAccess = listen("access_event", handleAccessEvent);
    const unlistenError = listen("error_event", handleErrorEvent);

    return () => {
      unlistenAccess.then((unlistenFn) => unlistenFn());
      unlistenError.then((unlistenFn) => unlistenFn());
    };
  }, []);

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

  const renderLogs = (logs: string[], title: string, icon: React.ReactNode) => {
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
              {logs.length === 0 ? (
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
          <Activity className="h-5 w-5 text-blue-500" />
        )}

        {/* Error Events */}
        {renderLogs(
          filteredErrorLogs,
          "Error Logs",
          <AlertTriangle className="h-5 w-5 text-red-500" />
        )}
      </div>
    </div>
  );
}

export default Logs;
