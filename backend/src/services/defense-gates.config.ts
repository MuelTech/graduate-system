/**
 * Optional Final Defense gates marked CLIENT_CONFIRMATION_REQUIRED in the
 * source of truth (§11.2–11.3). Default OFF — do not invent institutional policy.
 * Flip via config/ops once the client reconfirms.
 */
export interface FinalOptionalGateFlags {
  requireInstruments: boolean;
  requireStatisticianCert: boolean;
  requireStrike: boolean;
}

export const DEFAULT_FINAL_OPTIONAL_GATES: FinalOptionalGateFlags = {
  requireInstruments: false,
  requireStatisticianCert: false,
  requireStrike: false,
};
