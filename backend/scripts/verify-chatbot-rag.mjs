import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const ts = require(path.join(backendDir, "node_modules/typescript"));

function loadChatbotRagModule() {
  const knowledgePath = path.join(backendDir, "src/data/chatbot-knowledge.json");
  const ragPath = path.join(backendDir, "src/services/chatbot-rag.service.ts");

  const knowledgeJson = JSON.parse(fs.readFileSync(knowledgePath, "utf8"));
  const tsSource = fs.readFileSync(ragPath, "utf8");

  const transpiled = ts.transpileModule(tsSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });

  const moduleObj = { exports: {} };
  const customRequire = (specifier) => {
    if (specifier === "../data/chatbot-knowledge.json") {
      return knowledgeJson;
    }
    return require(specifier);
  };

  const wrappedFn = new vm.Script(
    `(function(exports, require, module, __filename, __dirname) {\n${transpiled.outputText}\n})`,
  );
  const compiled = wrappedFn.runInThisContext();
  compiled(
    moduleObj.exports,
    customRequire,
    moduleObj,
    ragPath,
    path.dirname(ragPath),
  );

  return moduleObj.exports;
}

const rag = loadChatbotRagModule();

/**
 * 70 representative evaluation queries covering:
 * - English, Tagalog, and Taglish Handbook policies (Sec 1.0–21.0)
 * - Role-based System Navigation & Configured FAQs (Public, Applicant, Student, Faculty, Admin)
 * - Identity, Conversational, and Out-of-Scope boundary enforcement
 */
