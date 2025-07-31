import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { Copy, Search, Eye, EyeOff, Activity, AlertTriangle } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";

interface LogEvent {
  payload: string;
}

function Logs() {
  const [accessEvent, setAccessEvent] = useState("");
  const [errorEvent, setErrorEvent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [rawMode, setRawMode] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const handleAccessEvent = (event: LogEvent) => {
      setAccessEvent((prevEvent) => prevEvent + "\n" + event.payload);
    };

    const handleErrorEvent = (event: LogEvent) => {
      setErrorEvent((prevEvent) => prevEvent + "\n" + event.payload);
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

  const filterLogs = (logs: string) => {
    if (!searchQuery) return logs;
    return logs
      .split("\n")
      .filter((log: string) =>
        log.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .join("\n");
  };

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
    const logParts = log.match(
      /(\S+) - - \[(.+?)\] "(\S+) (.+?) (.+?)" (\d+) (\d+) "(.*?)" "(.*?)"/
    );

    if (!logParts)
      return (
        <div
          key={index}
          className="p-3 bg-muted/50 rounded-lg text-sm font-mono"
        >
          {log}
        </div>
      );

    const [
      _,
      ipAddress,
      timestamp,
      method,
      path,
      protocol,
      statusCode,
      responseSize,
      referrer,
      userAgent,
    ] = logParts;

    return (
      <Card key={index} className="mb-3">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge variant={getStatusCodeVariant(statusCode)}>
                {statusCode}
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">
                {method}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(log)}
              className="h-8 w-8 p-0"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground min-w-[100px]">
                IP Address:
              </span>
              <span className="font-mono">{ipAddress}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground min-w-[100px]">
                Timestamp:
              </span>
              <span className="font-mono text-xs">{timestamp}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground min-w-[100px]">
                Request:
              </span>
              <span className="font-mono">{path}</span>
              <Badge variant="outline" className="text-xs">
                {protocol}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground min-w-[100px]">
                Size:
              </span>
              <span className="font-mono">{responseSize} bytes</span>
            </div>
            {referrer !== "-" && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-muted-foreground min-w-[100px]">
                  Referrer:
                </span>
                <span className="font-mono text-xs truncate">{referrer}</span>
              </div>
            )}
            <div className="flex items-start gap-2">
              <span className="font-medium text-muted-foreground min-w-[100px]">
                User-Agent:
              </span>
              <span className="font-mono text-xs break-all">{userAgent}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const handleToggleRawMode = () => {
    setRawMode(!rawMode);
  };

  const renderLogs = (logs: string, type: string) => {
    if (logs === "") {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-3 mb-4">
            {type === "access" ? (
              <Activity className="h-6 w-6 text-muted-foreground" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <p className="text-muted-foreground">
            Waiting for {type} events from Nginx...
          </p>
        </div>
      );
    }

    const filteredLogs = filterLogs(logs);
    const logEntries = filteredLogs
      .split("\n")
      .filter((log: string) => log.trim());

    if (rawMode) {
      return (
        <div className="space-y-2">
          {logEntries.map((log: string, index: number) => (
            <div
              key={index}
              className="p-3 bg-muted/50 rounded-lg text-sm font-mono break-all"
            >
              {log}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {logEntries.map((log: string, index: number) => formatLog(log, index))}
      </div>
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
        </div>
      </div>

      <Separator />

      {/* Logs Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Access Events */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500" />
              Access Events
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-[600px] px-6 pb-6 bg-background">
              {renderLogs(accessEvent, "access")}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Error Events */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Error Events
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-[600px] px-6 pb-6 bg-background">
              {renderLogs(errorEvent, "error")}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Logs;
