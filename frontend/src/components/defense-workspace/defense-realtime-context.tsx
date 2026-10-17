"use client";

/**
 * CDW-LIVE-1A — workspace-level realtime bridge.
 *
 * The Defense Workspace page mounts exactly one provider, which owns the single
 * Socket.IO connection through `useDefenseRealtime`. Report components consume
 * the transport API/state from here; they never create their own socket.
 */

import { createContext, useContext, type ReactNode } from "react";

import type { SendReportPreviewInput } from "@/hooks/use-defense-realtime";
import type { LiveReportPreview } from "@/lib/realtime/report-preview";

export interface DefenseRealtimeContextValue {
  sendReportPreview: (input: SendReportPreviewInput) => void;
  liveReportPreview: LiveReportPreview | null;
}

const NOOP_CONTEXT: DefenseRealtimeContextValue = {
  sendReportPreview: () => {},
  liveReportPreview: null,
};

const DefenseRealtimeContext =
  createContext<DefenseRealtimeContextValue>(NOOP_CONTEXT);

export function useReportRealtime(): DefenseRealtimeContextValue {
  return useContext(DefenseRealtimeContext);
}

export function DefenseRealtimeProvider({
  value,
  children,
}: {
  value: DefenseRealtimeContextValue;
  children: ReactNode;
}) {
  return (
    <DefenseRealtimeContext.Provider value={value}>
      {children}
    </DefenseRealtimeContext.Provider>
  );
}
