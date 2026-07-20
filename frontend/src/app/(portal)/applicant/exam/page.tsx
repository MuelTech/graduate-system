"use client";
import { useState, useEffect } from "react";
import axios from "axios";
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
  AlertTriangle,
  FileText,
  Timer,
  Send,
  X,
} from "lucide-react";
const getLetter = (index: number) => String.fromCharCode(65 + index);
export default function ApplicantExamPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  const [examState, setExamState] = useState<
    "loading" | "countdown" | "in_progress" | "submitted"
  >("loading");

  const [mcqQuestions, setMcqQuestions] = useState<ExamQuestion[]>([]);
  const [essayQuestion, setEssayQuestion] = useState<ExamQuestion | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [upcomingExamStart, setUpcomingExamStart] = useState<Date | null>(null);
  const [timeUntilExam, setTimeUntilExam] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [essayText, setEssayText] = useState("");

  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10800);
  const [showEssay, setShowEssay] = useState(false);
  // 1. FETCH SCHEDULE AND QUESTIONS
  useEffect(() => {
    const fetchExamData = async () => {
      try {
        // Get Schedule First
        const schedRes = await axios.get(
          `${API_BASE}/exam-engine/schedule`,
          { withCredentials: true },
        );
        const { examDate, examTime, status } = schedRes.data;
        if (status === "TAKEN" || status === "PASSED" || status === "FAILED") {
          setExamState("submitted");
          return;
        }
        if (!examDate || !examTime) {
          setErrorMsg(
            "You do not have a scheduled exam date yet. Please check your application status.",
          );
          setExamState("countdown");
          return;
        }
        const scheduledDate = new Date(examDate);
        const scheduledTimeStr = new Date(examTime);
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
          setErrorMsg(
            `Your exam is scheduled for ${examStart.toLocaleString()}`,
          );
          setExamState("countdown");
          return;
        }
        // If time is valid, fetch questions
        const res = await axios.get(
          `${API_BASE}/exam-engine/questions`,
          { withCredentials: true },
        );
        setMcqQuestions(
          res.data.filter((q: ExamQuestion) => q.type === "MULTIPLE_CHOICE"),
        );
        setEssayQuestion(
          res.data.find((q: ExamQuestion) => q.type === "ESSAY"),
        );
        setExamState("in_progress");
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          setErrorMsg(
            error.response?.data?.error || "Failed to load exam data.",
          );
        } else {
          setErrorMsg("An unexpected error occurred.");
        }
        setExamState("countdown");
      }
    };
    fetchExamData();
  }, []);
  // 2. LIVE COUNTDOWN TIMER (BEFORE EXAM)
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
        setTimeUntilExam(`${d > 0 ? d + "d " : ""}${h}h ${m}m ${s}s`);
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
        await axios.patch(
          `${API_BASE}/exam-engine/autosave`,
          {
            questionId: essayQuestion.id,
            essayAnswer: essayText,
          },
          { withCredentials: true },
        );
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
  const allMcqAnswered = Object.keys(answers).length === mcqQuestions.length;
  const handleFinalSubmit = async () => {
    try {
            const formattedAnswers: Array<{ questionId: string; selectedOptionId?: string; essayAnswer?: string }> = 
        Object.entries(answers).map(([qId, oId]) => ({
          questionId: qId,
          selectedOptionId: oId,
        }));

      if (essayQuestion && essayText)
        formattedAnswers.push({
          questionId: essayQuestion.id,
          essayAnswer: essayText,
        });
      await axios.post(
        `${API_BASE}/exam-engine/submit`,
        { answers: formattedAnswers },
        { withCredentials: true },
      );
      setExamState("submitted");
      setShowSubmitConfirm(false);
    } catch (error) {
      alert("Submission failed! Your time might have expired.");
      console.error(error);
    }
  };
  if (examState === "loading") {
    return (
      <div className="p-8 text-center text-(--earist-primary)">
        Loading exam environment...
      </div>
    );
  }

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
                Your entrance examination has been submitted. The MCQ section
                was auto-graded, and the essay has been queued for Program Chair
                review.
              </p>
              <Badge className="bg-green-100 text-green-700">Submitted</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (examState === "countdown") {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--earist-surface-light-red)">
                <Timer className="h-8 w-8 text-(--earist-primary)" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                Exam Not Yet Available
              </h3>
              <p className="mb-4 text-sm text-(--earist-body-text)">
                {errorMsg}
              </p>

              {timeUntilExam && (
                <div className="rounded-lg bg-(--earist-surface-gray) p-4 mt-2 border border-(--earist-border-gray)">
                  <p className="text-xs text-(--earist-body-text) mb-1 uppercase tracking-wider font-semibold">
                    Time until exam opens
                  </p>
                  <p className="font-mono text-3xl font-bold text-(--earist-primary)">
                    {timeUntilExam}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      {/* 4. EXAM HEADER BAR */}
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
                    answered
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm font-medium text-(--earist-primary)">
                    {mcqQuestions[currentQuestion].questionText}
                  </p>
                  <div className="space-y-2">
                    {mcqQuestions[currentQuestion].options.map(
                      (option: ExamOption, i: number) => {
                        const isSelected =
                          answers[mcqQuestions[currentQuestion].id] ===
                          option.id;
                        return (
                          <label
                            key={option.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                              isSelected
                                ? "border-(--earist-primary) bg-(--earist-surface-light-red)"
                                : "border-(--earist-border-gray) hover:bg-(--earist-surface-gray)"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`q-${mcqQuestions[currentQuestion].id}`}
                              value={option.id}
                              checked={isSelected}
                              onChange={() =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [mcqQuestions[currentQuestion].id]: option.id,
                                }))
                              }
                              className="mt-0.5"
                            />
                            <span className="text-sm text-(--earist-body-text)">
                              <span className="mr-2 font-semibold text-(--earist-primary)">
                                {getLetter(i)}.
                              </span>
                              {option.optionText}
                            </span>
                          </label>
                        );
                      },
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ESSAY SECTION */}
          {showEssay && essayQuestion && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                  Essay Section
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Alert className="bg-blue-50 text-blue-800 border-blue-200">
                    <AlertDescription className="text-xs">
                      Your answer will be saved automatically every 60 seconds.
                    </AlertDescription>
                  </Alert>
                  <p className="text-sm font-medium text-(--earist-primary)">
                    {essayQuestion.questionText}
                  </p>
                  <div>
                    <textarea
                      className="min-h-75 w-full rounded-md border border-(--earist-border-gray) p-3 text-sm focus:border-(--earist-primary) focus:outline-none focus:ring-1 focus:ring-(--earist-primary)"
                      placeholder="Type your essay here..."
                      value={essayText}
                      onChange={(e) => setEssayText(e.target.value)}
                    />
                    {/* 5. WORD COUNT DISPLAY */}
                    <p className="mt-2 text-right text-xs text-(--earist-body-text)">
                      Word count: {essayWordCount} / 500
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* NAVIGATION CONTROLS */}
          <div className="mt-4 flex items-center justify-between">
            {!showEssay ? (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    setCurrentQuestion((prev) => Math.max(0, prev - 1))
                  }
                  disabled={currentQuestion === 0}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                </Button>
                {currentQuestion < mcqQuestions.length - 1 ? (
                  <Button
                    onClick={() => setCurrentQuestion((prev) => prev + 1)}
                  >
                    Next <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => setShowEssay(true)}
                    className="bg-(--earist-secondary) hover:bg-orange-600"
                  >
                    Proceed to Essay <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowEssay(false)}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back to Multiple
                  Choice
                </Button>
                <Button
                  onClick={() => setShowSubmitConfirm(true)}
                  disabled={!allMcqAnswered} // Strictly disabled until MCQ done
                  className="bg-(--earist-primary) hover:bg-red-900"
                >
                  <Send className="mr-2 h-4 w-4" /> Submit Examination
                </Button>
              </>
            )}
          </div>
        </div>

        {/* QUESTION PALETTE SIDEBAR */}
        <div className="lg:col-span-1">
          <Card className="sticky top-32">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-(--earist-primary)">
                Question Palette
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
                {mcqQuestions.map((q: ExamQuestion, idx: number) => {
                  const isAnswered = !!answers[q.id];
                  const isCurrent = !showEssay && currentQuestion === idx;
                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setShowEssay(false);
                        setCurrentQuestion(idx);
                      }}
                      className={`flex h-10 w-full items-center justify-center rounded-md border text-sm font-medium transition-colors ${
                        isCurrent
                          ? "border-(--earist-secondary) ring-1 ring-(--earist-secondary)"
                          : ""
                      } ${
                        isAnswered
                          ? "bg-(--earist-primary) text-white border-(--earist-primary)"
                          : "bg-white text-(--earist-body-text) border-(--earist-border-gray) hover:bg-(--earist-surface-gray)"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {essayQuestion && (
                <div className="mt-6 border-t border-(--earist-border-gray) pt-4">
                  <button
                    onClick={() => setShowEssay(true)}
                    className={`flex w-full items-center justify-between rounded-md border p-3 text-sm font-medium transition-colors ${
                      showEssay
                        ? "border-(--earist-secondary) ring-1 ring-(--earist-secondary) bg-orange-50"
                        : "border-(--earist-border-gray) hover:bg-(--earist-surface-gray)"
                    }`}
                  >
                    <span>Essay Section</span>
                    {essayText.trim().length > 0 && (
                      <CheckCircle2 className="h-4 w-4 text-(--earist-primary)" />
                    )}
                  </button>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-2 text-xs text-(--earist-body-text)">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm bg-(--earist-primary)"></div>
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm border border-(--earist-border-gray) bg-white"></div>
                  <span>Not Answered</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md animate-in fade-in zoom-in-95">
            <CardHeader className="pb-3 border-b border-(--earist-border-gray)">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-(--earist-primary)">
                  Submit Examination?
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSubmitConfirm(false)}
                  className="h-8 w-8 rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-start gap-3 rounded-md bg-amber-50 p-3 text-amber-800">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p className="text-sm">
                  Are you sure you want to submit? You will not be able to
                  change your answers after submission.
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSubmitConfirm(false)}
                >
                  Review Answers
                </Button>
                <Button
                  onClick={handleFinalSubmit}
                  className="bg-(--earist-primary) hover:bg-red-900"
                >
                  Confirm Submission
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