const BENCHMARK_CASES = [
  // --- Manual Sec 1.0–4.0: History & Institutional ---
  {
    id: "Q01",
    query: "When was EARIST founded and what law converted it into a chartered state college?",
    role: "public",
    expectedLang: "en",
    expectedIds: ["history-earist-founding-laws"],
  },
  {
    id: "Q02",
    query: "Sino ang kasalukuyang presidente ng EARIST?",
    role: "public",
    expectedLang: ["tl", "taglish"],
    expectedIds: ["history-earist-presidents"],
  },
  {
    id: "Q03",
    query: "Anong graduate programs ang ino-offer sa EARIST Cavite Campus?",
    role: "applicant",
    expectedLang: ["tl", "taglish"],
    expectedIds: ["history-cavite-campus"],
  },
  {
    id: "Q04",
    query: "What is the Vision and Mission of EARIST?",
    role: "public",
    expectedLang: "en",
    expectedIds: ["institutional-philosophy-vision-mission"],
  },
  {
    id: "Q05",
    query: "Who composes the Graduate School Council?",
    role: "faculty",
    expectedLang: "en",
    expectedIds: ["organizational-structure-gsc"],
  },

  // --- Manual Sec 5.0–6.0: Programs & Faculty ---
  {
    id: "Q06",
    query: "What doctoral programs does EARIST Graduate School offer?",
    role: "public",
    expectedLang: "en",
    expectedIds: ["programs-doctoral"],
  },
  {
    id: "Q07",
    query: "Anong mga major under MAEd and MAT?",
    role: "applicant",
    expectedLang: "taglish",
    expectedIds: ["programs-masters-education-teaching"],
  },
  {
    id: "Q08",
    query: "May MBA, MPA, or MS Mathematics ba sa EARIST Graduate School?",
    role: "public",
    expectedLang: "taglish",
    expectedIds: ["programs-masters-business-public-math-psych"],
  },
  {
    id: "Q09",
    query: "Can a faculty member with only doctoral units serve as thesis adviser?",
    role: "faculty",
    expectedLang: "en",
    expectedIds: ["faculty-qualifications-cmo15", "thesis-adviser-selection-ratio"],
  },

  // --- Manual Sec 7.1–7.3: Admissions, GWA & Bridging ---
  {
    id: "Q10",
    query: "Ano ang mga general admission requirements sa pag-apply sa Graduate School?",
    role: "applicant",
    expectedLang: "taglish",
    expectedIds: ["admission-general-requirements"],
  },
  {
    id: "Q11",
    query: "What additional requirements apply to international students?",
    role: "public",
    expectedLang: "en",
    expectedIds: ["admission-international-students"],
  },
  {
    id: "Q12",
    query: "Kailangan ba ng 5 years work experience sa EdD, DBA, o DPA?",
    role: "applicant",
    expectedLang: ["tl", "taglish"],
    expectedIds: ["admission-by-track-experience"],
  },
  {
    id: "Q13",
    query: "What GWA is required for Master's admission and how does probationary status work?",
    role: "applicant",
    expectedLang: "en",
    expectedIds: ["admission-gwa-probationary"],
  },
  {
    id: "Q14",
    query: "Paano pag hindi aligned yung bachelor's degree ko sa kukunin kong Master's?",
    role: "applicant",
    expectedLang: "taglish",
    expectedIds: ["admission-bridging-profed-nonthesis"],
  },

  // --- Manual Sec 7.4–7.14: Load, Transfer, Attendance, MRR, LOA, Shifting ---
  {
    id: "Q15",
    query: "Ilang units ang maximum load kapag new student o old student?",
    role: "student",
    expectedLang: "taglish",
    expectedIds: ["policy-academic-load"],
  },
  {
    id: "Q16",
    query: "How many units can transferees credit from another graduate school?",
    role: "applicant",
    expectedLang: "en",
    expectedIds: ["policy-transfer-credits"],
  },
  {
    id: "Q17",
    query: "Pwede ba mag-enroll sa dalawang graduate programs nang sabay?",
    role: "student",
    expectedLang: "taglish",
    expectedIds: ["policy-dual-registration"],
  },
  {
    id: "Q18",
    query: "Ilang percent ng unexcused absences bago ma-drop sa klase?",
    role: "student",
    expectedLang: ["tl", "taglish"],
    expectedIds: ["policy-class-attendance"],
  },
  {
    id: "Q19",
    query: "When is the deadline to drop a course with the Dean's approval?",
    role: "student",
    expectedLang: "en",
    expectedIds: ["policy-dropping-courses"],
  },
  {
    id: "Q20",
    query: "What GWA must Master's and Doctoral students maintain for retention?",
    role: "student",
    expectedLang: "en",
    expectedIds: ["policy-retention-gwa"],
  },
  {
    id: "Q21",
    query: "Ilang taon ang Maximum Residence Rule para matapos ang Master's at Doctoral?",
    role: "student",
    expectedLang: ["tl", "taglish"],
    expectedIds: ["policy-maximum-residence-rule"],
  },
  {
    id: "Q22",
    query: "How long can I file a Leave of Absence (LOA) and does it count toward MRR?",
    role: "student",
    expectedLang: "en",
    expectedIds: ["policy-leave-of-absence"],
  },
  {
    id: "Q23",
    query: "Pwede ba mag-shift ng program pagkatapos ng Title Proposal?",
    role: "student",
    expectedLang: "taglish",
    expectedIds: ["policy-change-of-program-shifting"],
  },

  // --- Manual Sec 7.15–7.27: Compre Exam, Grading, Thesis, Gown ---
  {
    id: "Q24",
    query: "Ano ang passing score sa Written Comprehensive Exam at ilang beses pwedeng mag-retake?",
    role: "student",
    expectedLang: "taglish",
    expectedIds: ["policy-comprehensive-examination"],
  },
  {
    id: "Q25",
    query: "What is the grading scale for Master's vs. Doctoral courses?",
    role: "student",
    expectedLang: "en",
    expectedIds: ["policy-grading-system"],
  },
  {
    id: "Q26",
    query: "How long do I have to remove an INC grade and can I get a 1.0?",
    role: "student",
    expectedLang: "en",
    expectedIds: ["policy-inc-removal"],
  },
  {
    id: "Q27",
    query: "What chapters are included in Proposal Defense vs Final Defense?",
    role: "student",
    expectedLang: "en",
    expectedIds: ["thesis-defense-stages-contents"],
  },
  {
    id: "Q28",
    query: "Who pays the panelists' fee for a re-defense?",
    role: "student",
    expectedLang: "en",
    expectedIds: ["thesis-oral-defense-redefense"],
  },
  {
    id: "Q29",
    query: "Ilang estudyante lang ang pwedeng hawakan ng isang thesis adviser per semester?",
    role: "faculty",
    expectedLang: "taglish",
    expectedIds: ["thesis-adviser-selection-ratio"],
  },
  {
    id: "Q30",
    query: "Ilang araw bago ang scheduled defense kailangan ipasa ang manuscript?",
    role: "student",
    expectedLang: "taglish",
    expectedIds: ["thesis-manuscript-submission-deadlines"],
  },
  {
    id: "Q31",
    query: "Is journal publication required before graduating from EARIST Graduate School?",
    role: "student",
    expectedLang: "en",
    expectedIds: ["graduation-requirements-publication"],
  },
  {
    id: "Q32",
    query: "Anong kulay ng toga para sa MBA, MAEd, at PhD?",
    role: "student",
    expectedLang: ["tl", "taglish"],
    expectedIds: ["graduation-academic-costume"],
  },

  // --- Manual Sec 8.0–21.0: Fees, GAD/PWD, Journal, AI Ethics, Modalities, Scholarships, Incentives, OSH ---
  {
    id: "Q33",
    query: "What accommodations exist for PWDs and students with special needs?",
    role: "public",
    expectedLang: "en",
    expectedIds: ["policies-gad-diversity-pwd"],
  },
  {
    id: "Q34",
    query: "What formatting and word count are required for EARIST GS Journal submissions?",
    role: "faculty",
    expectedLang: "en",
    expectedIds: ["publications-gs-journal"],
  },
  {
    id: "Q35",
    query: "Pwede ba gumamit ng ChatGPT o Grammarly sa paggawa ng thesis?",
    role: "student",
    expectedLang: "taglish",
    expectedIds: ["research-ethics-ai-policy"],
  },
  {
    id: "Q36",
    query: "May online class ba o pure face-to-face sa Graduate School?",
    role: "applicant",
    expectedLang: "taglish",
    expectedIds: ["learning-modalities"],
  },
  {
    id: "Q37",
    query: "Are FEGSSC officers or EARIST personnel eligible for fee refunds or exemptions?",
    role: "student",
    expectedLang: "en",
    expectedIds: ["scholarships-awards-privileges"],
  },
  {
    id: "Q38",
    query: "Magkano ang cash incentive para sa copyrighted software o creative work?",
    role: "faculty",
    expectedLang: "taglish",
    expectedIds: ["creative-work-agenda-incentives"],
  },
  {
    id: "Q39",
    query: "How often are emergency drills and OSH safety audits conducted?",
    role: "faculty",
    expectedLang: "en",
    expectedIds: ["osh-safety-health-policy"],
  },

  // --- System Navigation & Role Workflows ---
  {
    id: "Q40",
    query: "Paano mag-apply at kumuha ng Pinnacle Applicant ID?",
    role: "public",
    expectedLang: "taglish",
    expectedIds: ["system-apply-pinnacle-register"],
  },
  {
    id: "Q41",
    query: "Paano magpa-schedule ng Entrance Exam sa Applicant Portal?",
    role: "applicant",
    expectedLang: "taglish",
    expectedIds: ["applicant-exam-schedule-booking"],
  },
  {
    id: "Q42",
    query: "How many items are in the online Entrance Exam and does it include an essay?",
    role: "applicant",
    expectedLang: "en",
    expectedIds: ["applicant-exam-execution-engine"],
  },
  {
    id: "Q43",
    query: "Paano mag-upload ng COR pagkatapos mag-enroll sa Pinnacle?",
    role: "applicant",
    expectedLang: "taglish",
    expectedIds: ["applicant-cor-upload-promotion"],
  },
  {
    id: "Q44",
    query: "Ano ang passing similarity percentage sa STRIKE plagiarism check?",
    role: "student",
    expectedLang: "taglish",
    expectedIds: ["student-strike-plagiarism-guide"],
  },
  {
    id: "Q45",
    query: "How do Faculty panelists annotate PDF manuscripts and enter rubric scores?",
    role: "faculty",
    expectedLang: "en",
    expectedIds: ["faculty-defenses-workspace-guide"],
  },
  {
    id: "Q46",
    query: "Saan mag-grade ng Applicant Entrance Exam essays ang Faculty?",
    role: "faculty",
    expectedLang: "taglish",
    expectedIds: ["faculty-advisees-essays-signatures-guide"],
  },
  {
    id: "Q47",
    query: "Ano ang responsibilities ng Administrator sa Graduate School system?",
    role: "admin",
    expectedLang: "taglish",
    expectedIds: ["admin-role-overview", "admin-settings-emails-curricula-guide"],
  },
  {
    id: "Q48",
    query: "What is the email, phone number, and address of EARIST Graduate School?",
    role: "public",
    expectedLang: "en",
    expectedIds: ["system-contact-evaluation-guides"],
  },

  // --- Out-of-Scope Fallback Enforcement ---
  {
    id: "Q49",
    query: "What is the weather forecast in Manila tomorrow?",
    role: "public",
    expectedLang: "en",
    expectOutOfScope: true,
  },
  {
    id: "Q50",
    query: "Ano ang masarap na recipe para sa chicken adobo?",
    role: "student",
    expectedLang: ["tl", "taglish"],
    expectOutOfScope: true,
  },
  {
    id: "Q51",
    query: "Ano ang process ng thesis disertation?",
    role: "public",
    expectedLang: "taglish",
    expectedIds: ["thesis-defense-stages-contents", "student-thesis-hub"],
  },
  {
    id: "Q52",
    query: "Hi, what model are you?",
    role: "public",
    expectedLang: "en",
    expectIdentityQuery: true,
  },
  {
    id: "Q53",
    query: "Thanks!",
    role: "public",
    expectedLang: "en",
    expectConversational: true,
    maxReplyLength: 120,
  },
  {
    id: "Q54",
    query: "May tanong ako",
    role: "student",
    expectedLang: ["tl", "taglish"],
    expectConversational: true,
    maxReplyLength: 120,
  },
  {
    id: "Q55",
    query: "Wait",
    role: "public",
    expectedLang: "en",
    expectConversational: true,
    maxReplyLength: 120,
  },
  {
    id: "Q56",
    query: "May tanong ako sa thesis disertation",
    role: "student",
    expectedLang: "taglish",
    expectConversational: true,
    maxReplyLength: 120,
  },
  {
    id: "Q57",
    query: "Thanks for the information!",
    role: "public",
    expectedLang: "en",
    expectConversational: true,
    maxReplyLength: 120,
  },
  {
    id: "Q58",
    query: "Salamat sa iyong impormasyon!",
    role: "student",
    expectedLang: ["tl", "taglish"],
    expectConversational: true,
    maxReplyLength: 120,
  },
  // --- Complete Programs, Admissions, Eligibility, Enrollment & Fees Audit ---
  {
    id: "Q59",
    query: "What graduate programs are offered by EARIST?",
    role: "public",
    expectedLang: "en",
    expectTop1Ids: ["programs-all-overview"],
    expectedIds: ["programs-all-overview"],
  },
  {
    id: "Q60",
    query: "What are the admission requirements for graduate studies?",
    role: "public",
    expectedLang: "en",
    expectTop1Ids: ["admission-general-requirements"],
    expectedIds: ["admission-general-requirements"],
  },
  {
    id: "Q61",
    query: "How can I apply for admission to the Graduate School?",
    role: "public",
    expectedLang: "en",
    expectTop1Ids: ["system-apply-pinnacle-register", "admission-general-requirements"],
    expectedIds: ["system-apply-pinnacle-register", "admission-general-requirements"],
  },
  {
    id: "Q62",
    query: "Who is eligible to apply for a master's degree?",
    role: "public",
    expectedLang: "en",
    expectTop1Ids: ["admission-eligibility-masters-doctoral"],
    expectedIds: ["admission-eligibility-masters-doctoral"],
  },
  {
    id: "Q63",
    query: "Who is eligible to apply for a doctoral degree?",
    role: "public",
    expectedLang: "en",
    expectTop1Ids: ["admission-eligibility-masters-doctoral"],
    expectedIds: ["admission-eligibility-masters-doctoral"],
  },
  {
    id: "Q64",
    query: "How can I enroll in the Graduate School?",
    role: "public",
    expectedLang: "en",
    expectTop1Ids: ["enrollment-how-to-requirements-eligibility"],
    expectedIds: ["enrollment-how-to-requirements-eligibility"],
  },
  {
    id: "Q65",
    query: "What are the requirements for enrollment?",
    role: "public",
    expectedLang: "en",
    expectTop1Ids: ["enrollment-how-to-requirements-eligibility"],
    expectedIds: ["enrollment-how-to-requirements-eligibility"],
  },
  {
    id: "Q66",
    query: "Who is eligible to enroll in the Graduate School?",
    role: "public",
    expectedLang: "en",
    expectTop1Ids: ["enrollment-how-to-requirements-eligibility", "admission-eligibility-masters-doctoral"],
    expectedIds: ["enrollment-how-to-requirements-eligibility", "admission-eligibility-masters-doctoral"],
  },
  {
    id: "Q67",
    query: "How do I enroll as a continuing Graduate School student?",
    role: "student",
    expectedLang: "en",
    expectTop1Ids: ["enrollment-continuing-student-and-status-check"],
    expectedIds: ["enrollment-continuing-student-and-status-check"],
  },
  {
    id: "Q68",
    query: "How can I check my enrollment status?",
    role: "applicant",
    expectedLang: "en",
    expectTop1Ids: ["enrollment-continuing-student-and-status-check"],
    expectedIds: ["enrollment-continuing-student-and-status-check"],
  },
  {
    id: "Q69",
    query: "How much is the tuition fee for graduate studies?",
    role: "public",
    expectedLang: "en",
    expectTop1Ids: ["policies-school-fees-discipline"],
    expectedIds: ["policies-school-fees-discipline"],
  },
  {
    id: "Q70",
    query: "How much is the miscellaneous fee?",
    role: "public",
    expectedLang: "en",
    expectTop1Ids: ["policies-school-fees-discipline"],
    expectedIds: ["policies-school-fees-discipline"],
  },
];

