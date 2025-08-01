import type React from "react"
import { useState, useEffect, useMemo, useCallback } from "react"
import { invoke } from "@tauri-apps/api/tauri"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Separator } from "../ui/separator"
import { ScrollArea } from "../ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Label } from "../ui/label"
import { Switch } from "../ui/switch"
import { useToast } from "../../hooks/use-toast"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"
import {
  AlertCircle,
  RefreshCw,
  Trash2,
  Search,
  Download,
  Calendar,
  Clock,
  Terminal,
  Loader2,
  FileText,
  Settings,
  Copy,
} from "lucide-react"
import { cn } from "../../lib/utils"

interface SystemdOptions {
  service_name: string
  no_pager: boolean
  num_lines: number
  since: string | null
  until: string | null
  reverse: boolean
}

interface LogEntry {
  timestamp: string
  level: string
  service: string
  message: string
  raw: string
}

const LOG_LEVELS = {
  ERROR: { color: "text-red-600", bg: "bg-background border-red-200", icon: "🔴" },
  WARN: { color: "text-yellow-600", bg: "bg-background border-yellow-200", icon: "🟡" },
  INFO: { color: "text-blue-600", bg: "bg-background border-blue-200", icon: "🔵" },
  DEBUG: { color: "text-gray-600", bg: "bg-background border-gray-200", icon: "⚪" },
  DEFAULT: { color: "text-foreground", bg: "bg-background border-border", icon: "⚫" },
}

const SERVICES = [
  { value: "nginx.service", label: "Nginx", icon: "🌐" },
  { value: "apache2.service", label: "Apache", icon: "🔥" },
  { value: "mysql.service", label: "MySQL", icon: "🗄️" },
  { value: "postgresql.service", label: "PostgreSQL", icon: "🐘" },
  { value: "redis.service", label: "Redis", icon: "📦" },
  { value: "docker.service", label: "Docker", icon: "🐳" },
]

const LINE_OPTIONS = [
  { value: "50", label: "50 lines" },
  { value: "100", label: "100 lines" },
  { value: "200", label: "200 lines" },
  { value: "500", label: "500 lines" },
  { value: "1000", label: "1000 lines" },
]

