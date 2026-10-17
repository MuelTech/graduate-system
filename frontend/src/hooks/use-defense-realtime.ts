"use client";

/**
 * CDW-8B — the single workspace-level realtime connection owner.
 *
 * One mounted Defense Workspace owns one socket. Domain events only invalidate
 * the existing React Query keys; REST/database state is always refetched and
 * remains authoritative. Polling stays active as the correctness fallback.
 */
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";

import { annotationsQueryKey } from "@/lib/pdf-annotation/collaboration-client";
import {
  createDefenseSocket,
  joinDefenseRoom,
  leaveDefenseRoom,
} from "@/lib/realtime/defense-socket";
import {
  DEFENSE_REALTIME_EVENT_NAMES,
  convergenceQueryTargets,
  isDefenseRealtimeActiveStatus,
  parseDefenseRealtimeEvent,
  targetsForMountedSchedule,
  type DefenseQueryTarget,
} from "@/lib/realtime/defense-realtime-events";

export interface UseDefenseRealtimeOptions {
  scheduleId: string;
  sessionStatus: string | null | undefined;
  documentId?: string | null;
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
}: UseDefenseRealtimeOptions): void {
  const { data: session } = useSession();
  const accessToken = session?.user?.accessToken ?? null;
  const queryClient = useQueryClient();
  const active = isDefenseRealtimeActiveStatus(sessionStatus);

  useEffect(() => {
    if (!active || !scheduleId || !accessToken) {
      return;
    }

    const socket = createDefenseSocket(accessToken);
    let joined = false;
    let disposed = false;
    let concluded = false;

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
        // Initial join and every reconnect converge from authoritative REST.
        invalidateTargets(convergenceQueryTargets({ documentId }));
      } catch {
        // Transport/invalidation failure: polling and REST remain authoritative.
      }
    };

    const handleConnectError = (error: Error) => {
      // Authentication failures are not a reason to sign the user out: REST
      // remains the session authority. Stop retrying with the rejected token;
      // a refreshed token re-runs this effect and reconnects.
      if (error?.message === "UNAUTHORIZED") {
        socket.disconnect();
        return;
      }

      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[defense-realtime] transport unavailable; REST polling remains active",
          error?.message,
        );
      }
    };

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.connect();

    return () => {
      disposed = true;
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      for (const { eventName, handler } of eventHandlers) {
        socket.off(eventName, handler);
      }
      if (joined && !concluded) {
        leaveDefenseRoom(socket);
      }
      socket.disconnect();
    };
  }, [active, accessToken, documentId, queryClient, scheduleId]);
}
