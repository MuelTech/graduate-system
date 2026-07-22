"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiClientRequest } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExamOption, ExamQuestion } from "@/types";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  FileText,
  Timer,
  Send,
  X,
  Calendar,
  ArrowRight,
  Wifi,
  ShieldAlert,
} from "lucide-react";

const getLetter = (index: number) => String.fromCharCode(65 + index);

export default function ApplicantExamPage() {
  const [examState, setExamState] = useState<
    "loading" | "no_schedule" | "countdown" | "in_progress" | "submitted"
  >("loading");

  const [mcqQuestions, setMcqQuestions] = useState<ExamQuestion[]>([]);
  const [essayQuestion, setEssayQuestion] = useState<ExamQuestion | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [upcomingExamStart, setUpcomingExamStart] = useState<Date | null>(null);
  const [slotDetails, setSlotDetails] = useState<{
    programName?: string;
    examDate?: string;
    examTime?: string;
  } | null>(null);

  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [essayText, setEssayText] = useState("");

  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10800); // 3 Hours in seconds
  const [showEssay, setShowEssay] = useState(false);

  // 1. FETCH SCHEDULE AND STATUS
  useEffect(() => {
    const fetchExamData = async () => {
      try {
        const statusRes = await apiClientRequest("/exam/status", {
          method: "GET",
        });

        const { confirmedSlot, examStatus } = statusRes;

        if (
          examStatus === "taken" ||
          examStatus === "passed" ||
          examStatus === "failed"
        ) {
          setExamState("submitted");
          return;
        }

        if (
          !confirmedSlot ||
          !confirmedSlot.examDate ||
          !confirmedSlot.examTime
        ) {
          setExamState("no_schedule");
          return;
        }

        setSlotDetails(confirmedSlot);

        const scheduledDate = new Date(confirmedSlot.examDate);
        const scheduledTimeStr = new Date(confirmedSlot.examTime);

        const examStart = new Date(
          scheduledDate.getFullYear(),
          scheduledDate.getMonth(),
          scheduledDate.getDate(),
          scheduledTimeStr.getHours(),
          scheduledTimeStr.getMinutes(),
          0,
        );

        if (new Date() < examStart) {
          setUpcomingExamStart(examStart);
          setExamState("countdown");
          return;
        }

        // If exam start time has arrived, fetch questions
        const questionsRes = await apiClientRequest("/exam-engine/questions", {
          method: "GET",
        });

        setMcqQuestions(
          questionsRes.filter(
            (q: ExamQuestion) => q.type === "MULTIPLE_CHOICE",
          ),
        );
        setEssayQuestion(
          questionsRes.find((q: ExamQuestion) => q.type === "ESSAY") || null,
        );
        setExamState("in_progress");
      } catch (error: unknown) {
        if (error instanceof Error) {
          setErrorMsg(error.message);
        } else {
          setErrorMsg("Failed to load examination status.");
        }
        setExamState("no_schedule");
      }
    };

    fetchExamData();
  }, []);

  // 2. LIVE COUNTDOWN TIMER (BEFORE EXAM OPENS)
  useEffect(() => {
    if (examState !== "countdown" || !upcomingExamStart) return;

    const timer = setInterval(() => {
      const diff = upcomingExamStart.getTime() - new Date().getTime();

      if (diff <= 0) {
        clearInterval(timer);
        window.location.reload(); // Reload page to start exam automatically!
      } else {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        setCountdown({ days: d, hours: h, minutes: m, seconds: s });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [examState, upcomingExamStart]);

  // 3. EXAM DURATION TIMER (DURING EXAM)
  useEffect(() => {
    if (examState !== "in_progress") return;

    const timer = setInterval(
      () => setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0)),
      1000,
    );

    return () => clearInterval(timer);
  }, [examState]);

  // 4. 60-SECOND ESSAY AUTO-SAVE
  useEffect(() => {
    if (
      examState !== "in_progress" ||
      !essayQuestion ||
      essayText.trim() === ""
    )
      return;

    const autoSaveTimer = setInterval(async () => {
      try {
        await apiClientRequest("/exam-engine/autosave", {
          method: "PATCH",
          body: JSON.stringify({
            questionId: essayQuestion.id,
            essayAnswer: essayText,
          }),
        });
      } catch (err) {
        console.error("Auto-save failed", err);
      }
    }, 60000);

    return () => clearInterval(autoSaveTimer);
  }, [examState, essayQuestion, essayText]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const essayWordCount = essayText
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  const handleFinalSubmit = async () => {
    try {
      const formattedAnswers: Array<{
        questionId: string;
        selectedOptionId?: string;
        essayAnswer?: string;
      }> = Object.entries(answers).map(([qId, oId]) => ({
        questionId: qId,
        selectedOptionId: oId,
      }));

      if (essayQuestion && essayText) {
        formattedAnswers.push({
          questionId: essayQuestion.id,
          essayAnswer: essayText,
        });
      }

      await apiClientRequest("/exam-engine/submit", {
        method: "POST",
        body: JSON.stringify({ answers: formattedAnswers }),
      });

      setExamState("submitted");
      setShowSubmitConfirm(false);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setErrorMsg(error.message);
        // If the error is exactly the expiration message, set a specific missed state
        if (error.message.includes("expired")) {
          setExamState("no_schedule"); // We will repurpose this state
        } else {
          setExamState("no_schedule");
        }
      } else {
        setErrorMsg("Failed to load examination status.");
        setExamState("no_schedule");
      }
    }
  };

  // --- STATE 1: LOADING ---
  if (examState === "loading") {
    return (
      <div className="p-8 text-center text-(--earist-primary)">
        Loading examination environment...
      </div>
    );
  }

  // --- STATE 2: NO SCHEDULE OR MISSED EXAM ---
  if (examState === "no_schedule") {
    const isMissed = errorMsg?.includes("expired");

    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <div
                className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${isMissed ? "bg-red-50" : "bg-amber-50"}`}
              >
                {isMissed ? (
                  <ShieldAlert className="h-8 w-8 text-red-600" />
                ) : (
                  <Calendar className="h-8 w-8 text-amber-600" />
                )}
              </div>
              <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                {isMissed ? "Examination Missed" : "No Exam Schedule Found"}
              </h3>
              <p className="mb-6 max-w-md text-sm text-(--earist-body-text)">
                {isMissed
                  ? "You missed your scheduled entrance examination window. To take the exam, you must submit an appeal to reschedule."
                  : "You have not confirmed an entrance examination schedule yet. Please choose a slot to proceed."}
              </p>

              {isMissed ? (
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  onClick={async () => {
                    try {
                      await apiClientRequest("/exam/appeal", {
                        method: "POST",
                      });
                      alert(
                        "Appeal submitted successfully! You can now select a new exam schedule.",
                      );
                      window.location.href = "/applicant/schedule";
                    } catch (err: unknown) {
                      if (err instanceof Error) {
                        alert(err.message);
                      } else {
                        alert("Failed to submit appeal.");
                      }
                    }
                  }}
                >
                  Appeal for Reschedule <Send className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Link href="/applicant/schedule">
                  <Button className="bg-(--earist-primary) hover:bg-red-900">
                    Select Exam Schedule <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- STATE 3: SUBMITTED ---
  if (examState === "submitted") {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                Examination Submitted Successfully
              </h3>
              <p className="mb-4 max-w-md text-sm text-(--earist-body-text)">
                Your entrance examination answers have been recorded. The MCQ
                section is evaluated, and your essay response has been queued
                for review.
              </p>
              <Badge className="bg-green-100 text-green-700">Submitted</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- STATE 4: COUNTDOWN (BEFORE EXAM UNLOCKS) ---
  if (examState === "countdown") {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-4">
        {/* Banner Header */}
        <Card className="border-l-4 border-l-(--earist-primary)">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <Badge className="bg-amber-100 text-amber-800 mb-2">
                  Exam Scheduled
                </Badge>
                <h2 className="text-2xl font-bold text-(--earist-primary)">
                  Entrance Examination Gateway
                </h2>
                <p className="text-sm text-(--earist-body-text)">
                  Your exam environment will automatically unlock when the
                  countdown reaches zero.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-(--earist-primary) bg-(--earist-surface-gray) px-3 py-2 rounded-lg border border-(--earist-border-gray)">
                <Timer className="h-4 w-4" /> Auto-unlock enabled
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4-Box Countdown Timer */}
        <Card>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-sm font-semibold text-(--earist-secondary) uppercase tracking-wider">
              Time Remaining Until Examination Opens
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-4 gap-3 md:gap-6 text-center max-w-xl mx-auto">
              <div className="rounded-xl bg-(--earist-surface-gray) p-3 md:p-4 border border-(--earist-border-gray)">
                <p className="font-mono text-3xl md:text-5xl font-extrabold text-(--earist-primary)">
                  {String(countdown.days).padStart(2, "0")}
                </p>
                <p className="text-[10px] md:text-xs font-bold text-(--earist-body-text) uppercase mt-1">
                  Days
                </p>
              </div>

              <div className="rounded-xl bg-(--earist-surface-gray) p-3 md:p-4 border border-(--earist-border-gray)">
                <p className="font-mono text-3xl md:text-5xl font-extrabold text-(--earist-primary)">
                  {String(countdown.hours).padStart(2, "0")}
                </p>
                <p className="text-[10px] md:text-xs font-bold text-(--earist-body-text) uppercase mt-1">
                  Hours
                </p>
              </div>

              <div className="rounded-xl bg-(--earist-surface-gray) p-3 md:p-4 border border-(--earist-border-gray)">
                <p className="font-mono text-3xl md:text-5xl font-extrabold text-(--earist-primary)">
                  {String(countdown.minutes).padStart(2, "0")}
                </p>
                <p className="text-[10px] md:text-xs font-bold text-(--earist-body-text) uppercase mt-1">
                  Mins
                </p>
              </div>

              <div className="rounded-xl bg-(--earist-surface-gray) p-3 md:p-4 border border-(--earist-border-gray)">
                <p className="font-mono text-3xl md:text-5xl font-extrabold text-(--earist-primary)">
                  {String(countdown.seconds).padStart(2, "0")}
                </p>
                <p className="text-[10px] md:text-xs font-bold text-(--earist-body-text) uppercase mt-1">
                  Secs
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule Information & Pre-Exam Checklist */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-(--earist-secondary) flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Examination Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-(--earist-border-gray)">
                <span className="text-(--earist-body-text)">Program:</span>
                <span className="font-semibold text-(--earist-primary)">
                  {slotDetails?.programName || "Graduate Program"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-(--earist-border-gray)">
                <span className="text-(--earist-body-text)">Exam Date:</span>
                <span className="font-semibold text-(--earist-primary)">
                  {slotDetails?.examDate
                    ? new Date(slotDetails.examDate).toLocaleDateString([], {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Scheduled"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-(--earist-border-gray)">
                <span className="text-(--earist-body-text)">Exam Time:</span>
                <span className="font-semibold text-(--earist-primary)">
                  {slotDetails?.examTime
                    ? new Date(slotDetails.examTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Scheduled"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-(--earist-body-text)">Duration:</span>
                <span className="font-semibold text-green-700">3 Hours</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-(--earist-secondary) flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" /> Important Reminders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-(--earist-body-text)">
              <div className="flex items-start gap-2">
                <Wifi className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <p>
                  Ensure you are connected to a stable internet connection
                  before beginning.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p>
                  The 3-hour timer starts immediately upon opening the
                  examination.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <p>Essay responses auto-save to the server every 60 seconds.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Disabled Start Button */}
        <div className="text-center pt-2">
          <Button
            disabled
            className="w-full md:w-auto px-8 py-3 bg-gray-300 text-gray-600 cursor-not-allowed"
          >
            Start Examination (Locked until scheduled time)
          </Button>
        </div>
      </div>
    );
  }

  // --- STATE 5: EXAM IN PROGRESS ---
  return (
    <div className="space-y-4 relative">
      {/* EXAM HEADER BAR */}
      <div className="sticky top-16 z-20 flex items-center justify-between rounded-xl border border-(--earist-border-gray) bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-(--earist-primary)" />
          <div>
            <p className="text-sm font-semibold text-(--earist-primary)">
              Graduate School Examination
            </p>
            <p className="text-xs text-(--earist-body-text)">
              {showEssay
                ? "Essay Section"
                : `Question ${currentQuestion + 1} of ${mcqQuestions.length}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            className={
              timeLeft < 600
                ? "bg-red-100 text-red-700"
                : "bg-(--earist-surface-gray) text-(--earist-body-text)"
            }
          >
            <Clock className="mr-1 h-3 w-3" />
            {formatTime(timeLeft)}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Main Content Area */}
        <div className="lg:col-span-3">
          {/* MCQ SECTION */}
          {!showEssay && mcqQuestions.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                    Multiple Choice — Question {currentQuestion + 1}
                  </CardTitle>
                  <Badge variant="outline">
                    {Object.keys(answers).length} / {mcqQuestions.length}{" "}
                    Answered
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-base font-medium text-(--earist-primary)">
                  {mcqQuestions[currentQuestion].questionText}
                </p>

                <div className="space-y-2">
                  {mcqQuestions[currentQuestion].options?.map(
                    (opt: ExamOption, idx: number) => {
                      const qId = mcqQuestions[currentQuestion].id;
                      const isSelected = answers[qId] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() =>
                            setAnswers((prev) => ({ ...prev, [qId]: opt.id }))
                          }
                          className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left text-sm transition-all ${
                            isSelected
                              ? "border-(--earist-primary) bg-(--earist-surface-light-red) font-semibold text-(--earist-primary)"
                              : "border-(--earist-border-gray) bg-white text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                          }`}
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              isSelected
                                ? "bg-(--earist-primary) text-white"
                                : "bg-(--earist-surface-gray) text-(--earist-body-text)"
                            }`}
                          >
                            {getLetter(idx)}
                          </span>
                          <span>{opt.optionText}</span>
                        </button>
                      );
                    },
                  )}
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between border-t border-(--earist-border-gray) pt-4">
                  <Button
                    variant="outline"
                    disabled={currentQuestion === 0}
                    onClick={() => setCurrentQuestion((prev) => prev - 1)}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                  </Button>

                  {currentQuestion < mcqQuestions.length - 1 ? (
                    <Button
                      className="bg-(--earist-primary) hover:bg-red-900"
                      onClick={() => setCurrentQuestion((prev) => prev + 1)}
                    >
                      Next <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  ) : (
                    essayQuestion && (
                      <Button
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => setShowEssay(true)}
                      >
                        Proceed to Essay Section{" "}
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ESSAY SECTION */}
          {showEssay && essayQuestion && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                    Essay Section
                  </CardTitle>
                  <Badge variant="outline">{essayWordCount} words</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="border-blue-200 bg-blue-50 text-blue-800">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-xs">
                    Your essay response auto-saves every 60 seconds.
                  </AlertDescription>
                </Alert>

                <p className="text-sm font-medium text-(--earist-primary)">
                  {essayQuestion.questionText}
                </p>

                <textarea
                  className="min-h-64 w-full rounded-md border border-(--earist-border-gray) p-3 text-sm focus:border-(--earist-primary) focus:ring-1 focus:ring-(--earist-primary) outline-none"
                  placeholder="Type your essay response here..."
                  value={essayText}
                  onChange={(e) => setEssayText(e.target.value)}
                />

                <div className="flex items-center justify-between border-t border-(--earist-border-gray) pt-4">
                  <Button variant="outline" onClick={() => setShowEssay(false)}>
                    <ChevronLeft className="mr-1 h-4 w-4" /> Back to MCQs
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => setShowSubmitConfirm(true)}
                  >
                    Submit Examination <Send className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Question Navigator */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                Question Navigator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-5 gap-2">
                {mcqQuestions.map((q, idx) => {
                  const isAnswered = !!answers[q.id];
                  const isCurrent = currentQuestion === idx && !showEssay;
                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setShowEssay(false);
                        setCurrentQuestion(idx);
                      }}
                      className={`h-9 rounded-md text-xs font-bold transition-all ${
                        isCurrent
                          ? "ring-2 ring-(--earist-primary) bg-(--earist-surface-light-red) text-(--earist-primary)"
                          : isAnswered
                            ? "bg-green-100 text-green-700 border border-green-300"
                            : "bg-(--earist-surface-gray) text-(--earist-body-text) hover:bg-gray-200"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {essayQuestion && (
                <div className="border-t border-(--earist-border-gray) pt-3">
                  <button
                    onClick={() => setShowEssay(true)}
                    className={`w-full py-2 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-between ${
                      showEssay
                        ? "ring-2 ring-blue-600 bg-blue-50 text-blue-700"
                        : essayText.trim()
                          ? "bg-green-100 text-green-700 border border-green-300"
                          : "bg-(--earist-surface-gray) text-(--earist-body-text) hover:bg-gray-200"
                    }`}
                  >
                    <span>Essay Question</span>
                    {essayText.trim() ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    ) : null}
                  </button>
                </div>
              )}

              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-xs"
                onClick={() => setShowSubmitConfirm(true)}
              >
                Submit Exam
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md bg-white">
            <CardHeader className="flex flex-row items-center justify-between border-b border-(--earist-border-gray) pb-3">
              <CardTitle className="text-base font-bold text-(--earist-primary)">
                Confirm Exam Submission
              </CardTitle>
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="text-sm text-(--earist-body-text)">
                Are you sure you want to submit your examination? Once
                submitted, you cannot change your answers.
              </p>
              <div className="rounded-lg bg-(--earist-surface-gray) p-3 text-xs space-y-1">
                <p>
                  <strong>MCQ Progress:</strong> {Object.keys(answers).length} /{" "}
                  {mcqQuestions.length} answered
                </p>
                <p>
                  <strong>Essay Progress:</strong>{" "}
                  {essayText.trim()
                    ? `${essayWordCount} words written`
                    : "Not answered"}
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSubmitConfirm(false)}
                >
                  Continue Exam
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleFinalSubmit}
                >
                  Yes, Submit Exam
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
