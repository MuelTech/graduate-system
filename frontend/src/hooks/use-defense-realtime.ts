"use client";

/**
 * CDW-8B — the single workspace-level realtime connection owner.
 *
 * One mounted Defense Workspace owns one socket. Domain events only invalidate
 * the existing React Query keys; REST/database state is always refetched and
 * remains authoritative. Polling stays active as the correctness fallback.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";

import { annotationsQueryKey } from "@/lib/pdf-annotation/collaboration-client";
import {
  createDefenseSocket,
  joinDefenseRoom,
  leaveDefenseRoom,
} from "@/lib/realtime/defense-socket";
import { normalizeDefenseRealtimeBaseUrl } from "@/lib/realtime/defense-socket-url";
import {
  DEFENSE_REALTIME_EVENT_NAMES,
  convergenceQueryTargets,
  isDefenseRealtimeActiveStatus,
  parseDefenseRealtimeEvent,
  targetsForMountedSchedule,
  type DefenseQueryTarget,
} from "@/lib/realtime/defense-realtime-events";
import {
  REPORT_PREVIEW_EVENT,
  isNewerLiveReportPreview,
  parseLiveReportPreview,
  reportPreviewDispositionForEvent,
  type LiveReportPreview,
} from "@/lib/realtime/report-preview";
import { ReportPreviewThrottle } from "@/lib/report/report-preview-throttle";
import {
  normalizeReportDocument,
  type ReportDocument,
} from "@/lib/report/report-document";

export interface UseDefenseRealtimeOptions {
  scheduleId: string;
  sessionStatus: string | null | undefined;
  documentId?: string | null;
}

export interface SendReportPreviewInput {
  baseBodyVersion: number;
  body: ReportDocument;
}

export interface UseDefenseRealtimeResult {
  /** Best-effort, coalesced ephemeral preview for authorized viewers. */
  sendReportPreview: (input: SendReportPreviewInput) => void;
  /** Latest ephemeral preview from the assigned Rapporteur, if any. */
  liveReportPreview: LiveReportPreview | null;
}

function queryKeyForTarget(
  scheduleId: string,
  target: DefenseQueryTarget,
): readonly unknown[] {
  switch (target.target) {
    case "workspace":
      return ["defenseWorkspace", scheduleId];
    case "annotations":
      return annotationsQueryKey(scheduleId, target.documentId);
    case "committeeReport":
      return ["committeeReport", scheduleId];
    case "oralEvaluation":
      return ["oralEvaluation", scheduleId];
    case "conclusionReadiness":
      return ["conclusionReadiness", scheduleId];
  }
}

