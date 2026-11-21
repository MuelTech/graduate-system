/**
 * Canonical registry of all 22 transactional email templates across the 4 GS-IS cycles.
 *
 * Explicitly excluded per institutional policy (zero spam / no redundant noise):
 * - rap_distributed, rap_finalized (signing is already required inside Defense Workspace)
 * - memo_broadcast, general_broadcast (Memos remain in-app only)
 * - strike_result (deferred until Objective 8 redesign)
 */

export type EmailCategory =
  | "ACCOUNTS"
  | "ADMISSIONS_EXAM"
  | "ACADEMIC"
  | "THESIS_DEFENSE"
  | "SYSTEM_TEST";

export interface EmailTemplateDefinition {
  templateKey: string;
  name: string;
  category: Exclude<EmailCategory, "SYSTEM_TEST">;
  categoryLabel: string;
  triggerEvent: string;
  recipientRole: string;
  variables: string[];
  variablesDescription: string;
  defaultSubject: string;
  defaultBodyHtml: string;
  ctaLabel: string;
  ctaVariable: string;
  sampleVariables: Record<string, string>;
}

export const EMAIL_CATEGORY_LABELS: Record<EmailCategory, string> = {
  ACCOUNTS: "Accounts & Security",
  ADMISSIONS_EXAM: "Entrance Exam & COR",
  ACADEMIC: "Academic & Comprehensive Exam",
  THESIS_DEFENSE: "Thesis & Dissertation",
  SYSTEM_TEST: "System Test",
};

/** Legacy or explicitly excluded templates cleaned up on seed and hidden from active workflows. */
export const RETIRED_EMAIL_TEMPLATE_KEYS = [
  "bridging_waiver_validated",
  "bridging_waiver_rejected",
  "alignment_aligned",
  "alignment_misaligned",
  "cor_verified",
  "memo_broadcast",
  "general_broadcast",
  "rap_distributed",
  "rap_finalized",
  "strike_result",
] as const;

