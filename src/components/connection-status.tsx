"use client";

import { useSignalRContext } from "./signalr-provider";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConnectionStatus() {
  const { connectionState } = useSignalRContext();

  const config = {
    connected: {
      icon: Wifi,
      label: "Live",
      textClassName: "text-green-600 dark:text-green-400",
      bgClassName: "bg-green-100 dark:bg-green-900/30",
      iconSpin: false,
    },
    connecting: {
      icon: RefreshCw,
      label: "Connecting",
      textClassName: "text-yellow-600 dark:text-yellow-400",
      bgClassName: "bg-yellow-100 dark:bg-yellow-900/30",
      iconSpin: true,
    },
    reconnecting: {
      icon: RefreshCw,
      label: "Reconnecting",
      textClassName: "text-yellow-600 dark:text-yellow-400",
      bgClassName: "bg-yellow-100 dark:bg-yellow-900/30",
      iconSpin: true,
    },
    disconnected: {
      icon: WifiOff,
      label: "Offline",
      textClassName: "text-gray-500 dark:text-gray-400",
      bgClassName: "bg-gray-100 dark:bg-gray-800",
      iconSpin: false,
    },
  }[connectionState];

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
        config.bgClassName
      )}
      title={`WebSocket ${connectionState}`}
    >
      <Icon className={cn("h-3 w-3", config.textClassName, config.iconSpin && "animate-spin")} />
      <span className={cn("hidden sm:inline", config.textClassName)}>
        {config.label}
      </span>
    </div>
  );
}