export function useDefenseRealtime({
  scheduleId,
  sessionStatus,
  documentId = null,
}: UseDefenseRealtimeOptions): UseDefenseRealtimeResult {
  const { data: session } = useSession();
  const accessToken = session?.user?.accessToken ?? null;
  const queryClient = useQueryClient();
  const active = isDefenseRealtimeActiveStatus(sessionStatus);

  const socketRef = useRef<ReturnType<typeof createDefenseSocket> | null>(null);
  const throttleRef = useRef<ReportPreviewThrottle<{
    baseBodyVersion: number;
    body: ReportDocument;
  }> | null>(null);
  const previewSequenceRef = useRef(0);
  const [liveReportPreview, setLiveReportPreview] =
    useState<LiveReportPreview | null>(null);

  const sendReportPreview = useCallback((input: SendReportPreviewInput) => {
    throttleRef.current?.push({
      baseBodyVersion: input.baseBodyVersion,
      body: normalizeReportDocument(input.body),
    });
  }, []);

  useEffect(() => {
    if (!active || !scheduleId || !accessToken) {
      return;
    }

    const socket = createDefenseSocket(accessToken);
    socketRef.current = socket;
    let joined = false;
    let disposed = false;
    let concluded = false;
    let previewAccepting = true;

    const invalidateTargets = (targets: DefenseQueryTarget[]) => {
      for (const target of targets) {
        void queryClient.invalidateQueries({
          queryKey: queryKeyForTarget(scheduleId, target),
        });
      }
    };

    const eventHandlers = DEFENSE_REALTIME_EVENT_NAMES.map((eventName) => {
      const handler = (payload: unknown) => {
        const event = parseDefenseRealtimeEvent(eventName, payload);
        if (!event) {
          return;
        }

        const targets = targetsForMountedSchedule(event, scheduleId);
        if (targets.length === 0) {
          return;
        }

        // An authoritative save invalidates the report query but the viewer keeps
        // the ephemeral preview until the refetched bodyVersion catches up. Only
        // freeze/sign/final/conclusion states clear it immediately.
        if (reportPreviewDispositionForEvent(event.eventName) === "clear") {
          setLiveReportPreview(null);
          previewAccepting = false;
          throttleRef.current?.clear();
        }
        if (event.eventName === "report.draft.updated") {
          // Any sender-side preview coalesced before this save is stale.
          throttleRef.current?.clear();
        }

        invalidateTargets(targets);

        // The server emitted this only after the conclusion commit. Stop the
        // realtime connection; the invalidated workspace refetch renders the
        // authoritative CONCLUDED state and the hook will not rejoin.
        if (event.eventName === "defense.concluded") {
          concluded = true;
          socket.disconnect();
        }
      };

      socket.on(eventName, handler);
      return { eventName, handler };
    });

    const previewHandler = (payload: unknown) => {
      if (!previewAccepting) return;
      const preview = parseLiveReportPreview(payload);
      if (!preview || preview.scheduleId !== scheduleId) return;

      setLiveReportPreview((previous) =>
        isNewerLiveReportPreview(previous, preview) ? preview : previous,
      );
    };
    socket.on(REPORT_PREVIEW_EVENT, previewHandler);

    const throttle = new ReportPreviewThrottle<{
      baseBodyVersion: number;
      body: ReportDocument;
    }>({
      intervalMs: 750,
      send: (preview) => {
        const connectedSocket = socketRef.current;
        if (
          !connectedSocket?.connected ||
          !joined ||
          !previewAccepting
        ) {
          return;
        }

        previewSequenceRef.current += 1;
        connectedSocket.emit(REPORT_PREVIEW_EVENT, {
          scheduleId,
          baseBodyVersion: preview.baseBodyVersion,
          previewSequence: previewSequenceRef.current,
          body: preview.body,
        });
      },
    });
    throttleRef.current = throttle;

    const handleConnect = async () => {
      try {
        const acknowledgement = await joinDefenseRoom(socket, scheduleId);

        if (disposed) {
          return;
        }

        if (!acknowledgement.ok) {
          console.warn("[defense-realtime] join denied", acknowledgement.code);
          socket.disconnect();
          return;
        }

        joined = true;
        previewAccepting = true;
        // Reconnect always starts from authoritative REST state; no preview
        // history is replayed. The sequence intentionally keeps increasing for
        // this mounted workspace.
        setLiveReportPreview(null);
        invalidateTargets(convergenceQueryTargets({ documentId }));
      } catch {
        // Transport/invalidation failure: polling and REST remain authoritative.
      }
    };

    const handleDisconnect = () => {
      joined = false;
      previewAccepting = false;
      throttle.clear();
      setLiveReportPreview(null);
    };

    const handleConnectError = (error: Error) => {
      joined = false;
      previewAccepting = false;
      throttle.clear();
      setLiveReportPreview(null);

      // Authentication failures are not a reason to sign the user out: REST
      // remains the session authority. Stop retrying with the rejected token;
      // a refreshed token re-runs this effect and reconnects.
      if (error?.message === "UNAUTHORIZED") {
        socket.disconnect();
        return;
      }

      if (process.env.NODE_ENV !== "production") {
        const engine = (
          socket.io as unknown as {
            engine?: { transport?: { name?: string } };
          }
        )?.engine;
        console.warn(
          "[defense-realtime] transport unavailable; REST polling remains active",
          {
            target: normalizeDefenseRealtimeBaseUrl(
              process.env.NEXT_PUBLIC_BACKEND_API_URL,
            ),
            transport: engine?.transport?.name ?? "unknown",
            reason: error?.message,
          },
        );
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.connect();

    return () => {
      disposed = true;
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off(REPORT_PREVIEW_EVENT, previewHandler);
      for (const { eventName, handler } of eventHandlers) {
        socket.off(eventName, handler);
      }
      throttle.dispose();
      if (throttleRef.current === throttle) {
        throttleRef.current = null;
      }
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      if (joined && !concluded) {
        leaveDefenseRoom(socket);
      }
      socket.disconnect();
      setLiveReportPreview(null);
    };
  }, [active, accessToken, documentId, queryClient, scheduleId]);

  return { sendReportPreview, liveReportPreview };
}