let passed = 0;
const failures = [];

for (const tc of BENCHMARK_CASES) {
  const mockUserContext =
    tc.role === "student"
      ? {
          userName: "Juan M. Dela Cruz",
          pageTitle: "Proposal Defense",
          activeStatusSummary: "Proposal Defense — Pre-Defense Adviser Review",
        }
      : { pageTitle: "EARIST Graduate School Home" };

  const result = rag.retrieveKnowledgeChunks(
    tc.query,
    tc.role,
    4,
    mockUserContext,
  );
  const langOk = Array.isArray(tc.expectedLang)
    ? tc.expectedLang.includes(result.language)
    : result.language === tc.expectedLang;

  let retrievalOk = false;
  if (tc.expectOutOfScope) {
    retrievalOk = result.isOutOfScope === true && result.hits.length === 0;
  } else if (tc.expectIdentityQuery) {
    retrievalOk = result.isIdentityQuery === true && !result.isOutOfScope;
  } else if (tc.expectConversational) {
    retrievalOk = result.isConversational === true && !result.isOutOfScope;
  } else {
    const retrievedIds = result.hits.map((h) => h.chunk.id);
    const top1Ok = tc.expectTop1Ids
      ? tc.expectTop1Ids.includes(retrievedIds[0])
      : true;
    retrievalOk =
      !result.isOutOfScope &&
      top1Ok &&
      tc.expectedIds.some((expectedId) => retrievedIds.includes(expectedId));
  }

  const fallbackResponse = rag.buildGroundedResponseFallback(
    result,
    tc.role,
    mockUserContext,
  );
  const replyText = fallbackResponse.reply || "";
  const hasReply = Boolean(replyText.trim().length > 20);
  const lengthOk = tc.maxReplyLength
    ? replyText.length <= tc.maxReplyLength && !replyText.includes("\n\n")
    : true;
  const cleanFormatOk =
    !/\*\*|###|---|`/.test(replyText) &&
    !/\b(?:Manual\s+)?Sec\.?\s*\d+/i.test(replyText) &&
    !/\b(?:DeepSeek|Gemini|ChatGPT|GPT|Claude|OpenAI)\b|\blarge language model\b/i.test(
      replyText,
    );

  if (langOk && retrievalOk && hasReply && lengthOk && cleanFormatOk) {
    passed++;
  } else {
    failures.push({
      id: tc.id,
      query: tc.query,
      langOk,
      detectedLang: result.language,
      expectedLang: tc.expectedLang,
      retrievalOk,
      lengthOk,
      cleanFormatOk,
      isOutOfScope: result.isOutOfScope,
      topScore: Number(result.topScore.toFixed(4)),
      topHitIds: result.hits.map((h) => `${h.chunk.id}(${h.score.toFixed(3)})`),
      expectedIds:
        tc.expectedIds ??
        (tc.expectIdentityQuery
          ? ["IDENTITY"]
          : tc.expectConversational
            ? ["CONVERSATIONAL"]
            : ["OUT_OF_SCOPE"]),
    });
  }
}

