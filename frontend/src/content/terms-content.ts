export interface TermsSection {
  title: string;
  body: string;
}

export interface TermsContent {
  version: string;
  lastUpdated: string;
  sections: TermsSection[];
}

export const termsAndConditionsContent: TermsContent = {
  version: "1.0",
  lastUpdated: "November 2026",
  sections: [
    {
      title: "1. Acceptance of Terms",
      body: "By creating an account, accessing, or using the EARIST Graduate School Information System, you acknowledge that you have read, understood, and agreed to be bound by these Terms and Conditions and all applicable academic rules, policies, and guidelines established by Eulogio \"Amang\" Rodriguez Institute of Science and Technology (EARIST)."
    },
    {
      title: "2. Data Privacy Compliance (Republic Act No. 10173)",
      body: "In accordance with the Philippine Data Privacy Act of 2012 (RA 10173) and its Implementing Rules and Regulations, EARIST Graduate School is committed to protecting your personal information. Personal data collected (such as applicant identity, academic transcripts, Certificates of Registration, entrance examination results, and contact details) are processed strictly for legitimate academic administration, verification of enrollment, research repository archiving, and official institutional reporting. Your data will not be shared with unauthorized third parties without your explicit consent unless required by statutory obligation."
    },
    {
      title: "3. Account Security and User Responsibility",
      body: "You are solely responsible for safeguarding your login credentials (Applicant ID, Student Number, email, and password). You agree not to disclose your password to any third party and to notify the Graduate School administrator immediately of any unauthorized use or security breach of your account. Any action performed through your authenticated account is presumed to be your own official act."
    },
    {
      title: "4. Academic Integrity & Research Ethics",
      body: "All documents, examination answers, thesis/dissertation proposals, and final manuscripts submitted through this system must adhere to the highest standards of academic integrity. Plagiarism, falsification of research variable forms or statistician/grammarian certifications, ghostwriting, and unauthorized reliance on generative AI tools without proper attribution are strictly prohibited and will result in disciplinary action, rejection of manuscripts, or invalidation of defense proceedings."
    },
    {
      title: "5. Digital Signatures and Official E-Conformé",
      body: "Digital actions, electronic signatures, and approval conformés executed within this system—including Adviser Appointment conformés, Committee Oral Examination Score Sheets, and Committee Defense Reports (RAP)—carry the legal authority of an official manuscript certification under the Electronic Commerce Act of 2000 (RA 8792)."
    },
    {
      title: "6. Modifications to Terms",
      body: "EARIST reserves the right to modify these Terms and Conditions at any time. When material updates are made, users will be prompted to review and accept the revised terms upon their subsequent sign-in."
    }
  ]
};
