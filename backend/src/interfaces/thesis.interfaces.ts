export interface ApplyTitleDefenseInput {
    title1: string;
    title2: string;
    title3: string;
}

export interface RequestAdviserInput {
  requestedAdviserId: string;
  reason?: string;
}

export interface AssignAdviserInput {
  requestId: string;
}

export interface UpdateDefenseStatusInput {
  status: 'SCHEDULED' | 'PASSED' | 'FAILED' | 'REVISION';
}

export interface ScheduleDefenseInput {
  defenseDate: string;
  defenseTime: string;
  venueOrLink: string;
  defenseType: 'TITLE_DEFENSE' | 'PROPOSAL_DEFENSE' | 'FINAL_DEFENSE';
  panelistIds: string[]; // Array of User IDs to serve as the panel
}