// Verify 16-program canonical count (4 Doctoral + 12 Master's)
const totalProgRes = rag.retrieveKnowledgeChunks(
  "What is the total of programs they offering?",
  "public",
  4,
);
const totalProgReply = rag.buildGroundedResponseFallback(totalProgRes, "public").reply;
if (
  totalProgRes.hits[0]?.chunk.id !== "programs-all-overview" ||
  !totalProgReply.includes("16 graduate programs") ||
  !totalProgReply.includes("4 Doctoral Programs") ||
  !totalProgReply.includes("12 Master's Programs")
) {
  console.error("FAIL: 16-program count check failed:", totalProgReply);
  process.exit(1);
}

// Verify strict RBAC cross-role isolation across all 5 roles
const rbacBlockedCases = [
  { role: "public", query: "What navigation for admin portal?", history: [] },
  {
    role: "public",
    query: "How about faculty?",
    history: ["What navigation for admin portal?"],
  },
  { role: "public", query: "What pages are inside the student portal?", history: [] },
  { role: "public", query: "How do faculty use the Defense Workspace?", history: [] },
  { role: "applicant", query: "What navigation for admin portal?", history: [] },
  { role: "applicant", query: "Saan mag-grade ng essays ang faculty?", history: [] },
  { role: "applicant", query: "What pages are in the student dashboard?", history: [] },
  { role: "student", query: "Paano gamitin ang Admin Email Manager?", history: [] },
  { role: "student", query: "How do faculty annotate PDFs in Defense Workspace?", history: [] },
  { role: "faculty", query: "What is inside Admin System Settings?", history: [] },
];

