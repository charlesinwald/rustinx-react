import { useState, useEffect } from "react";

// Check if we're running in Tauri environment
const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__;

// Conditionally import Tauri APIs
const listen = isTauri ? require("@tauri-apps/api/event").listen : null;
const invoke = isTauri ? require("@tauri-apps/api/tauri").invoke : null;
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import {
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  ExternalLink,
  Server,
} from "lucide-react";
import { cn } from "../../lib/utils";

export default function NginxStatus() {
  const [nginxStatus, setNginxStatus] = useState("Checking...");
  const [configEvent, setConfigEvent] = useState("");
  const [nginxConfigPath, setNginxConfigPath] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNginxStatus = async () => {
      if (isTauri && listen) {
        // Use Tauri events in desktop mode
        const unlistenNginxStatus = listen("nginx_status_check", (event) => {
          console.log("Nginx Status:", event.payload);
          setNginxStatus(event.payload as string);
          setIsLoading(false);
        });

        const unlistenConfigCheck = listen("nginx_config_check", (event) => {
          console.log("Nginx Config Check:", event.payload);
          setConfigEvent(event.payload as string);
        });

        return () => {
          unlistenNginxStatus.then((unlistenFn) => unlistenFn());
          unlistenConfigCheck.then((unlistenFn) => unlistenFn());
        };
      } else {
        // Use HTTP API in browser mode
        try {
          const response = await fetch('/api/nginx/status', {
            method: 'GET',
            credentials: 'include',
          });
          const data = await response.json();
          setNginxStatus(data.status);
          setIsLoading(false);
        } catch (error) {
          console.error("Error fetching nginx status:", error);
          setNginxStatus("error");
          setIsLoading(false);
        }
      }
    };

    fetchNginxStatus();
    
    // Poll status every 30 seconds in browser mode
    if (!isTauri) {
      const interval = setInterval(fetchNginxStatus, 30000);
      return () => clearInterval(interval);
    }
  }, []);

  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return {
          icon: CheckCircle,
          color: "text-green-600",
          bgColor: "bg-green-50 border-green-200",
          variant: "default" as const,
          label: "Active",
        };
      case "inactive":
        return {
          icon: XCircle,
          color: "text-red-600",
          bgColor: "bg-red-50 border-red-200",
          variant: "destructive" as const,
          label: "Inactive",
        };
      case "error":
        return {
          icon: XCircle,
          color: "text-red-600",
          bgColor: "bg-red-50 border-red-200",
          variant: "destructive" as const,
          label: "Error",
        };
      default:
        return {
          icon: Loader2,
          color: "text-yellow-600",
          bgColor: "bg-yellow-50 border-yellow-200",
          variant: "secondary" as const,
          label: "Checking...",
        };
    }
  };

  const capitalizeFirstLetter = (string: string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  async function fetchNginxConfPath() {
    try {
      if (isTauri && invoke) {
        const confPath = await invoke<string>("get_nginx_conf_path");
        console.log(`NGINX configuration file path: ${confPath}`);
        setNginxConfigPath(confPath);
      } else {
        // Use HTTP API in browser mode
        const response = await fetch('/api/nginx/config-path', {
          method: 'GET',
          credentials: 'include',
        });
        const data = await response.json();
        setNginxConfigPath(data.path);
      }
    } catch (error) {
      console.error("Error fetching NGINX configuration path:", error);
      setNginxConfigPath("/etc/nginx/nginx.conf");
    }
  }

  async function openFile(filePath: string) {
    if (isTauri && invoke) {
      try {
        await invoke("open_file", { filePath });
        console.log(`Opened file: ${filePath}`);
      } catch (error) {
        console.error("Failed to open file:", error);
      }
    } else {
      // In browser mode, show config path info
      alert(`Config file location: ${filePath}\n\nIn browser mode, you'll need to edit this file directly on the server.`);
    }
  }

  // Fetch nginx config path on component mount
  useEffect(() => {
    fetchNginxConfPath();
  }, []);

  const statusConfig = getStatusConfig(nginxStatus);
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Server className="h-4 w-4" />
          Nginx Status
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 bg-background p-4">
        {/* Status Display */}
        <div
          className={cn(
            "flex items-center justify-between rounded-lg border p-3 bg-muted"
          )}
        >
          <div className="flex items-center gap-2">
            <StatusIcon
              className={cn(
                "h-4 w-4",
                statusConfig.color,
                nginxStatus === "Checking..." && "animate-spin"
              )}
            />
          </div>
          <Badge variant={statusConfig.variant} className="text-xs">
            {statusConfig.label}
          </Badge>
        </div>

        {/* Config Event */}
        {configEvent && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                Configuration Event
              </h4>
              <p className="text-sm bg-muted p-2 rounded">
                {configEvent}
              </p>
            </div>
          </>
        )}

        {/* Config File */}
        {nginxConfigPath && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                Configuration File
              </h4>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 h-auto p-2 bg-transparent"
                onClick={() => openFile(nginxConfigPath)}
              >
                <FileText className="h-4 w-4" />
                <div className="flex-1 text-left">
                  <div className="text-xs font-medium">Open Config</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {nginxConfigPath}
                  </div>
                </div>
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
