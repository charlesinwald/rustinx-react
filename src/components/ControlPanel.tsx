import React, { useState } from "react"

// Check if we're running in Tauri environment
const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__;
const invoke = isTauri ? require("@tauri-apps/api/tauri").invoke : null;
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Separator } from "./ui/separator"
import { useToast } from "../hooks/use-toast"
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
} from "./ui/alert-dialog"
import { Play, RotateCcw, Square, Loader2, Server, AlertTriangle } from "lucide-react"
import SystemMetrics from "./SystemMetrics/SystemMetrics"

interface ServiceAction {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  variant: "default" | "destructive" | "outline" | "secondary"
  confirmMessage?: string
  confirmTitle?: string
}

export default function ControlPanel() {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [lastResponse, setLastResponse] = useState("")
  const { toast } = useToast()

  const setLoading = (action: string, loading: boolean) => {
    setLoadingStates((prev) => ({ ...prev, [action]: loading }))
  }

  const showSuccess = (message: string) => {
    toast({
      title: "Success",
      description: message,
      variant: "default",
    })
  }

  const showError = (message: string) => {
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    })
  }

  const startNginx = async () => {
    setLoading("start", true)
    try {
      if (isTauri && invoke) {
        const response = await invoke<string>("start_nginx")
        console.log("Nginx started:", response)
        setLastResponse(response)
        showSuccess(response)
      } else {
        // Use HTTP API in browser mode
        const response = await fetch('/api/nginx/start', {
          method: 'POST',
          credentials: 'include',
        })
        const data = await response.json()
        
        if (data.success) {
          setLastResponse(data.message)
          showSuccess(data.message)
        } else {
          throw new Error(data.error)
        }
      }
    } catch (error) {
      console.error("Error starting Nginx:", error)
      const errorMessage = typeof error === 'string' ? error : String(error)
      setLastResponse(`Error: ${errorMessage}`)
      showError(`Failed to start Nginx: ${errorMessage}`)
    } finally {
      setLoading("start", false)
    }
  }

  const restartNginx = async () => {
    setLoading("restart", true)
    try {
      if (isTauri && invoke) {
        const response = await invoke<string>("restart_nginx")
        console.log("Nginx restarted:", response)
        setLastResponse(response)
        showSuccess(response)
      } else {
        // Use HTTP API in browser mode
        const response = await fetch('/api/nginx/restart', {
          method: 'POST',
          credentials: 'include',
        })
        const data = await response.json()
        
        if (data.success) {
          setLastResponse(data.message)
          showSuccess(data.message)
        } else {
          throw new Error(data.error)
        }
      }
    } catch (error) {
      console.error("Error restarting Nginx:", error)
      const errorMessage = typeof error === 'string' ? error : String(error)
      setLastResponse(`Error: ${errorMessage}`)
      showError(`Failed to restart Nginx: ${errorMessage}`)
    } finally {
      setLoading("restart", false)
    }
  }

  const stopNginx = async () => {
    setLoading("stop", true)
    try {
      if (isTauri && invoke) {
        const response = await invoke<string>("stop_nginx")
        console.log("Nginx stopped:", response)
        setLastResponse(response)
        showSuccess(response)
      } else {
        // Use HTTP API in browser mode
        const response = await fetch('/api/nginx/stop', {
          method: 'POST',
          credentials: 'include',
        })
        const data = await response.json()
        
        if (data.success) {
          setLastResponse(data.message)
          showSuccess(data.message)
        } else {
          throw new Error(data.error)
        }
      }
    } catch (error) {
      console.error("Error stopping Nginx:", error)
      const errorMessage = typeof error === 'string' ? error : String(error)
      setLastResponse(`Error: ${errorMessage}`)
      showError(`Failed to stop Nginx: ${errorMessage}`)
    } finally {
      setLoading("stop", false)
    }
  }

  const serviceActions: ServiceAction[] = [
    {
      id: "start",
      label: "Start",
      icon: Play,
      variant: "default",
    },
    {
      id: "restart",
      label: "Restart",
      icon: RotateCcw,
      variant: "outline",
      confirmTitle: "Restart Nginx Service",
      confirmMessage: "Are you sure you want to restart Nginx? This will temporarily interrupt service.",
    },
    {
      id: "stop",
      label: "Stop",
      icon: Square,
      variant: "destructive",
      confirmTitle: "Stop Nginx Service",
      confirmMessage: "Are you sure you want to stop Nginx? This will make your web services unavailable.",
    },
  ]

  const handleAction = (actionId: string) => {
    switch (actionId) {
      case "start":
        startNginx()
        break
      case "restart":
        restartNginx()
        break
      case "stop":
        stopNginx()
        break
    }
  }

  const ActionButton = React.forwardRef<HTMLButtonElement, { action: ServiceAction }>(({ action }, ref) => {
    const Icon = action.icon
    const isLoading = loadingStates[action.id]

    const button = (
      <Button
        ref={ref}
        variant={action.variant}
        size="lg"
        disabled={isLoading}
        onClick={() => handleAction(action.id)}
        className="h-16 w-full flex-col gap-2 text-sm font-medium"
      >
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Icon className="h-6 w-6" />}
        {isLoading ? "Processing..." : action.label}
      </Button>
    )

    if (action.confirmMessage) {
      return (
        <AlertDialog>
          <AlertDialogTrigger asChild>{button}</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                {action.confirmTitle}
              </AlertDialogTitle>
              <AlertDialogDescription>{action.confirmMessage}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleAction(action.id)}
                className={
                  action.variant === "destructive"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : ""
                }
              >
                {action.label}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )
    }

    return button
  })

  return (
    <div className="space-y-6 p-6">
      {/* Service Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Nginx Service Controls
          </CardTitle>
          <CardDescription>
            Manage your Nginx web server with these controls. Use with caution in production environments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Control Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {serviceActions.map((action) => (
              <ActionButton key={action.id} action={action} />
            ))}
          </div>

          {/* Last Response */}
          {lastResponse && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Last Operation Result</h4>
                <div className="rounded-lg bg-muted p-3">
                  <Badge variant="outline" className="mb-2">
                    Response
                  </Badge>
                  <p className="text-sm text-muted-foreground">{lastResponse}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* System Metrics */}
      <SystemMetrics />
    </div>
  )
}