for (const rc of rbacBlockedCases) {
  const res = rag.retrieveKnowledgeChunks(rc.query, rc.role, 4, undefined, rc.history);
  if (!res.isRoleRestricted || res.hits.length > 0) {
    console.error("FAIL: RBAC failed to block cross-role query:", rc, res);
    process.exit(1);
  }
}

// Admin retains full access to admin portal guidance
const adminOk = rag.retrieveKnowledgeChunks("What navigation for admin portal?", "admin", 4);
if (adminOk.isRoleRestricted || adminOk.hits.length === 0) {
  console.error("FAIL: Admin was erroneously blocked from admin portal guidance");
  process.exit(1);
}

// Verify DeepSeek + multi-vendor identity detection
for (const probe of [
  "Are you DeepSeek?",
  "DeepSeek ka ba?",
  "Are you powered by DeepSeek-V4?",
  "Are you ChatGPT or Claude?",
]) {
  const probeRes = rag.retrieveKnowledgeChunks(probe, "public", 4);
  if (!probeRes.isIdentityQuery) {
    console.error("FAIL: Identity query not detected for:", probe);
    process.exit(1);
  }
}

// Verify cleanAssistantReply sanitizer strips DeepSeek + all banned vendor/model/markdown/citation tokens
const dirtySample =
  "### Bago Magsimula\n* **Residency (Manual Sec. 7.10):** ayon sa Sec. 7.18: I am DeepSeek-V3, DeepSeek-R1, DeepSeek-Flash, DeepSeek, Gemini 4 Hydrogen, ChatGPT, GPT-4, Claude, built by OpenAI — a large language model.\n---";
