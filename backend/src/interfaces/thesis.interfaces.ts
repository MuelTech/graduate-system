export interface ApplyTitleDefenseInput {
    title1: string;
    title2: string;
    title3: string;
}

export interface RequestAdviserInput {
  requestedAdviserId: string;
  reason?: string;
}

export type AdviserResponseDecision = "CONFORMED" | "DECLINED";

export interface AdviserResponseInput {
  decision: AdviserResponseDecision;
  remarks?: string;
}

export type DeanDecision = "APPROVED" | "REJECTED";

export interface DeanResponseInput {
  decision: DeanDecision;
  remarks?: string;
}

export interface AssignAdviserInput {
  requestId: string;
}

export interface UpdateDefenseStatusInput {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface ScheduleDefenseInput {
  defenseDate: string;
  defenseTime: string;
  venueOrLink: string;
  defenseType: 'TITLE_DEFENSE' | 'PROPOSAL_DEFENSE' | 'FINAL_DEFENSE';
  panelistIds: string[]; // Array of User IDs to serve as the panel
}
