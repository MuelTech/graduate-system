import crypto from "crypto";

import { getDefenseRealtimeServer } from "./defense-realtime.registry";
import type { DefenseRealtimeDeliveryInput } from "./defense-realtime.server";
import {
  DEFENSE_REALTIME_EVENT_METADATA_KEYS,
  defenseRoomName,
  isValidDefenseScheduleId,
  type DefenseRealtimeEventFor,
  type DefenseRealtimeEventName,
  type DefenseRealtimeEventPayloads,
  type DefenseRealtimeLogger,
} from "./defense-realtime.types";

export interface DefenseRealtimeTransport {
  deliver(input: DefenseRealtimeDeliveryInput): Promise<boolean>;
}

export interface DefenseRealtimePublisherDeps {
  getTransport?: () => DefenseRealtimeTransport | null;
  logger?: DefenseRealtimeLogger;
  createEventId?: () => string;
  now?: () => Date;
}

export interface DefenseRealtimeEventBuildDeps {
  createEventId: () => string;
  now: () => Date;
}

const DEFAULT_LOGGER: DefenseRealtimeLogger = console;

/**
 * Builds the wire event from an explicit runtime allow-list. Envelope fields
 * are always server-generated; only the documented metadata keys are copied,
 * so accidental private fields cannot leak into a realtime payload.
 */
export function buildDefenseRealtimeEvent<K extends DefenseRealtimeEventName>(
  eventName: K,
  payload: DefenseRealtimeEventPayloads[K],
  deps: DefenseRealtimeEventBuildDeps,
): DefenseRealtimeEventFor<K> {
  const metadataKeys = DEFENSE_REALTIME_EVENT_METADATA_KEYS[eventName];

  if (!metadataKeys) {
    throw new Error(`Unknown defense realtime event: ${String(eventName)}`);
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !isValidDefenseScheduleId(payload.scheduleId)
  ) {
    throw new Error("Defense realtime payload requires a valid scheduleId");
  }

  const event: Record<string, unknown> = {
    eventId: deps.createEventId(),
    scheduleId: payload.scheduleId,
    occurredAt: deps.now().toISOString(),
  };

  for (const key of metadataKeys) {
    const value = (payload as Record<string, unknown>)[key];
    if (value !== undefined) {
      event[key] = value;
    }
  }

  return event as unknown as DefenseRealtimeEventFor<K>;
}

/**
 * Best-effort server-side publisher for future CDW-8B emit points. It never
 * throws transport failures into an already successful REST write and is a
 * no-op before realtime initialization.
 */
export class DefenseRealtimePublisher {
  private readonly getTransport: () => DefenseRealtimeTransport | null;
  private readonly logger: DefenseRealtimeLogger;
  private readonly createEventId: () => string;
  private readonly now: () => Date;

  constructor(deps: DefenseRealtimePublisherDeps = {}) {
    this.getTransport = deps.getTransport ?? getDefenseRealtimeServer;
    this.logger = deps.logger ?? DEFAULT_LOGGER;
    this.createEventId = deps.createEventId ?? (() => crypto.randomUUID());
    this.now = deps.now ?? (() => new Date());
  }

  async publish<K extends DefenseRealtimeEventName>(
    eventName: K,
    payload: DefenseRealtimeEventPayloads[K],
  ): Promise<boolean> {
    try {
      const event = buildDefenseRealtimeEvent(eventName, payload, {
        createEventId: this.createEventId,
        now: this.now,
      });

      const transport = this.getTransport();
      if (!transport) {
        return false;
      }

      return await transport.deliver({
        room: defenseRoomName(payload.scheduleId),
        eventName,
        event,
      });
    } catch (error) {
      this.logger.error("Defense realtime publish failed", {
        eventName,
        error,
      });
      return false;
    }
  }
}

export const defenseRealtimePublisher = new DefenseRealtimePublisher();