export const EMAIL_TEMPLATE_REGISTRY: readonly EmailTemplateDefinition[] = [
  // ── Cycle 1: Accounts & Security (6) ────────────────────────────────────────
  {
    templateKey: "applicant_registered",
    name: "Applicant Registration Welcome",
    category: "ACCOUNTS",
    categoryLabel: EMAIL_CATEGORY_LABELS.ACCOUNTS,
    triggerEvent: "When a prospective student completes online examination registration",
    recipientRole: "Applicant",
    variables: ["recipient_name", "applicant_id", "program_name", "portal_link"],
    variablesDescription:
      "recipient_name, applicant_id, program_name, portal_link",
    defaultSubject: "Welcome to the EARIST Graduate School Portal",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>We are pleased to inform you that your online Entrance Examination account has been created in the EARIST Graduate School Information System.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e0d8;border-left:4px solid #8b1e1e;background:#faf8f5;border-radius:6px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#2c2c2c;">
    <strong>Applicant ID:</strong> {{applicant_id}}<br/>
    <strong>Applied Program:</strong> {{program_name}}
  </td></tr>
</table>
<p>Please sign in to the Applicant Portal using your Applicant ID and password to select an available Entrance Examination schedule.</p>`,
    ctaLabel: "Open Applicant Portal",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Maria Santos",
      applicant_id: "APP-2026-00412",
      program_name: "Master of Arts in Education major in Administration and Supervision",
      portal_link: "http://localhost:3000/login",
    },
  },
  {
    templateKey: "faculty_account_created",
    name: "Faculty Account Provisioned",
    category: "ACCOUNTS",
    categoryLabel: EMAIL_CATEGORY_LABELS.ACCOUNTS,
    triggerEvent: "When an Administrator creates a new Faculty account",
    recipientRole: "Faculty",
    variables: ["recipient_name", "login_email", "portal_link"],
    variablesDescription: "recipient_name, login_email, portal_link",
    defaultSubject: "Your EARIST Graduate School Faculty Account Is Ready",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>Please be informed that a Faculty account has been created for you in the EARIST Graduate School Information System.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e0d8;border-left:4px solid #8b1e1e;background:#faf8f5;border-radius:6px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#2c2c2c;">
    <strong>Sign-In Role:</strong> Faculty<br/>
    <strong>Email Address:</strong> {{login_email}}<br/>
    <strong>Temporary Password:</strong> Your LAST NAME in ALL CAPS
  </td></tr>
</table>
<p>For your account security, you will be required to set a new personal password upon your first sign-in.</p>`,
    ctaLabel: "Sign In to Faculty Portal",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Dr. Elena Reyes",
      login_email: "elena.reyes@earist.edu.ph",
      portal_link: "http://localhost:3000/login",
    },
  },
  {
    templateKey: "admin_account_created",
    name: "Administrator Account Provisioned",
    category: "ACCOUNTS",
    categoryLabel: EMAIL_CATEGORY_LABELS.ACCOUNTS,
    triggerEvent: "When a Full Administrator creates a new Administrator account",
    recipientRole: "Administrator",
    variables: ["recipient_name", "login_email", "access_level", "portal_link"],
    variablesDescription: "recipient_name, login_email, access_level, portal_link",
    defaultSubject: "Your EARIST Graduate School Administrator Account Is Ready",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>Please be informed that an Administrator account has been provisioned for you in the EARIST Graduate School Information System.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e0d8;border-left:4px solid #8b1e1e;background:#faf8f5;border-radius:6px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#2c2c2c;">
    <strong>Sign-In Role:</strong> Administrator ({{access_level}})<br/>
    <strong>Email Address:</strong> {{login_email}}<br/>
    <strong>Temporary Password:</strong> Your LAST NAME in ALL CAPS
  </td></tr>
</table>
<p>For your account security, you will be prompted to set a personal password immediately upon your first sign-in.</p>`,
    ctaLabel: "Sign In to Admin Portal",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Roberto Cruz",
      login_email: "roberto.cruz@earist.edu.ph",
      access_level: "Restricted Administrator",
      portal_link: "http://localhost:3000/login",
    },
  },
  {
    templateKey: "account_password_reset",
    name: "Admin-Assisted Password Reset",
    category: "ACCOUNTS",
    categoryLabel: EMAIL_CATEGORY_LABELS.ACCOUNTS,
    triggerEvent: "When an Administrator resets a user's password (Applicant, Student, Faculty, or Admin)",
    recipientRole: "All Roles",
    variables: ["recipient_name", "login_identifier", "portal_link"],
    variablesDescription: "recipient_name, login_identifier, portal_link",
    defaultSubject: "Notice of Account Password Reset",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>Please be informed that an Administrator has reset the password for your EARIST Graduate School Information System account. All previous active sessions have been signed out for your security.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e0d8;border-left:4px solid #8b1e1e;background:#faf8f5;border-radius:6px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#2c2c2c;">
    <strong>Account Identifier:</strong> {{login_identifier}}<br/>
    <strong>Temporary Password:</strong> Your LAST NAME in ALL CAPS
  </td></tr>
</table>
<p>You will be required to change your password immediately upon signing in. If you did not request this reset, please contact the Office of the Graduate School promptly.</p>`,
    ctaLabel: "Sign In and Change Password",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Juan Dela Cruz",
      login_identifier: "2026-GS-00125",
      portal_link: "http://localhost:3000/login",
    },
  },
  {
    templateKey: "password_reset_link",
    name: "Self-Service Password Reset Link",
    category: "ACCOUNTS",
    categoryLabel: EMAIL_CATEGORY_LABELS.ACCOUNTS,
    triggerEvent: "When a user submits a password reset request from the Forgot Password page",
    recipientRole: "All Roles",
    variables: ["recipient_name", "reset_link", "expiry_minutes"],
    variablesDescription: "recipient_name, reset_link, expiry_minutes",
    defaultSubject: "Password Reset Request: EARIST Graduate School Portal",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>We received a request to reset the password for your EARIST Graduate School Information System account.</p>
<p>Please select the button below to establish a new password. For your security, this link is valid for <strong>{{expiry_minutes}} minutes</strong> and may only be used once.</p>
<p style="font-size:13px;color:#555555;">If you did not initiate this request, you may safely disregard this notice. Your current password will remain unchanged.</p>`,
    ctaLabel: "Reset Password",
    ctaVariable: "reset_link",
    sampleVariables: {
      recipient_name: "Juan Dela Cruz",
      reset_link: "http://localhost:3000/reset-password?token=sample-preview-token",
      expiry_minutes: "30",
    },
  },
  {
    templateKey: "account_status_changed",
    name: "Account Status Updated",
    category: "ACCOUNTS",
    categoryLabel: EMAIL_CATEGORY_LABELS.ACCOUNTS,
    triggerEvent: "When an Administrator deactivates or reactivates a user account",
    recipientRole: "All Roles",
    variables: ["recipient_name", "status_label", "status_message", "portal_link"],
    variablesDescription:
      "recipient_name, status_label, status_message, portal_link",
    defaultSubject: "Notice of Account Status Update: {{status_label}}",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>Please be informed that the status of your EARIST Graduate School Information System account has been updated.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e0d8;border-left:4px solid #8b1e1e;background:#faf8f5;border-radius:6px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#2c2c2c;">
    <strong>Current Status:</strong> {{status_label}}<br/>
    {{status_message}}
  </td></tr>
</table>
<p>If you have questions regarding your account access, please coordinate with the Office of the Graduate School.</p>`,
    ctaLabel: "Open Graduate School Portal",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Juan Dela Cruz",
      status_label: "Reactivated",
      status_message: "Your portal access has been restored and you may sign in normally.",
      portal_link: "http://localhost:3000/login",
    },
  },

  // ── Cycle 2: Entrance Examination & COR Onboarding (7) ──────────────────────
  {
    templateKey: "exam_scheduled",
    name: "Entrance Examination Scheduled",
    category: "ADMISSIONS_EXAM",
    categoryLabel: EMAIL_CATEGORY_LABELS.ADMISSIONS_EXAM,
    triggerEvent: "When an Applicant books a slot, is assigned by Admin, or has a reschedule approved",
    recipientRole: "Applicant",
    variables: ["recipient_name", "program_name", "exam_date", "exam_time", "portal_link"],
    variablesDescription:
      "recipient_name, program_name, exam_date, exam_time, portal_link",
    defaultSubject: "Entrance Examination Schedule Confirmed: {{exam_date}}",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>Please be informed that your online Graduate School Entrance Examination schedule has been confirmed.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e0d8;border-left:4px solid #8b1e1e;background:#faf8f5;border-radius:6px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#2c2c2c;">
    <strong>Program:</strong> {{program_name}}<br/>
    <strong>Date:</strong> {{exam_date}}<br/>
    <strong>Time:</strong> {{exam_time}} (Philippine Time)
  </td></tr>
</table>
<p>Kindly sign in to your Applicant Portal prior to your scheduled examination time using a reliable device and stable internet connection.</p>`,
    ctaLabel: "View Examination Schedule",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Maria Santos",
      program_name: "Master in Business Administration",
      exam_date: "November 28, 2026",
      exam_time: "9:00 AM",
      portal_link: "http://localhost:3000/applicant/schedule",
    },
  },
  {
    templateKey: "exam_reminder_24h",
    name: "Entrance Examination 24-Hour Reminder",
    category: "ADMISSIONS_EXAM",
    categoryLabel: EMAIL_CATEGORY_LABELS.ADMISSIONS_EXAM,
    triggerEvent: "Automated daily check at 8:00 AM (Philippine Time) for examinations scheduled tomorrow",
    recipientRole: "Applicant",
    variables: ["recipient_name", "program_name", "exam_date", "exam_time", "portal_link"],
    variablesDescription:
      "recipient_name, program_name, exam_date, exam_time, portal_link",
    defaultSubject: "Reminder: Entrance Examination Tomorrow ({{exam_date}})",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>This is a courtesy reminder that your online Graduate School Entrance Examination is scheduled for tomorrow.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e0d8;border-left:4px solid #8b1e1e;background:#faf8f5;border-radius:6px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#2c2c2c;">
    <strong>Program:</strong> {{program_name}}<br/>
    <strong>Date:</strong> {{exam_date}}<br/>
    <strong>Time:</strong> {{exam_time}} (Philippine Time)
  </td></tr>
</table>
<p>Please ensure that your device and internet connection are ready ahead of your scheduled examination window.</p>`,
    ctaLabel: "Open Applicant Portal",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Maria Santos",
      program_name: "Master in Business Administration",
      exam_date: "November 28, 2026",
      exam_time: "9:00 AM",
      portal_link: "http://localhost:3000/applicant/exam",
    },
  },
  {
    templateKey: "ecat_result_pass",
    name: "Entrance Examination Result: Passed",
    category: "ADMISSIONS_EXAM",
    categoryLabel: EMAIL_CATEGORY_LABELS.ADMISSIONS_EXAM,
    triggerEvent: "When an Administrator releases a PASSED Entrance Examination result",
    recipientRole: "Applicant",
    variables: ["recipient_name", "portal_link"],
    variablesDescription: "recipient_name, portal_link",
    defaultSubject: "Entrance Examination Result: Passed",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>Congratulations. We are pleased to inform you that you have <strong>passed</strong> the EARIST Graduate School Entrance Examination.</p>
<p>Once officially enrolled, please sign in to your Applicant Portal and upload your official Certificate of Registration (COR) so that your account may be upgraded to Graduate Student status.</p>`,
    ctaLabel: "View Result and Upload COR",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Maria Santos",
      portal_link: "http://localhost:3000/applicant/results",
    },
  },
  {
    templateKey: "ecat_result_fail",
    name: "Entrance Examination Result: Did Not Pass",
    category: "ADMISSIONS_EXAM",
    categoryLabel: EMAIL_CATEGORY_LABELS.ADMISSIONS_EXAM,
    triggerEvent: "When an Administrator releases a FAILED Entrance Examination result",
    recipientRole: "Applicant",
    variables: ["recipient_name", "portal_link"],
    variablesDescription: "recipient_name, portal_link",
    defaultSubject: "Entrance Examination Result Released",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>Please be informed that the result of your EARIST Graduate School Entrance Examination has been released. We regret to inform you that your score did not meet the required passing threshold.</p>
<p>You may sign in to your Applicant Portal to review your result summary or coordinate with the Office of the Graduate School for further guidance.</p>`,
    ctaLabel: "View Examination Result",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Maria Santos",
      portal_link: "http://localhost:3000/applicant/results",
    },
  },
  {
    templateKey: "ecat_result_reconsidered",
    name: "Entrance Examination Result: Passed (Reconsidered)",
    category: "ADMISSIONS_EXAM",
    categoryLabel: EMAIL_CATEGORY_LABELS.ADMISSIONS_EXAM,
    triggerEvent: "When an Administrator records a Passed (Reconsidered) decision",
    recipientRole: "Applicant",
    variables: ["recipient_name", "portal_link"],
    variablesDescription: "recipient_name, portal_link",
    defaultSubject: "Entrance Examination Decision: Passed (Reconsidered)",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>Following administrative review, please be informed that your Entrance Examination decision has been recorded as <strong>Passed (Reconsidered)</strong>.</p>
<p>Once officially enrolled, you may proceed to upload your official Certificate of Registration (COR) through your Applicant Portal.</p>`,
    ctaLabel: "Open Applicant Portal",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Maria Santos",
      portal_link: "http://localhost:3000/applicant/cor-upload",
    },
  },
  {
    templateKey: "credential_dispatch",
    name: "COR Verified & Promoted to Student",
    category: "ADMISSIONS_EXAM",
    categoryLabel: EMAIL_CATEGORY_LABELS.ADMISSIONS_EXAM,
    triggerEvent: "When an Administrator verifies an Applicant's COR and promotes the account to Student",
    recipientRole: "Student",
    variables: ["recipient_name", "student_number", "portal_link"],
    variablesDescription: "recipient_name, student_number, portal_link",
    defaultSubject: "Certificate of Registration Verified: Welcome to the Graduate Student Portal",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>We are pleased to inform you that your Certificate of Registration (COR) has been verified and your account has been officially upgraded to <strong>Graduate Student</strong> status.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e0d8;border-left:4px solid #8b1e1e;background:#faf8f5;border-radius:6px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#2c2c2c;">
    <strong>Student Number:</strong> {{student_number}}<br/>
    <strong>Password:</strong> Your existing account password
  </td></tr>
</table>
<p>Please sign in by selecting <strong>Student</strong> on the portal login page using your official Student Number and your existing account password.</p>`,
    ctaLabel: "Sign In to Student Portal",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Maria Santos",
      student_number: "2026-GS-00148",
      program_name: "Master in Business Administration",
      portal_link: "http://localhost:3000/login",
    },
  },
  {
    templateKey: "cor_rejected",
    name: "COR Submission Needs Re-Upload",
    category: "ADMISSIONS_EXAM",
    categoryLabel: EMAIL_CATEGORY_LABELS.ADMISSIONS_EXAM,
    triggerEvent: "When an Administrator rejects an Applicant's uploaded COR",
    recipientRole: "Applicant",
    variables: ["recipient_name", "remarks", "portal_link"],
    variablesDescription: "recipient_name, remarks, portal_link",
    defaultSubject: "Action Required: Certificate of Registration Returned for Resubmission",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>Please be informed that your submitted Certificate of Registration (COR) could not be verified and requires resubmission.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e0d8;border-left:4px solid #8b1e1e;background:#faf8f5;border-radius:6px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#2c2c2c;">
    <strong>Reviewer Remarks:</strong> {{remarks}}
  </td></tr>
</table>
<p>Kindly sign in to your Applicant Portal to upload a clear and complete copy of your official Certificate of Registration.</p>`,
    ctaLabel: "Resubmit COR",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Maria Santos",
      remarks: "The uploaded file was cropped and the Student Number was not readable.",
      portal_link: "http://localhost:3000/applicant/cor-upload",
    },
  },

  // ── Cycle 3: Academic Progress & Comprehensive Exam (2) ─────────────────────
  {
    templateKey: "comp_exam_recorded",
    name: "Written Comprehensive Examination Result",
    category: "ACADEMIC",
    categoryLabel: EMAIL_CATEGORY_LABELS.ACADEMIC,
    triggerEvent: "When an Administrator records or updates a Written Comprehensive Examination attempt",
    recipientRole: "Student",
    variables: ["recipient_name", "attempt_number", "result", "outcome_note", "portal_link"],
    variablesDescription:
      "recipient_name, attempt_number, result, outcome_note, portal_link",
    defaultSubject: "Written Comprehensive Examination Result: {{result}}",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>Please be informed that your Written Comprehensive Examination record has been officially updated in the EARIST Graduate School Information System.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e0d8;border-left:4px solid #8b1e1e;background:#faf8f5;border-radius:6px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#2c2c2c;">
    <strong>Attempt:</strong> Attempt {{attempt_number}} of 3<br/>
    <strong>Result:</strong> {{result}}<br/>
    <strong>Remarks:</strong> {{outcome_note}}
  </td></tr>
</table>
<p>Kindly sign in to your Student Portal to review your academic standing and next program requirements.</p>`,
    ctaLabel: "View Academic Journey",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Juan Dela Cruz",
      attempt_number: "1",
      result: "Passed",
      outcome_note: "You are now eligible to proceed with your Title Defense application.",
      portal_link: "http://localhost:3000/student/journey",
    },
  },
  {
    templateKey: "residency_warning",
    name: "Maximum Residency Advisory",
    category: "ACADEMIC",
    categoryLabel: EMAIL_CATEGORY_LABELS.ACADEMIC,
    triggerEvent: "When a residency advisory is issued for a Student approaching maximum residence",
    recipientRole: "Student",
    variables: ["recipient_name", "warning_details", "portal_link"],
    variablesDescription: "recipient_name, warning_details, portal_link",
    defaultSubject: "Official Advisory: Graduate Program Residency Standing",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>Please be informed that this is an official advisory regarding your graduate program residency timeline.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e0d8;border-left:4px solid #8b1e1e;background:#faf8f5;border-radius:6px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#2c2c2c;">
    <strong>Advisory Details:</strong> {{warning_details}}
  </td></tr>
</table>
<p>Kindly coordinate with your Adviser and the Office of the Graduate School to plan the timely completion of your remaining academic requirements.</p>`,
    ctaLabel: "View Student Profile",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Juan Dela Cruz",
      warning_details: "You are entering the final year of your 4-year Master's maximum residence period.",
      portal_link: "http://localhost:3000/student/profile",
    },
  },

  // ── Cycle 4: Thesis & Dissertation Lifecycle (7) ────────────────────────────
  {
    templateKey: "adviser_request_received",
    name: "New Adviser Request Received",
    category: "THESIS_DEFENSE",
    categoryLabel: EMAIL_CATEGORY_LABELS.THESIS_DEFENSE,
    triggerEvent: "When a Student submits a signed Adviser Request to an eligible Faculty member",
    recipientRole: "Faculty",
    variables: ["recipient_name", "student_name", "program_name", "portal_link"],
    variablesDescription:
      "recipient_name, student_name, program_name, portal_link",
    defaultSubject: "New Thesis/Dissertation Adviser Request: {{student_name}}",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>Please be informed that a graduate student has submitted an official Adviser Request nominating you to serve as their Thesis/Dissertation Adviser.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e0d8;border-left:4px solid #8b1e1e;background:#faf8f5;border-radius:6px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#2c2c2c;">
    <strong>Student:</strong> {{student_name}}<br/>
    <strong>Program:</strong> {{program_name}}
  </td></tr>
</table>
<p>Kindly sign in to the Faculty Portal to review the request and record your Conforme or Decline decision.</p>`,
    ctaLabel: "Review Adviser Request",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Dr. Elena Reyes",
      student_name: "Juan Dela Cruz",
      program_name: "Master of Arts in Teaching major in Mathematics",
      portal_link: "http://localhost:3000/panelist/adviser-requests",
    },
  },
  {
    templateKey: "adviser_assigned",
    name: "Official Adviser Assignment Confirmed",
    category: "THESIS_DEFENSE",
    categoryLabel: EMAIL_CATEGORY_LABELS.THESIS_DEFENSE,
    triggerEvent: "When the Dean approves a conformed Adviser Request",
    recipientRole: "Student & Faculty",
    variables: ["recipient_name", "student_name", "adviser_name", "portal_link"],
    variablesDescription:
      "recipient_name, student_name, adviser_name, portal_link",
    defaultSubject: "Official Adviser Assignment Approved: {{student_name}}",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>Please be informed that the Dean of the Graduate School has approved the Adviser Request. The official Adviser assignment is now active.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e0d8;border-left:4px solid #8b1e1e;background:#faf8f5;border-radius:6px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#2c2c2c;">
    <strong>Student:</strong> {{student_name}}<br/>
    <strong>Assigned Adviser:</strong> {{adviser_name}}
  </td></tr>
</table>
<p>You may sign in to the portal to view or download the finalized Adviser Request record.</p>`,
    ctaLabel: "View Adviser Assignment",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Juan Dela Cruz",
      student_name: "Juan Dela Cruz",
      adviser_name: "Dr. Elena Reyes",
      portal_link: "http://localhost:3000/student/thesis/adviser-request",
    },
  },
  {
    templateKey: "adviser_request_declined",
    name: "Adviser Request Not Approved",
    category: "THESIS_DEFENSE",
    categoryLabel: EMAIL_CATEGORY_LABELS.THESIS_DEFENSE,
    triggerEvent: "When the requested Faculty declines OR the Dean rejects an Adviser Request",
    recipientRole: "Student",
    variables: ["recipient_name", "decision_label", "remarks", "portal_link"],
    variablesDescription:
      "recipient_name, decision_label, remarks, portal_link",
    defaultSubject: "Adviser Request Status Update: {{decision_label}}",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>Please be informed that your recent Adviser Request was not finalized.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e0d8;border-left:4px solid #8b1e1e;background:#faf8f5;border-radius:6px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#2c2c2c;">
    <strong>Status:</strong> {{decision_label}}<br/>
    <strong>Remarks:</strong> {{remarks}}
  </td></tr>
</table>
<p>Kindly sign in to your Student Portal to select another eligible Adviser and submit a new request.</p>`,
    ctaLabel: "Open Adviser Request",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Juan Dela Cruz",
      decision_label: "Declined by Faculty",
      remarks: "Currently at full advising load for this semester.",
      portal_link: "http://localhost:3000/student/thesis/adviser-request",
    },
  },
  {
    templateKey: "defense_application_status",
    name: "Defense Application Reviewed",
    category: "THESIS_DEFENSE",
    categoryLabel: EMAIL_CATEGORY_LABELS.THESIS_DEFENSE,
    triggerEvent: "When an Administrator approves or rejects a Title, Proposal, or Final Defense Application",
    recipientRole: "Student",
    variables: ["recipient_name", "defense_stage", "status_label", "remarks", "portal_link"],
    variablesDescription:
      "recipient_name, defense_stage, status_label, remarks, portal_link",
    defaultSubject: "{{defense_stage}} Defense Application: {{status_label}}",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>Please be informed that your <strong>{{defense_stage}} Defense</strong> application has been reviewed by the Office of the Graduate School.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e0d8;border-left:4px solid #8b1e1e;background:#faf8f5;border-radius:6px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#2c2c2c;">
    <strong>Defense Stage:</strong> {{defense_stage}} Defense<br/>
    <strong>Decision:</strong> {{status_label}}<br/>
    <strong>Remarks:</strong> {{remarks}}
  </td></tr>
</table>
<p>Kindly sign in to your Student Portal to review the current status and next steps.</p>`,
    ctaLabel: "Open Defense Portal",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Juan Dela Cruz",
      defense_stage: "Proposal",
      status_label: "Approved for Scheduling",
      remarks: "All submitted requirements are complete. Please wait for your defense schedule.",
      portal_link: "http://localhost:3000/student/thesis/proposal-defense",
    },
  },
  {
    templateKey: "defense_schedule",
    name: "Defense Schedule Notification (Student)",
    category: "THESIS_DEFENSE",
    categoryLabel: EMAIL_CATEGORY_LABELS.THESIS_DEFENSE,
    triggerEvent: "When an Administrator schedules a defense OR updates date, time, or venue before start",
    recipientRole: "Student",
    variables: [
      "recipient_name",
      "defense_stage",
      "schedule_action",
      "schedule_message",
      "defense_date",
      "defense_time",
      "venue",
      "portal_link",
    ],
    variablesDescription:
      "recipient_name, defense_stage, schedule_action, schedule_message, defense_date, defense_time, venue, portal_link",
    defaultSubject: "{{defense_stage}} Defense {{schedule_action}}: {{defense_date}}",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>{{schedule_message}}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e0d8;border-left:4px solid #8b1e1e;background:#faf8f5;border-radius:6px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#2c2c2c;">
    <strong>Defense Stage:</strong> {{defense_stage}} Defense<br/>
    <strong>Date:</strong> {{defense_date}}<br/>
    <strong>Time:</strong> {{defense_time}} (Philippine Time)<br/>
    <strong>Venue:</strong> {{venue}}
  </td></tr>
</table>
<p>Please sign in to your Student Portal to review your defense details and finalized Defense Application record.</p>`,
    ctaLabel: "View Defense Details",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Juan Dela Cruz",
      defense_stage: "Proposal",
      schedule_action: "Scheduled",
      schedule_message:
        "Please be informed that your Proposal Defense has been officially scheduled by the Office of the Graduate School.",
      defense_date: "December 5, 2026",
      defense_time: "2:00 PM",
      venue: "Graduate School Conference Room A",
      portal_link: "http://localhost:3000/student/thesis/proposal-defense",
    },
  },
  {
    templateKey: "defense_panel_assignment",
    name: "Defense Committee Assignment / Update (Faculty)",
    category: "THESIS_DEFENSE",
    categoryLabel: EMAIL_CATEGORY_LABELS.THESIS_DEFENSE,
    triggerEvent: "When Faculty is assigned to, updated on, or removed from a scheduled defense committee",
    recipientRole: "Faculty",
    variables: [
      "recipient_name",
      "assignment_action",
      "assignment_message",
      "panel_role",
      "student_name",
      "defense_stage",
      "defense_date",
      "defense_time",
      "venue",
      "portal_link",
    ],
    variablesDescription:
      "recipient_name, assignment_action, assignment_message, panel_role, student_name, defense_stage, defense_date, defense_time, venue, portal_link",
    defaultSubject:
      "Notice of Defense Committee {{assignment_action}}: {{defense_stage}} Defense ({{student_name}})",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>{{assignment_message}}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e0d8;border-left:4px solid #8b1e1e;background:#faf8f5;border-radius:6px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#2c2c2c;">
    <strong>Student:</strong> {{student_name}}<br/>
    <strong>Defense Stage:</strong> {{defense_stage}} Defense<br/>
    <strong>Committee Role:</strong> {{panel_role}}<br/>
    <strong>Date:</strong> {{defense_date}}<br/>
    <strong>Time:</strong> {{defense_time}} (Philippine Time)<br/>
    <strong>Venue:</strong> {{venue}}
  </td></tr>
</table>
<p>Please sign in to the Faculty Portal to review the manuscript and defense details prior to the scheduled session.</p>`,
    ctaLabel: "Open Defense Workspace",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Dr. Elena Reyes",
      assignment_action: "Assignment",
      assignment_message:
        "You have been formally designated to serve as Panelist for the Proposal Defense of Juan Dela Cruz.",
      panel_role: "Panelist",
      student_name: "Juan Dela Cruz",
      defense_stage: "Proposal",
      defense_date: "December 5, 2026",
      defense_time: "2:00 PM",
      venue: "Graduate School Conference Room A",
      portal_link: "http://localhost:3000/panelist/defenses",
    },
  },
  {
    templateKey: "defense_concluded",
    name: "Official Defense Verdict Released",
    category: "THESIS_DEFENSE",
    categoryLabel: EMAIL_CATEGORY_LABELS.THESIS_DEFENSE,
    triggerEvent: "When an Administrator concludes a defense and releases the official verdict",
    recipientRole: "Student",
    variables: ["recipient_name", "defense_stage", "verdict_label", "remarks", "portal_link"],
    variablesDescription:
      "recipient_name, defense_stage, verdict_label, remarks, portal_link",
    defaultSubject: "Official {{defense_stage}} Defense Verdict Released: {{verdict_label}}",
    defaultBodyHtml: `<p>Dear {{recipient_name}},</p>
<p>Please be informed that the official verdict for your <strong>{{defense_stage}} Defense</strong> has been recorded.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e0d8;border-left:4px solid #8b1e1e;background:#faf8f5;border-radius:6px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#2c2c2c;">
    <strong>Defense Stage:</strong> {{defense_stage}} Defense<br/>
    <strong>Official Verdict:</strong> {{verdict_label}}<br/>
    <strong>Remarks:</strong> {{remarks}}
  </td></tr>
</table>
<p>Kindly sign in to your Student Portal to review the complete defense outcome and your next academic requirements.</p>`,
    ctaLabel: "View Defense Outcome",
    ctaVariable: "portal_link",
    sampleVariables: {
      recipient_name: "Juan Dela Cruz",
      defense_stage: "Proposal",
      verdict_label: "Passed with Minor Revisions",
      remarks: "Address the panel recommendations before proceeding to data gathering.",
      portal_link: "http://localhost:3000/student/journey",
    },
  },
] as const;

const REGISTRY_MAP = new Map<string, EmailTemplateDefinition>(
  EMAIL_TEMPLATE_REGISTRY.map((entry) => [entry.templateKey, entry]),
);

export function getTemplateDefinition(
  templateKey: string,
): EmailTemplateDefinition | undefined {
  return REGISTRY_MAP.get(templateKey);
}

export function isRetiredTemplateKey(templateKey: string): boolean {
  return (RETIRED_EMAIL_TEMPLATE_KEYS as readonly string[]).includes(
    templateKey,
  );
}
