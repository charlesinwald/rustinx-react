import type React from "react";
import { useState, useEffect, useMemo } from "react";

// Check if we're running in Tauri environment
const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__;
const invoke = isTauri ? require("@tauri-apps/api/tauri").invoke : null;
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ScrollArea } from "../ui/scroll-area";
import { useToast } from "../../hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import {
  Settings,
  Info,
  Shield,
  Terminal,
  Save,
  RotateCcw,
  Search,
  HelpCircle,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Copy,
  Edit3,
} from "lucide-react";
import { NGINX_BUILD_OPTIONS } from "./arguments";

interface NginxConfig {
  version: string;
  buildInfo: string;
  configureArgs: string[];
  tlsSupport: string | undefined;
}

interface ArgumentItem {
  original: string;
  current: string;
  description: string;
  category: string;
  isModified: boolean;
}

const Config: React.FC = () => {
  const [nginxConfig, setNginxConfig] = useState<NginxConfig | null>(null);
  const [editArgs, setEditArgs] = useState<ArgumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchNginxConfig();
  }, []);

  const fetchNginxConfig = async () => {
    setIsLoading(true);
    try {
      let output: string;

      if (isTauri && invoke) {
        // Use Tauri invoke in desktop mode
        output = await invoke<string>("get_nginx_version");
      } else {
        // Use HTTP API in browser mode
        const response = await fetch('/api/nginx/version', {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            output = data.version_info;
          } else {
            throw new Error(data.error);
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const parsedConfig = parseNginxConfig(output);
      setNginxConfig(parsedConfig);

      const argumentItems = parsedConfig.configureArgs.map((arg) => ({
        original: arg,
        current: arg,
        description: getArgumentDescription(arg),
        category: getArgumentCategory(arg),
        isModified: false,
      }));

      setEditArgs(argumentItems);
    } catch (error) {
      console.error("Error fetching NGINX config:", error);
      toast({
        title: "Error",
        description: `Failed to fetch NGINX configuration: ${error}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const parseNginxConfig = (output: string): NginxConfig => {
    const lines = output.split("\n");
    const version = lines[0]?.trim() || "Unknown version";
    const buildInfo = lines[1]?.trim() || "Unknown build info";
    const tlsSupport = lines.find((line) => line.includes("TLS"));
    const configureArgsLine = lines.find((line) =>
      line.includes("configure arguments:")
    );
    const configureArgs = configureArgsLine
      ? parseConfigureArgs(
          configureArgsLine.replace("configure arguments: ", "")
        )
      : [];

    return { version, buildInfo, configureArgs, tlsSupport };
  };

  const parseConfigureArgs = (argsLine: string): string[] => {
    const args: string[] = [];
    let currentArg = "";
    let insideQuotes = false;

    for (let i = 0; i < argsLine.length; i++) {
      const char = argsLine[i];
      if (char === "'") {
        insideQuotes = !insideQuotes;
      } else if (char === " " && !insideQuotes) {
        if (currentArg) {
          args.push(currentArg);
          currentArg = "";
        }
      } else {
        currentArg += char;
      }
    }

    if (currentArg) {
      args.push(currentArg);
    }

    return args.flatMap((arg) => {
      if (arg.includes("=") && arg.includes("'")) {
        const [option, nestedArgs] = arg.split("=");
        if (
          nestedArgs &&
          nestedArgs.startsWith("'") &&
          nestedArgs.endsWith("'")
        ) {
          const cleanedArgs = nestedArgs.slice(1, -1);
          return [option, ...cleanedArgs.split(" ")];
        }
      }
      return arg;
    });
  };

  const getArgumentDescription = (arg: string): string => {
    for (const [key, value] of Object.entries(NGINX_BUILD_OPTIONS)) {
      if (arg.startsWith(key)) {
        if (typeof value === "string") {
          return value;
        } else if (typeof value === "object") {
          const specificArg = arg.replace(key, "").trim();
          return (
            value[specificArg] || `${specificArg}: No description available.`
          );
        }
      }
    }
    return "No description available.";
  };

  const getArgumentCategory = (arg: string): string => {
    if (
      arg.includes("--prefix") ||
      arg.includes("--sbin-path") ||
      arg.includes("--conf-path")
    ) {
      return "Paths";
    }
    if (arg.includes("--with-") || arg.includes("--add-module")) {
      return "Modules";
    }
    if (arg.includes("--user") || arg.includes("--group")) {
      return "User/Group";
    }
    if (arg.includes("--pid") || arg.includes("--lock")) {
      return "Process";
    }
    return "General";
  };

  const handleInputChange = (index: number, newValue: string) => {
    const newArgs = [...editArgs];
    newArgs[index] = {
      ...newArgs[index],
      current: newValue,
      isModified: newValue !== newArgs[index].original,
    };
    setEditArgs(newArgs);
    setHasUnsavedChanges(newArgs.some((arg) => arg.isModified));
  };

  const handleSaveChanges = async () => {
    if (!isTauri || !invoke) {
      toast({
        title: "Feature Not Available",
        description: "Configuration modification is only available in desktop mode for security reasons.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const updatedArgs = editArgs.map((arg) => arg.current).join(" ");
      await invoke("modify_nginx_service", { custom_args: updatedArgs });

      // Update original values to current values
      const updatedEditArgs = editArgs.map((arg) => ({
        ...arg,
        original: arg.current,
        isModified: false,
      }));
      setEditArgs(updatedEditArgs);
      setHasUnsavedChanges(false);

      toast({
        title: "Success",
        description: "Nginx configuration updated successfully",
      });
    } catch (error) {
      console.error("Failed to update Nginx arguments:", error);
      toast({
        title: "Error",
        description: "Failed to update Nginx configuration",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetChanges = () => {
    const resetArgs = editArgs.map((arg) => ({
      ...arg,
      current: arg.original,
      isModified: false,
    }));
    setEditArgs(resetArgs);
    setHasUnsavedChanges(false);
    toast({
      title: "Reset Complete",
      description: "All changes have been reverted",
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Configuration copied to clipboard",
    });
  };

  const filteredArgs = useMemo(() => {
    return editArgs.filter(
      (arg) =>
        arg.current.toLowerCase().includes(searchTerm.toLowerCase()) ||
        arg.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        arg.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [editArgs, searchTerm]);

  const groupedArgs = useMemo(() => {
    const groups: Record<string, ArgumentItem[]> = {};
    filteredArgs.forEach((arg) => {
      if (!groups[arg.category]) {
        groups[arg.category] = [];
      }
      groups[arg.category].push(arg);
    });
    return groups;
  }, [filteredArgs]);

  const modifiedCount = editArgs.filter((arg) => arg.isModified).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading NGINX configuration...
        </div>
      </div>
    );
  }

  if (!nginxConfig) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-muted-foreground">
            Failed to load NGINX configuration
          </p>
          <Button onClick={fetchNginxConfig} variant="outline" size="sm">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="h-8 w-8" />
              NGINX Configuration
            </h1>
            <p className="text-muted-foreground">
              View and modify your NGINX build configuration
            </p>
          </div>
          <div className="flex gap-2">
            {!isTauri && (
              <Badge variant="outline" className="gap-1">
                <Shield className="h-3 w-3" />
                Read-Only Mode
              </Badge>
            )}
            {hasUnsavedChanges && (
              <Badge variant="secondary" className="gap-1">
                <Edit3 className="h-3 w-3" />
                {modifiedCount} unsaved changes
              </Badge>
            )}
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview" className="gap-2">
              <Info className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="arguments" className="gap-2">
              <Terminal className="h-4 w-4" />
              Configure Arguments
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Version Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Version
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">
                      {nginxConfig.version.replace("nginx version: nginx/", "")}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(nginxConfig.version)}
                      className="gap-2"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Build Info Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Info className="h-5 w-5 text-blue-500" />
                    Build Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground break-all">
                      {nginxConfig.buildInfo}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(nginxConfig.buildInfo)}
                      className="gap-2"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* TLS Support Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-purple-500" />
                    TLS Support
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm">
                      {nginxConfig.tlsSupport ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Not Available
                        </Badge>
                      )}
                    </div>
                    {nginxConfig.tlsSupport && (
                      <p className="text-xs text-muted-foreground">
                        {nginxConfig.tlsSupport}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Configuration Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Configuration Summary</CardTitle>
                <CardDescription>
                  Overview of your NGINX build configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-blue-500">
                      {editArgs.length}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Total Arguments
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-green-500">
                      {
                        editArgs.filter((arg) =>
                          arg.current.includes("--with-")
                        ).length
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Enabled Modules
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-purple-500">
                      {Object.keys(groupedArgs).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Categories</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-orange-500">
                      {modifiedCount}
                    </p>
                    <p className="text-sm text-muted-foreground">Modified</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Arguments Tab */}
          <TabsContent value="arguments" className="space-y-4">
            {/* Search and Actions */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search arguments..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleResetChanges}
                      disabled={!hasUnsavedChanges}
                      className="gap-2 bg-transparent"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reset
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          disabled={!hasUnsavedChanges || isSaving}
                          className="gap-2"
                        >
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Save Changes
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Save Configuration Changes
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will update your NGINX service configuration
                            with {modifiedCount} modified arguments. This action
                            may require service restart.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleSaveChanges}>
                            Save Changes
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Arguments List */}
            <div className="space-y-4">
              {Object.entries(groupedArgs).map(([category, args]) => (
                <Card key={category}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{category}</CardTitle>
                    <CardDescription>
                      {args.length} arguments in this category
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {args.map((arg, index) => {
                          const globalIndex = editArgs.findIndex(
                            (item) => item === arg
                          );
                          return (
                            <div
                              key={globalIndex}
                              className={`flex items-center gap-3 p-3 rounded-lg border ${
                                arg.isModified
                                  ? "border-orange-200 bg-orange-50"
                                  : "border-border"
                              }`}
                            >
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={arg.current}
                                    onChange={(e) =>
                                      handleInputChange(
                                        globalIndex,
                                        e.target.value
                                      )
                                    }
                                    disabled={!isTauri}
                                    className={`font-mono text-sm ${
                                      arg.isModified ? "border-orange-300" : ""
                                    } ${!isTauri ? "bg-muted" : ""}`}
                                  />
                                  {arg.isModified && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      Modified
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {arg.description}
                                </p>
                              </div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                  >
                                    <HelpCircle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="left"
                                  className="max-w-xs"
                                >
                                  <div className="space-y-1">
                                    <p className="font-medium">Original:</p>
                                    <p className="font-mono text-xs">
                                      {arg.original}
                                    </p>
                                    <Separator />
                                    <p className="text-xs">{arg.description}</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredArgs.length === 0 && (
              <Card>
                <CardContent className="flex items-center justify-center h-32">
                  <div className="text-center space-y-2">
                    <Search className="h-8 w-8 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">
                      No arguments found matching your search
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
};

export default Config;
