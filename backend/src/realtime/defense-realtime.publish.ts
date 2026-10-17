import { defenseRealtimePublisher } from "./defense-realtime.publisher";
import type {
  DefenseRealtimeEventName,
  DefenseRealtimeEventPayloads,
} from "./defense-realtime.types";

export interface DefenseRealtimePublisherLike {
  publish<K extends DefenseRealtimeEventName>(
    eventName: K,
    payload: DefenseRealtimeEventPayloads[K],
  ): Promise<boolean>;
}

export type DefenseRealtimePublishRequest = {
  [K in DefenseRealtimeEventName]: {
    eventName: K;
    payload: DefenseRealtimeEventPayloads[K];
  };
}[DefenseRealtimeEventName];

function logPublicationFailure(error: unknown): void {
  console.error("[defense-realtime] publication failed", error);
}

/**
 * CDW-8B application-boundary publication. Realtime is best-effort: even an
 * unexpected publisher rejection is contained and can never turn an already
 * committed academic REST write into a failure.
 */
export function publishDefenseRealtimeEvent<K extends DefenseRealtimeEventName>(
  eventName: K,
  payload: DefenseRealtimeEventPayloads[K],
  publisher: DefenseRealtimePublisherLike = defenseRealtimePublisher,
): void {
  try {
    void publisher.publish(eventName, payload).catch(logPublicationFailure);
  } catch (error) {
    logPublicationFailure(error);
  }
}

/**
 * Ordered best-effort sequence (used for `rap.signature.recorded` followed by
 * `rap.finalized` on the last required signature). One failed event never
 * prevents the later event from being attempted.
 */
export function publishDefenseRealtimeSequence(
  events: readonly DefenseRealtimePublishRequest[],
  publisher: DefenseRealtimePublisherLike = defenseRealtimePublisher,
): void {
  void (async () => {
    for (const entry of events) {
      try {
        await publisher.publish(entry.eventName, entry.payload as never);
      } catch (error) {
        logPublicationFailure(error);
      }
    }
  })();
}