const Systemd: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([])
  const [serviceName, setServiceName] = useState("nginx.service")
  const [numLines, setNumLines] = useState(100)
  const [noPager, setNoPager] = useState(true)
  const [since, setSince] = useState("")
  const [until, setUntil] = useState("")
  const [reverse, setReverse] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(5000)
  const { toast } = useToast()

  const parseLogEntry = useCallback(
    (logLine: string): LogEntry => {
      // Simple log parsing - you can enhance this based on your log format
      const timestampMatch = logLine.match(/^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/)
      const timestamp = timestampMatch ? timestampMatch[1] : ""

      let level = "DEFAULT"
      if (logLine.toLowerCase().includes("error")) level = "ERROR"
      else if (logLine.toLowerCase().includes("warn")) level = "WARN"
      else if (logLine.toLowerCase().includes("info")) level = "INFO"
      else if (logLine.toLowerCase().includes("debug")) level = "DEBUG"

      return {
        timestamp,
        level,
        service: serviceName,
        message: logLine.replace(timestampMatch?.[0] || "", "").trim(),
        raw: logLine,
      }
    },
    [serviceName],
  )

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const output = await invoke<string>("get_systemd_logs", {
        options: {
          service_name: serviceName,
          no_pager: noPager,
          num_lines: numLines,
          since: since || null,
          until: until || null,
          reverse: reverse,
        } as SystemdOptions,
      })

      const parsedLogs = output.split("\n").filter((line) => line.trim() !== "")
      setLogs(parsedLogs)

      if (parsedLogs.length === 0) {
        toast({
          title: "No logs found",
          description: "No logs available for the specified criteria",
        })
      }
    } catch (err) {
      console.error("Failed to fetch systemd logs:", err)
      const errorMessage = typeof err === "string" ? err : "Error fetching logs."
      setError(errorMessage)
      setLogs([])
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [serviceName, numLines, noPager, since, until, reverse, toast])

  const clearLogs = () => {
    setLogs([])
    toast({
      title: "Logs cleared",
      description: "Log display has been cleared",
    })
  }

  const exportLogs = () => {
    const logContent = logs.join("\n")
    const blob = new Blob([logContent], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${serviceName}-logs-${new Date().toISOString().split("T")[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Export complete",
      description: "Logs exported successfully",
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied",
      description: "Log entry copied to clipboard",
    })
  }

  const filteredLogs = useMemo(() => {
    if (!searchTerm) return logs
    return logs.filter((log) => log.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [logs, searchTerm])

  const parsedLogs = useMemo(() => {
    return filteredLogs.map(parseLogEntry)
  }, [filteredLogs, parseLogEntry])

  const logStats = useMemo(() => {
    const stats = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, DEFAULT: 0 }
    parsedLogs.forEach((log) => {
      stats[log.level as keyof typeof stats]++
    })
    return stats
  }, [parsedLogs])

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchLogs, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchLogs])

  // Initial fetch and dependency changes
  useEffect(() => {
    fetchLogs()
  }, [serviceName, numLines, noPager, since, until, reverse])

  const formatDateTime = (datetime: string) => {
    return datetime ? datetime.replace("T", " ") : ""
  }

  const isLinux = typeof process !== "undefined" && process.platform === "linux"

  return (
    <TooltipProvider>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Terminal className="h-8 w-8" />
              System Logs
            </h1>
            <p className="text-muted-foreground">Monitor and analyze systemd service logs</p>
          </div>
          <div className="flex items-center gap-2">
            {autoRefresh && (
              <Badge variant="secondary" className="gap-1 animate-pulse">
                <RefreshCw className="h-3 w-3" />
                Auto-refresh
              </Badge>
            )}
            <Badge variant="outline">{logs.length} entries</Badge>
          </div>
        </div>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Log Configuration
            </CardTitle>
            <CardDescription>Configure log retrieval parameters and filters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Service and Lines */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service">Service</Label>
                <Select value={serviceName} onValueChange={setServiceName}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICES.map((service) => (
                      <SelectItem key={service.value} value={service.value}>
                        <span className="flex items-center gap-2">
                          <span>{service.icon}</span>
                          {service.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lines">Number of Lines</Label>
                <Select value={numLines.toString()} onValueChange={(value) => setNumLines(Number.parseInt(value, 10))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LINE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="refresh-interval">Refresh Interval (ms)</Label>
                <Input
                  id="refresh-interval"
                  type="number"
                  min="1000"
                  step="1000"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number.parseInt(e.target.value, 10) || 5000)}
                  disabled={!autoRefresh}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="search">Search Logs</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search in logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Date Range (Linux only) */}
            {isLinux && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="since" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Since
                  </Label>
                  <Input id="since" type="datetime-local" value={since} onChange={(e) => setSince(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="until" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Until
                  </Label>
                  <Input id="until" type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
                </div>
              </div>
            )}

            <Separator />

            {/* Options and Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center space-x-2">
                  <Switch id="no-pager" checked={noPager} onCheckedChange={setNoPager} />
                  <Label htmlFor="no-pager">No Pager</Label>
                </div>

                {isLinux && (
                  <div className="flex items-center space-x-2">
                    <Switch id="reverse" checked={reverse} onCheckedChange={setReverse} />
                    <Label htmlFor="reverse">Reverse Order</Label>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                  <Label htmlFor="auto-refresh">Auto Refresh</Label>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={clearLogs} className="gap-2 bg-transparent">
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
                <Button
                  variant="outline"
                  onClick={exportLogs}
                  disabled={logs.length === 0}
                  className="gap-2 bg-transparent"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
                <Button onClick={fetchLogs} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {loading ? "Loading..." : "Refresh"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Log Statistics */}
        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Log Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(logStats).map(([level, count]) => {
                  const config = LOG_LEVELS[level as keyof typeof LOG_LEVELS]
                  return (
                    <div key={level} className="text-center space-y-1">
                      <div className="flex items-center justify-center gap-1">
                        <span>{config.icon}</span>
                        <span className="text-sm font-medium">{level}</span>
                      </div>
                      <p className={cn("text-2xl font-bold", config.color)}>{count}</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Error</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Logs Display */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Logs for {serviceName}
                </CardTitle>
                <CardDescription>
                  {filteredLogs.length} of {logs.length} entries
                  {searchTerm && ` matching "${searchTerm}"`}
                </CardDescription>
              </div>
              {filteredLogs.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(filteredLogs.join("\n"))}
                  className="gap-2 bg-transparent"
                >
                  <Copy className="h-4 w-4" />
                  Copy All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filteredLogs.length > 0 ? (
              <ScrollArea className="h-[500px] w-full rounded-md border">
                <div className="p-4 space-y-2">
                  {parsedLogs.map((log, index) => {
                    const config = LOG_LEVELS[log.level as keyof typeof LOG_LEVELS]
                    return (
                      <div
                        key={index}
                        className={cn(
                          "rounded-lg border p-3 font-mono text-sm transition-colors hover:bg-muted/50",
                          config.bg,
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span>{config.icon}</span>
                              {log.timestamp && (
                                <Badge variant="outline" className="text-xs">
                                  {log.timestamp}
                                </Badge>
                              )}
                              <Badge variant="secondary" className={cn("text-xs", config.color)}>
                                {log.level}
                              </Badge>
                            </div>
                            <p className="text-sm leading-relaxed break-all">{log.message || log.raw}</p>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(log.raw)}
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy log entry</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex items-center justify-center h-32 text-center">
                <div className="space-y-2">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground">
                    {searchTerm ? "No logs found matching your search" : "No logs available"}
                  </p>
                  {searchTerm && (
                    <Button variant="outline" size="sm" onClick={() => setSearchTerm("")}>
                      Clear search
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}

export default Systemd