const sanitizedSample = rag.cleanAssistantReply(dirtySample);
if (
  /\*\*|###|---|Sec\.\s*\d+|DeepSeek|Gemini|ChatGPT|\bGPT\b|Claude|OpenAI|large language model/i.test(
    sanitizedSample,
  )
) {
  console.error(
    "FAIL: cleanAssistantReply did not strip banned tokens:",
    sanitizedSample,
  );
  process.exit(1);
}

const accuracy = (passed / BENCHMARK_CASES.length) * 100;
const stats = rag.getKnowledgeBaseStats();

console.log(
  `Knowledge Base: ${stats.totalChunks} chunks across ${stats.categories.length} categories`,
);
console.log(
  `Benchmark Results: ${passed}/${BENCHMARK_CASES.length} passed (${accuracy.toFixed(1)}%)`,
);

if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(JSON.stringify(f));
  }
}

if (passed !== BENCHMARK_CASES.length) {
  console.error(
    `\nFAIL: Accuracy ${accuracy.toFixed(1)}% (${passed}/${BENCHMARK_CASES.length}) did not achieve 100% target.`,
  );
  process.exit(1);
}

console.log(
  "\nPASS: Chatbot RAG retrieval, DeepSeek/vendor guardrails & multilingual accuracy achieved 70/70 (100.0%).",
);
