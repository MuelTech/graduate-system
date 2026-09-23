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

    // Negative: a REAL PENDING application cannot be scheduled (not a fake UUID).
    // Placeholder — replaced after apply with the real thesis id.

    const apply = await req("POST", "/thesis/defense/title", { token: studentTok, form: titleForm });
    log(
      "Title Defense apply",
      apply.ok ? "PASS" : "FAIL",
      JSON.stringify(apply.json)?.slice(0, 280),
    );

    const needsReview = await req("GET", "/thesis/defense/applications?bucket=NEEDS_REVIEW&page=1&pageSize=50", {
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
      // BEFORE approval: real PENDING id must not be schedulable
      const badSched = await req("POST", `/thesis/defense/${mine.id}/schedule`, {
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
        "NEG schedule REAL pending application",
        !badSched.ok ? "PASS" : "FAIL",
        `status=${badSched.status} ${JSON.stringify(badSched.json)?.slice(0, 180)}`,
      );

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

      // Summary BEFORE scheduling (for before/after compare)
      const summaryBefore = await req("GET", "/thesis/defense/applications/summary", {
        token: adminTok,
      });
      const readyBeforeCount = summaryBefore.json?.READY ?? 0;
      const activeBeforeCount = summaryBefore.json?.ACTIVE ?? 0;

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
      log(
        "Approve ≠ PASSED",
        readyRow && readyRow.displayStatus === "APPROVED" && readyRow.outcome == null
          ? "PASS"
          : "FAIL",
        `status=${readyRow?.displayStatus} outcome=${readyRow?.outcome}`,
      );

      // Scheduling candidates endpoint shares READY semantics
      const approvedList = await req("GET", "/thesis/defense/approved-applications?page=1&pageSize=50", {
        token: adminTok,
      });
      const inSchedulingList = (approvedList.json?.data || []).some((r) => r.id === mine.id);
      log(
        "Scheduling list includes READY app",
        inSchedulingList ? "PASS" : "FAIL",
        `found=${inSchedulingList}`,
      );

      // Snapshot AFTER approve / BEFORE schedule for READY→ACTIVE compare
      const summaryBeforeSchedule = await req("GET", "/thesis/defense/applications/summary", {
        token: adminTok,
      });
      const readyBeforeSchedule = summaryBeforeSchedule.json?.READY ?? 0;
      const activeBeforeSchedule = summaryBeforeSchedule.json?.ACTIVE ?? 0;

      // Build Master's Title roster: CHAIRMAN + 4 PANELIST + FAC + RAP = 7
      const panelistsRes = await req("GET", "/thesis/panelist-candidates", { token: adminTok });
      const panelists = Array.isArray(panelistsRes.json)
        ? panelistsRes.json
        : panelistsRes.json?.data || [];
      log(
        "Load panelist candidates",
        panelists.length >= 7 ? "PASS" : "FAIL",
        `count=${panelists.length}`,
      );

      const rosterRoles = [
        "CHAIRMAN",
        "PANELIST",
        "PANELIST",
        "PANELIST",
        "PANELIST",
        "FACILITATOR",
        "RAPPORTEUR",
      ];
      const assignments = rosterRoles.map((role, i) => ({
        userId: panelists[i]?.id,
        role,
      })).filter((a) => a.userId);

      const scheduleDate = new Date();
      scheduleDate.setDate(scheduleDate.getDate() + 7);
      const scheduleBody = {
        defenseDate: scheduleDate.toISOString().slice(0, 10),
        defenseTime: "10:00",
        venueOrLink: "https://teams.microsoft.com/l/meetup-join/smoke-title",
        defenseType: "TITLE_DEFENSE",
        assignments,
      };

      const sched1 = await req("POST", `/thesis/defense/${mine.id}/schedule`, {
        token: adminTok,
        body: scheduleBody,
      });
      log(
        "Schedule real Title application",
        sched1.ok ? "PASS" : "FAIL",
        JSON.stringify(sched1.json)?.slice(0, 280),
      );

      const readyPost = await req("GET", "/thesis/defense/applications?bucket=READY&page=1&pageSize=50", {
        token: adminTok,
      });
      const stillReady = (readyPost.json?.data || []).some((r) => r.id === mine.id);
      log("GONE from READY after schedule", !stillReady ? "PASS" : "FAIL", `found=${stillReady}`);

      const activePost = await req("GET", "/thesis/defense/applications?bucket=ACTIVE&page=1&pageSize=50", {
        token: adminTok,
      });
      const activeRow = (activePost.json?.data || []).find((r) => r.id === mine.id);
      log(
        "Appears in ACTIVE with session + committee",
        !!activeRow?.currentSchedule &&
          activeRow.currentSchedule.sessionStatus === "SCHEDULED" &&
          activeRow.currentSchedule.defenseType === "TITLE_DEFENSE" &&
          (activeRow.currentSchedule.panelAssignments?.length ?? 0) > 0
          ? "PASS"
          : "FAIL",
        activeRow
          ? `bucket=${activeRow.workflowBucket} session=${activeRow.currentSchedule?.sessionStatus} type=${activeRow.currentSchedule?.defenseType} seats=${activeRow.currentSchedule?.panelAssignments?.length}`
          : "missing from ACTIVE",
      );

      // Assign Panel & Schedule is not valid once ACTIVE
      log(
        "Assign Schedule not valid when ACTIVE",
        activeRow && activeRow.workflowBucket === "ACTIVE" && !activeRow.currentSchedule?.id
          ? "FAIL"
          : activeRow && activeRow.workflowBucket === "ACTIVE"
            ? "PASS"
            : "FAIL",
        `bucket=${activeRow?.workflowBucket}`,
      );

      const sched2 = await req("POST", `/thesis/defense/${mine.id}/schedule`, {
        token: adminTok,
        body: scheduleBody,
      });
      log(
        "NEG duplicate schedule rejected",
        !sched2.ok ? "PASS" : "FAIL",
        `status=${sched2.status} ${JSON.stringify(sched2.json)?.slice(0, 180)}`,
      );

      const summaryAfter = await req("GET", "/thesis/defense/applications/summary", {
        token: adminTok,
      });
      const readyAfterCount = summaryAfter.json?.READY ?? 0;
      const activeAfterCount = summaryAfter.json?.ACTIVE ?? 0;
      // Exact -1 READY / +1 ACTIVE when this app is the only concurrent change.
      // Per-record READY→ACTIVE checks above remain authoritative if other rows move.
      const exactReady = readyAfterCount === readyBeforeSchedule - 1;
      const exactActive = activeAfterCount === activeBeforeSchedule + 1;
      log(
        "Summary READY-1 ACTIVE+1",
        exactReady && exactActive ? "PASS" : "WARN",
        `READY ${readyBeforeSchedule}→${readyAfterCount} ACTIVE ${activeBeforeSchedule}→${activeAfterCount}${
          exactReady && exactActive
            ? ""
            : " (aggregate weaker; per-record READY/ACTIVE asserts are authoritative)"
        }`,
      );

      // --- Exact fixture identity (never mutate proposal-blocked-vars) ---
      const findByEmail = (rows, email) =>
        (rows || []).find((r) => r.student?.user?.email === email);

      // Isolation: blocked fixture must stay PENDING (not READY / not approved by smoke)
      const needsAll = await req(
        "GET",
        "/thesis/defense/applications?bucket=NEEDS_REVIEW&page=1&pageSize=50",
        { token: adminTok },
      );
      const readyAll2 = await req(
        "GET",
        "/thesis/defense/applications?bucket=READY&page=1&pageSize=50",
        { token: adminTok },
      );
      const activeAll2 = await req(
        "GET",
        "/thesis/defense/applications?bucket=ACTIVE&page=1&pageSize=50",
        { token: adminTok },
      );
      const blockedVars =
        findByEmail(needsAll.json?.data, "proposal-blocked-vars@earist.edu.ph") ||
        findByEmail(readyAll2.json?.data, "proposal-blocked-vars@earist.edu.ph") ||
        findByEmail(activeAll2.json?.data, "proposal-blocked-vars@earist.edu.ph");
      log(
        "ISOLATE proposal-blocked-vars not approved by smoke",
        blockedVars && blockedVars.status === "PENDING" ? "PASS" : "FAIL",
        blockedVars
          ? `status=${blockedVars.status} bucket=${blockedVars.workflowBucket}`
          : "fixture missing (reseed)",
      );

      // REG: proposal-review-pending@ — Title history must not block APPROVE
      let proposalReview = findByEmail(
        needsAll.json?.data,
        "proposal-review-pending@earist.edu.ph",
      );
      if (!proposalReview) {
        log(
          "REG proposal-review-pending PENDING→APPROVE",
          "FAIL",
          "fixture not in NEEDS_REVIEW (run npx prisma db seed)",
        );
      } else {
        const apr = await req(
          "PUT",
          `/thesis/defense/${proposalReview.id}/status`,
          { token: adminTok, body: { status: "APPROVED" } },
        );
        const readyCheck = await req(
          "GET",
          "/thesis/defense/applications?bucket=READY&page=1&pageSize=50",
          { token: adminTok },
        );
        const nowReady = findByEmail(
          readyCheck.json?.data,
          "proposal-review-pending@earist.edu.ph",
        );
        log(
          "REG proposal-review-pending PENDING→APPROVE",
          apr.ok && nowReady ? "PASS" : "FAIL",
          `approve=${apr.status} ready=${!!nowReady} ${JSON.stringify(apr.json)?.slice(0, 120)}`,
        );
      }

      // REG: final-review-pending@ — Title+Proposal history must not block APPROVE
      const needsAfter = await req(
        "GET",
        "/thesis/defense/applications?bucket=NEEDS_REVIEW&page=1&pageSize=50",
        { token: adminTok },
      );
      let finalReview = findByEmail(
        needsAfter.json?.data,
        "final-review-pending@earist.edu.ph",
      );
      if (!finalReview) {
        log(
          "REG final-review-pending PENDING→APPROVE",
          "FAIL",
          "fixture not in NEEDS_REVIEW (run npx prisma db seed)",
        );
      } else {
        const afr = await req(
          "PUT",
          `/thesis/defense/${finalReview.id}/status`,
          { token: adminTok, body: { status: "APPROVED" } },
        );
        const readyCheck2 = await req(
          "GET",
          "/thesis/defense/applications?bucket=READY&page=1&pageSize=50",
          { token: adminTok },
        );
        const nowReady2 = findByEmail(
          readyCheck2.json?.data,
          "final-review-pending@earist.edu.ph",
        );
        log(
          "REG final-review-pending PENDING→APPROVE",
          afr.ok && nowReady2 ? "PASS" : "FAIL",
          `approve=${afr.status} ready=${!!nowReady2} ${JSON.stringify(afr.json)?.slice(0, 120)}`,
        );
      }

      // Exact-fixture stage-scoped docs: final-ready@ (READY, not mutated by smoke)
      const readyDocs = await req(
        "GET",
        "/thesis/defense/applications?bucket=READY&page=1&pageSize=50",
        { token: adminTok },
      );
      const finalReadyExact = findByEmail(
        readyDocs.json?.data,
        "final-ready@earist.edu.ph",
      );
      if (!finalReadyExact) {
        log("Final docs stage-scoped (final-ready@)", "FAIL", "fixture missing");
      } else {
        const docs = finalReadyExact.thesisDocuments || [];
        const stages = docs.map((d) => d.defenseStage);
        const types = docs.map((d) => d.docType).sort();
        const expected = ["COR", "FINAL_MANUSCRIPT", "RECEIPT"];
        const hasTypes = expected.every((t) => types.includes(t));
        const stageOk = docs.length > 0 && stages.every((s) => s === "FINAL");
        log(
          "Final docs stage-scoped (final-ready@)",
          stageOk && hasTypes ? "PASS" : "FAIL",
          `count=${docs.length} stages=${JSON.stringify(stages)} types=${JSON.stringify(types)}`,
        );
      }

      const proposalReadyExact = findByEmail(
        readyDocs.json?.data,
        "proposal-ready@earist.edu.ph",
      );
      if (!proposalReadyExact) {
        log(
          "Proposal docs stage-scoped (proposal-ready@)",
          "WARN",
          "fixture missing from READY (may be unused)",
        );
      } else {
        const pdocs = proposalReadyExact.thesisDocuments || [];
        const pstages = pdocs.map((d) => d.defenseStage);
        const ptypes = pdocs.map((d) => d.docType).sort();
        const pHas = ["COR", "PROPOSAL_CHAPTERS", "RECEIPT"].every((t) =>
          ptypes.includes(t),
        );
        log(
          "Proposal docs stage-scoped (proposal-ready@)",
          pdocs.length > 0 &&
            pstages.every((s) => s === "PROPOSAL") &&
            pHas
            ? "PASS"
            : "FAIL",
          `stages=${JSON.stringify(pstages)} types=${JSON.stringify(ptypes)}`,
        );
      }

      // Title PASSED conclusion must reference the selected ThesisTitle
      const historyRes = await req(
        "GET",
        "/thesis/defense/applications?bucket=HISTORY&page=1&pageSize=50",
        { token: adminTok },
      );
      const historyRows = historyRes.json?.data || [];
      for (const email of [
        "proposal-review-pending@earist.edu.ph",
        "final-review-pending@earist.edu.ph",
      ]) {
        const titleHist = historyRows.find(
          (r) =>
            r.student?.user?.email === email &&
            r.recordKind === "DEFENSE_HISTORY" &&
            r.stage === "TITLE",
        );
        if (!titleHist) {
          log(
            `Title conclusion selectedTitleId (${email})`,
            "FAIL",
            "TITLE DEFENSE_HISTORY row missing",
          );
          continue;
        }
        const selectedId = titleHist.selectedTitleId;
        const selected = (titleHist.thesisTitles || []).find(
          (t) => t.id === selectedId,
        );
        const ok =
          titleHist.outcome === "PASSED" &&
          !!selectedId &&
          !!selected &&
          selected.isSelected === true;
        log(
          `Title conclusion selectedTitleId (${email})`,
          ok ? "PASS" : "FAIL",
          `outcome=${titleHist.outcome} selectedTitleId=${selectedId} titleFound=${!!selected} isSelected=${selected?.isSelected}`,
        );
      }
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
