/**
 * End-to-end API smoke: Applicant → Exam → COR → Student → Comp Exam → Title Defense → Admin buckets.
 * Usage: node scripts/smoke-walkthrough.mjs
 * Requires: backend on http://localhost:5000
 */
const BASE = process.env.SMOKE_API_URL || "http://localhost:5000/api";
const runId = Date.now().toString(36);
const results = [];

function log(step, status, detail = "") {
  const line = `[${status}] ${step}${detail ? " — " + detail : ""}`;
  console.log(line);
  results.push({ step, status, detail });
}

async function req(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: payload,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, json };
}

function tinyPdf() {
  // Minimal PDF (file-type magic bytes)
  const pdf = `%PDF-1.1
1 0 obj<<>>endobj
trailer<<>>
%%EOF
`;
  const blob = new Blob([pdf], { type: "application/pdf" });
  return new File([blob], "smoke-doc.pdf", { type: "application/pdf" });
}

function attachFile(form, field, filename = "smoke-doc.pdf") {
  form.append(field, tinyPdf(), filename);
}

async function main() {
  console.log("=== EARIST GS-IS walkthrough smoke ===\nAPI:", BASE, "\nrunId:", runId);

  // --- 0. Admin login (seed) ---
  const adminLogin = await req("POST", "/auth/login", {
    body: { role: "admin", email: "admin@earist.edu.ph", password: "password123" },
  });
  if (!adminLogin.ok) {
    log("Admin login", "FAIL", JSON.stringify(adminLogin.json));
    summarize();
    process.exit(1);
  }
  const adminTok = adminLogin.json.token;
  log("Admin login", "PASS", adminLogin.json.user?.email);

  // --- 1. Programs ---
  const programs = await req("GET", "/programs", { token: adminTok });
  const masters =
    programs.json?.graduatePrograms?.find((p) => p.programType === "MASTERS") ||
    programs.json?.graduatePrograms?.[0];
  const undergrad = programs.json?.undergraduatePrograms?.[0];
  if (!masters || !undergrad) {
    log("Load programs", "FAIL", "missing masters or undergraduate program");
    summarize();
    process.exit(1);
  }
  log("Load programs", "PASS", `masters=${masters.programName} | ug=${undergrad.programName}`);

  // --- 2. Register applicant (must be @gmail.com) ---
  const applicantId = `SMOKE-${runId}`;
  const email = `smoke.${runId}@gmail.com`;
  const password = "Password123!";
  const register = await req("POST", "/auth/register", {
    body: {
      applicantId,
      firstName: "Smoke",
      lastName: `Walk${runId}`,
      email,
      cellphone: "09171234567",
      dateOfBirth: "1996-01-15",
      programId: masters.id,
      programType: "Masters",
      undergraduateProgramId: undergrad.id,
      password,
    },
  });
  if (!register.ok) {
    log("Applicant register", "FAIL", JSON.stringify(register.json));
    summarize();
    process.exit(1);
  }
  log("Applicant register", "PASS", `${applicantId} | ${email}`);

  const applicantLogin = await req("POST", "/auth/login", {
    body: { role: "applicant", applicantId, password },
  });
  if (!applicantLogin.ok) {
    log("Applicant login", "FAIL", JSON.stringify(applicantLogin.json));
    summarize();
    process.exit(1);
  }
  const appTok = applicantLogin.json.token;
  log("Applicant login", "PASS", `role=${applicantLogin.json.user?.role}`);

  // --- 2b. Program alignment / waiver if not ALIGNED ---
  const status0 = await req("GET", "/exam/status", { token: appTok });
  log("Initial exam status", "PASS", JSON.stringify(status0.json)?.slice(0, 220));
  if (status0.json?.alignmentStatus && status0.json.alignmentStatus !== "ALIGNED") {
    const applicants0 = await req("GET", "/admin/applicants", { token: adminTok });
    const list0 = Array.isArray(applicants0.json)
      ? applicants0.json
      : applicants0.json?.data || applicants0.json?.applicants || [];
    const row0 = list0.find(
      (a) =>
        a.pinnacleApplicantId === applicantId ||
        a.applicantId === applicantId ||
        a.user?.email === email ||
        a.email === email ||
        a.studentNumber === applicantId,
    );
    if (row0?.id) {
      const waiver = await req("PUT", `/admin/applicants/${row0.id}/waiver/validate`, {
        token: adminTok,
      });
      log(
        "Validate program waiver",
        waiver.ok ? "PASS" : "WARN",
        JSON.stringify(waiver.json)?.slice(0, 200),
      );
    } else {
      log("Validate program waiver", "WARN", `applicant row not found in list (${list0.length} rows)`);
    }
  }

  // --- 3. Entrance exam: slot → schedule → (engine) → grade ---
  // Build examDate/examTime so validateExamTime's local getHours() window covers "now".
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const examDateIso = `${y}-${m}-${d}`;
  // Local wall-clock time ~30 minutes ago so the 3-hour window includes now.
  const startLocal = new Date(now.getTime() - 30 * 60 * 1000);
  const examTimeIso = new Date(
    1970,
    0,
    1,
    startLocal.getHours(),
    startLocal.getMinutes(),
    0,
    0,
  ).toISOString();
  const slotRes = await req("POST", "/exam/slots", {
    token: adminTok,
    body: {
      programId: masters.id,
      examDate: examDateIso,
      examTime: examTimeIso,
      maxSlots: 20,
    },
  });
  if (!slotRes.ok) {
    log("Create exam slot", "FAIL", JSON.stringify(slotRes.json));
  } else {
    log("Create exam slot", "PASS", slotRes.json?.id ?? "");
  }

  const slotId = slotRes.json?.id;
  let applicationId = null;
  if (slotId) {
    const schedule = await req("POST", "/exam/schedule", {
      token: appTok,
      body: { slotId },
    });
    if (!schedule.ok) {
      log("Schedule exam", "FAIL", JSON.stringify(schedule.json));
    } else {
      applicationId = schedule.json?.id || schedule.json?.application?.id || null;
      log("Schedule exam", "PASS", `applicationId=${applicationId ?? "?"}`);
    }
  }

  // Exam engine: ensure questions exist, take exam inside window, grade pass
  if (applicationId) {
    // Seed minimal bank if empty (MCQ with correct option + ESSAY)
    const existingQ = await req("GET", "/exam-engine/admin/questions", { token: adminTok });
    let qBank = Array.isArray(existingQ.json)
      ? existingQ.json
      : existingQ.json?.questions || [];
    if (!qBank.length) {
      const mcq = await req("POST", "/exam-engine/admin/questions", {
        token: adminTok,
        body: {
          questionText: `Smoke MCQ ${runId}: 2+2?`,
          type: "MULTIPLE_CHOICE",
          order: 1,
          options: [
            { optionText: "3", isCorrect: false, order: 1 },
            { optionText: "4", isCorrect: true, order: 2 },
          ],
        },
      });
      const essay = await req("POST", "/exam-engine/admin/questions", {
        token: adminTok,
        body: {
          questionText: `Smoke Essay ${runId}: Explain your research interest.`,
          type: "ESSAY",
          order: 2,
          options: [],
        },
      });
      log(
        "Create exam questions",
        mcq.ok && essay.ok ? "PASS" : "WARN",
        `mcq=${mcq.status} essay=${essay.status}`,
      );
      const reload = await req("GET", "/exam-engine/admin/questions", { token: adminTok });
      qBank = Array.isArray(reload.json) ? reload.json : reload.json?.questions || [];
    } else {
      log("Create exam questions", "PASS", `reused bank count=${qBank.length}`);
    }

    const questions = await req("GET", "/exam-engine/questions", { token: appTok });
    const qList = Array.isArray(questions.json)
      ? questions.json
      : questions.json?.questions || [];
    log(
      "Exam engine questions (in window)",
      questions.ok && qList.length ? "PASS" : "FAIL",
      questions.ok ? `count=${qList.length}` : JSON.stringify(questions.json)?.slice(0, 200),
    );

    // Applicant payload omits isCorrect — resolve correct option via admin bank.
    const answers = qList.map((q) => {
      if (q.type === "MULTIPLE_CHOICE") {
        const adminQ = qBank.find((x) => x.id === q.id);
        const correct =
          (adminQ?.options || []).find((o) => o.isCorrect) ||
          (adminQ?.options || [])[0] ||
          (q.options || [])[0];
        return {
          questionId: q.id,
          selectedOptionId: correct?.id,
        };
      }
      return {
        questionId: q.id,
        essayAnswer: "Smoke essay response for walkthrough.",
      };
    });

    const submit = await req("POST", "/exam-engine/submit", {
      token: appTok,
      body: { answers },
    });
    log(
      "Exam engine submit",
      submit.ok ? "PASS" : "FAIL",
      JSON.stringify(submit.json)?.slice(0, 200),
    );

    const grade = await req("POST", `/exam/scores/${applicationId}/grade`, {
      token: adminTok,
      body: { essayScore: 30 },
    });
    log(
      "Admin grade essay (force pass attempt)",
      grade.ok ? "PASS" : "FAIL",
      JSON.stringify(grade.json)?.slice(0, 240),
    );

    const confirm = await req("POST", `/exam/scores/${applicationId}/send-email`, {
      token: adminTok,
    });
    log(
      "Confirm exam result",
      confirm.ok ? "PASS" : "WARN",
      JSON.stringify(confirm.json)?.slice(0, 200),
    );
  }

  const examStatus = await req("GET", "/exam/status", { token: appTok });
  log(
    "Applicant exam status",
    examStatus.ok ? "PASS" : "FAIL",
    JSON.stringify(examStatus.json)?.slice(0, 300),
  );

  // --- 4. COR upload → admin verify → Student ---
  const corForm = new FormData();
  attachFile(corForm, "file", "smoke-cor.pdf");
  const corUpload = await req("POST", "/cor/upload", { token: appTok, form: corForm });
  log(
    "COR upload",
    corUpload.ok ? "PASS" : "FAIL",
    JSON.stringify(corUpload.json)?.slice(0, 240),
  );

  const pendingCor = await req("GET", "/cor/pending", { token: adminTok });
  const corRows = Array.isArray(pendingCor.json)
    ? pendingCor.json
    : pendingCor.json?.data || pendingCor.json?.uploads || [];
  const uploadedCorId = corUpload.json?.upload?.id || corUpload.json?.id;
  const myCor = corRows.find((r) => r.id === uploadedCorId);
  const corId = myCor?.id || uploadedCorId;
  const smokeStudentNumber = `SMOKE-${runId}`;
  if (!corId) {
    log("Find pending COR", "FAIL", JSON.stringify(pendingCor.json)?.slice(0, 240));
  } else {
    const verify = await req("POST", `/cor/verify/${corId}`, {
      token: adminTok,
      body: {
        registrationNumber: `REG-${runId}`,
        studentNumber: smokeStudentNumber,
        academicYear: "2026-2027",
      },
    });
    log(
      "Admin verify COR",
      verify.ok ? "PASS" : "FAIL",
      JSON.stringify(verify.json)?.slice(0, 500),
    );
  }

  // Also try applicant promote endpoint if still APPLICANT
  const applicants = await req("GET", "/admin/applicants", { token: adminTok });
  const list = Array.isArray(applicants.json)
    ? applicants.json
    : applicants.json?.data || applicants.json?.applicants || [];
  const appRow = list.find(
    (a) =>
      a.pinnacleApplicantId === applicantId ||
      a.applicantId === applicantId ||
      a.user?.email === email ||
      a.email === email,
  );
  if (appRow?.id) {
    const promote = await req("PUT", `/admin/applicants/${appRow.id}/promote`, {
      token: adminTok,
    });
    log(
      "Promote applicant → student",
      promote.ok ? "PASS" : "WARN",
      JSON.stringify(promote.json)?.slice(0, 200),
    );
  }

  // --- 5. Student login (studentNumber + birthdate + password) ---
  // After COR verify, studentNumber may be assigned; try login by student id patterns.
  let studentTok = null;
  let studentNumber = null;
  const studentLoginAttempts = [
    { role: "student", studentId: smokeStudentNumber, birthdate: "1996-01-15", password },
    { role: "student", studentId: applicantId, birthdate: "1996-01-15", password },
    { role: "student", studentId: `2026-${runId}`, birthdate: "1996-01-15", password },
  ];
  // Pull student number from admin students list
  const students = await req("GET", "/admin/students", { token: adminTok });
  const sList = Array.isArray(students.json)
    ? students.json
    : students.json?.data || students.json?.students || [];
  const sRow = sList.find(
    (s) =>
      s.user?.email === email ||
      s.pinnacleApplicantId === applicantId ||
      s.studentNumber === applicantId,
  );
  if (sRow?.studentNumber) {
    studentNumber = sRow.studentNumber;
    studentLoginAttempts.unshift({
      role: "student",
      studentId: studentNumber,
      birthdate: "1996-01-15",
      password,
    });
  }

  for (const attempt of studentLoginAttempts) {
    const login = await req("POST", "/auth/login", { body: attempt });
    if (login.ok && login.json.user?.role === "STUDENT") {
      studentTok = login.json.token;
      studentNumber = attempt.studentId;
      log("Student login", "PASS", `studentId=${attempt.studentId}`);
      break;
    }
  }
  if (!studentTok) {
    log("Student login", "FAIL", `tried ${studentLoginAttempts.length} attempts; row=${JSON.stringify(sRow)?.slice(0, 200)}`);
  }

  // --- 6. Comp Exam PASSED ---
  const studentId = sRow?.id || sRow?.studentId;
  if (studentId) {
    const comp = await req("PUT", `/admin/students/${studentId}/comprehensive-exam`, {
      token: adminTok,
      body: { status: "PASSED" },
    });
    log("Set Comp Exam PASSED", comp.ok ? "PASS" : "FAIL", JSON.stringify(comp.json)?.slice(0, 200));
  } else {
    log("Set Comp Exam PASSED", "SKIP", "student row id not found");
  }

  // --- 7. Title Defense apply (3 titles + files) ---
  if (!studentTok) {
    log("Title Defense apply", "SKIP", "no student token");
  } else {
    const titleForm = new FormData();
    titleForm.append("title1", `Smoke Title A ${runId}`);
    titleForm.append("title2", `Smoke Title B ${runId}`);
    titleForm.append("title3", `Smoke Title C ${runId}`);
    attachFile(titleForm, "conceptPaper", "title-package.pdf");
    attachFile(titleForm, "cor", "title-cor.pdf");
    attachFile(titleForm, "receipt", "title-receipt.pdf");

    // Negative first: cannot schedule before apply/approve — use dummy id
    const badSched = await req("POST", "/thesis/defense/00000000-0000-0000-0000-000000000000/schedule", {
      token: adminTok,
      body: {
        defenseDate: "2026-11-01",
        defenseTime: "10:00",
        venueOrLink: "https://teams.microsoft.com/l/meetup-join/smoke",
        defenseType: "TITLE_DEFENSE",
        assignments: [],
      },
    });
    log(
      "NEG schedule before valid app",
      !badSched.ok ? "PASS" : "FAIL",
      `status=${badSched.status} ${JSON.stringify(badSched.json)?.slice(0, 160)}`,
    );

    const apply = await req("POST", "/thesis/defense/title", { token: studentTok, form: titleForm });
    log(
      "Title Defense apply",
      apply.ok ? "PASS" : "FAIL",
      JSON.stringify(apply.json)?.slice(0, 280),
    );

    const needsReview = await req("GET", "/thesis/defense/applications?bucket=NEEDS_REVIEW&page=1&pageSize=20", {
      token: adminTok,
    });
    const nrItems = needsReview.json?.data || [];
    const mine = nrItems.find(
      (r) =>
        r.student?.user?.email === email ||
        r.thesisTitles?.some((t) => t.titleText?.includes(runId)),
    );
    log(
      "Admin bucket NEEDS_REVIEW contains application",
      mine ? "PASS" : "FAIL",
      mine ? `id=${mine.id}` : `total=${needsReview.json?.total}`,
    );

    if (mine) {
      // Ready should NOT include this yet
      const readyBefore = await req("GET", "/thesis/defense/applications?bucket=READY&page=1&pageSize=50", {
        token: adminTok,
      });
      const inReadyBefore = (readyBefore.json?.data || []).some((r) => r.id === mine.id);
      log(
        "NEG not READY before approve",
        !inReadyBefore ? "PASS" : "FAIL",
        `found=${inReadyBefore}`,
      );

      const approve = await req("PUT", `/thesis/defense/${mine.id}/status`, {
        token: adminTok,
        body: { status: "APPROVED" },
      });
      log("Admin APPROVE application", approve.ok ? "PASS" : "FAIL", JSON.stringify(approve.json)?.slice(0, 200));

      const readyAfter = await req("GET", "/thesis/defense/applications?bucket=READY&page=1&pageSize=50", {
        token: adminTok,
      });
      const readyRow = (readyAfter.json?.data || []).find((r) => r.id === mine.id);
      log(
        "READY after approve (no session)",
        readyRow && !readyRow.currentSchedule ? "PASS" : "FAIL",
        readyRow
          ? `bucket=${readyRow.workflowBucket} display=${readyRow.displayStatus} hasSchedule=${!!readyRow.currentSchedule}`
          : "row missing from READY",
      );

      // Approve must not equal PASSED
      log(
        "Approve ≠ PASSED",
        readyRow && readyRow.displayStatus === "APPROVED" && readyRow.outcome == null
          ? "PASS"
          : "FAIL",
        `status=${readyRow?.displayStatus} outcome=${readyRow?.outcome}`,
      );

      const summary = await req("GET", "/thesis/defense/applications/summary", {
        token: adminTok,
      });
      log("Workflow summary endpoint", summary.ok ? "PASS" : "FAIL", JSON.stringify(summary.json));
    }
  }

  summarize();
  const failed = results.filter((r) => r.status === "FAIL").length;
  process.exit(failed > 0 ? 1 : 0);
}

function summarize() {
  console.log("\n=== SMOKE SUMMARY ===");
  const counts = { PASS: 0, FAIL: 0, WARN: 0, SKIP: 0 };
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
  console.log(counts);
  for (const r of results.filter((x) => x.status === "FAIL" || x.status === "WARN")) {
    console.log(` ${r.status}: ${r.step} — ${r.detail}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
