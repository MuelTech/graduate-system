"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useSyncExternalStore,
} from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { apiClientRequest } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { ExamQuestion } from "@/types";
import type { ExamExecution, ExecutionClock } from "@/lib/exam-execution";
import {
  executionSeconds,
  executionPath,
  examinationTimestamp,
} from "@/lib/exam-execution";
import {
  formatScheduleDate,
  formatScheduleTime,
} from "@/lib/admin-exam-schedules";
import { ApplicantQuestionRenderer } from "@/components/exam-content/applicant-question-renderer";
import { SemanticText } from "@/components/exam-content/semantic-text";
import { StimulusRenderer } from "@/components/exam-content/stimulus-renderer";
import { ExamExecutionContext } from "@/components/exam-content/exam-execution-context";
import { ExamDraftQueue, draftStatusText } from "@/lib/exam-drafts";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  FileText,
  Send,
} from "lucide-react";

export default function ApplicantExamPage() {
  const { data: session } = useSession();
  const userId = session?.user.id;
  const pinnedApplication = useRef<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showEssay, setShowEssay] = useState(false);
  const [tick, setTick] = useState<number | null>(null);
  const [connected, setConnected] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [preparing, setPreparing] = useState(false);
  const prepareBusy = useRef(false);
  const startBusy = useRef(false);
  const submitBusy = useRef(false);
  const query = useQuery<ExecutionClock | null>({
    queryKey: ["applicant-exam-execution", userId],
    enabled: !!userId,
    queryFn: async () => {
      const receivedAt = performance.now();
      const execution: ExamExecution | null = await apiClientRequest(
        pinnedApplication.current
          ? executionPath(pinnedApplication.current, "execution")
          : "/exam-engine/execution",
        { method: "GET", cache: "no-store" },
      );
      if (!execution) return null;
      pinnedApplication.current = execution.applicationId;
      return { execution, receivedAt };
    },
    gcTime: 0,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 15_000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    retry: false,
  });
  const { refetch: refetchExecution } = query;
  const clock = query.data;
  const execution = clock?.execution;
  const timeLeft = clock
    ? executionSeconds(
        clock,
        Math.max(tick ?? clock.receivedAt, clock.receivedAt),
      )
    : 0;
  const active =
    execution?.state === "ACTIVE" &&
    timeLeft > 0 &&
    !query.isError &&
    connected;
  const questionsQuery = useQuery<ExamQuestion[]>({
    queryKey: [
      "applicant-bound-exam-questions",
      userId,
      execution?.applicationId,
      execution?.contentRevisionId,
    ],
    queryFn: () =>
      apiClientRequest(executionPath(execution!.applicationId, "questions"), {
        method: "GET",
        cache: "no-store",
      }),
    enabled: active,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const mcqQuestions = (questionsQuery.data ?? []).filter(
    (q) => q.type === "MULTIPLE_CHOICE",
  );
  const essayQuestion =
    (questionsQuery.data ?? []).find((q) => q.type === "ESSAY") ?? null;
  const applicationId = execution?.applicationId;
  const drafts = useMemo(
    () =>
      new ExamDraftQueue({
        read: () =>
          apiClientRequest(executionPath(applicationId!, "drafts"), {
            method: "GET",
            cache: "no-store",
          }),
        write: (body) =>
          apiClientRequest(executionPath(applicationId!, "drafts"), {
            method: "PATCH",
            body: JSON.stringify(body),
          }),
      }),
    [applicationId],
  );
  const draftState = useSyncExternalStore(
    drafts.subscribe,
    drafts.snapshot,
    drafts.snapshot,
  );
  const answers = Object.fromEntries(
    Object.entries(draftState.values).flatMap(([id, value]) =>
      "selectedOptionId" in value && value.selectedOptionId
        ? [[id, value.selectedOptionId]]
        : [],
    ),
  );
  const essayValue = essayQuestion
    ? draftState.values[essayQuestion.id]
    : undefined;
  const essayText =
    essayValue && "essayAnswer" in essayValue ? essayValue.essayAnswer : "";
  const draftsEnabled = active && questionsQuery.isSuccess;
  useEffect(() => {
    if (draftsEnabled) void drafts.activate();
    else drafts.pause();
    return () => drafts.pause();
  }, [drafts, draftsEnabled]);
  const editingLocked =
    preparing || showSubmitConfirm || draftState.status === "conflict";
  const start = useMutation({
    mutationFn: () =>
      apiClientRequest(executionPath(execution!.applicationId, "start"), {
        method: "POST",
        body: "{}",
      }),
    retry: false,
    onSettled: async () => {
      await refetchExecution();
      startBusy.current = false;
    },
  });
  const submit = useMutation({
    mutationFn: () => {
      const current = drafts.snapshot().values;
      const formattedAnswers: Array<{
        questionId: string;
        selectedOptionId?: string;
        essayAnswer?: string;
      }> = Object.entries(current).flatMap<{
        questionId: string;
        essayAnswer?: string;
        selectedOptionId?: string;
      }>(([questionId, value]) =>
        "essayAnswer" in value
          ? [{ questionId, essayAnswer: value.essayAnswer }]
          : value.selectedOptionId
            ? [{ questionId, selectedOptionId: value.selectedOptionId }]
            : [],
      );
      return apiClientRequest(
        executionPath(execution!.applicationId, "submit"),
        { method: "POST", body: JSON.stringify({ answers: formattedAnswers }) },
      );
    },
    retry: false,
    onSuccess: () => setShowSubmitConfirm(false),
    onError: (error) => setErrorMsg(error.message),
    onSettled: async () => {
      await refetchExecution();
      submitBusy.current = false;
    },
  });
  useEffect(() => {
    const timer = setInterval(() => setTick(performance.now()), 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const offline = () => {
      drafts.pause();
      setConnected(false);
    };
    const online = () => {
      void refetchExecution().then(async (result) => {
        const valid =
          !result.isError && result.data?.execution.state === "ACTIVE";
        if (valid) await drafts.activate();
        setConnected(!result.isError);
      });
    };
    const visible = () => {
      if (document.visibilityState === "visible") online();
      else void drafts.flush();
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    window.addEventListener("focus", online);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      window.removeEventListener("focus", online);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refetchExecution, drafts]);

  const formatTime = (seconds: number) =>
    `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const essayWordCount = essayText.trim().split(/\s+/).filter(Boolean).length;
  const prepareSubmission = async () => {
    if (!active || prepareBusy.current || submitBusy.current) return;
    prepareBusy.current = true;
    setPreparing(true);
    try {
      if (await drafts.prepare()) setShowSubmitConfirm(true);
    } finally {
      prepareBusy.current = false;
      setPreparing(false);
    }
  };
  const handleFinalSubmit = async () => {
    if (!active || submitBusy.current) return;
    submitBusy.current = true;
    setPreparing(true);
    setErrorMsg("");
    if (!(await drafts.prepare())) {
      submitBusy.current = false;
      setPreparing(false);
      setShowSubmitConfirm(false);
      return;
    }
    setPreparing(false);
    submit.mutate();
  };

  if (query.isPending)
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  if (query.isError || !connected)
    return (
      <Alert>
        <AlertDescription>
          Reconnect and refresh examination status before continuing. Your
          deadline stays unchanged.{" "}
          <Button
            variant="outline"
            onClick={() => {
              void refetchExecution().then((result) =>
                setConnected(!result.isError),
              );
            }}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (!execution)
    return (
      <Card>
        <CardContent className="space-y-4">
          <PageHeader title="Entrance Examination" />
          <p>No examination appointment is recorded.</p>
          <Link href="/applicant/schedule">Select Exam Schedule</Link>
        </CardContent>
      </Card>
    );
  if (execution.state === "TERMINAL" || execution.state === "LEGACY_UNBOUND")
    return (
      <Card>
        <CardContent className="space-y-3">
          <PageHeader title="Entrance Examination" />
          <p>
            {execution.state === "TERMINAL"
              ? ["TAKEN", "PASSED", "FAILED"].includes(
                  execution.applicationStatus,
                )
                ? "Your examination has been submitted."
                : "This examination is no longer available for answering."
              : "This legacy record has no recorded examination start or content binding."}
          </p>
          {execution.reason && <p>{execution.reason}</p>}
          <Link href="/applicant/results">View examination status</Link>
        </CardContent>
      </Card>
    );
  if (
    execution.state === "EXPIRED" ||
    (execution.state === "ACTIVE" && timeLeft === 0)
  )
    return (
      <Alert>
        <AlertDescription>
          Your examination time has expired. Examination access is locked.
          Automatic submission and a final receipt are not available yet.
          Contact Graduate School staff.
        </AlertDescription>
      </Alert>
    );
  if (execution.state === "BLOCKED" && execution.actualStartedAt)
    return (
      <Alert>
        <AlertDescription>
          {execution.reason ??
            "Examination access is blocked. Contact Graduate School staff."}{" "}
          Your recorded start is{" "}
          {examinationTimestamp(execution.actualStartedAt)}
          {execution.deadlineAt
            ? `; deadline: ${examinationTimestamp(execution.deadlineAt)}`
            : ""}
          .
        </AlertDescription>
      </Alert>
    );
  if (execution.state !== "ACTIVE")
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="Entrance Examination" />
        <Card>
          <CardContent className="space-y-4">
            <h2 className="text-base font-semibold">Original appointment</h2>
            <p>{execution.appointment.programName}</p>
            <p>
              {formatScheduleDate(execution.appointment.examDate)} ·{" "}
              {formatScheduleTime(execution.appointment.examTime)}
            </p>
            <p>Examination not started.</p>
            {execution.authorization && (
              <p>Start Now authorized. Your timer has not started.</p>
            )}
            {execution.reason && <p role="status">{execution.reason}</p>}
            <p className="text-sm text-muted-foreground">
              Your allotted time begins when you click Start Examination.
              Refreshing restores the same deadline, questions and saved
              answers.
            </p>
            {start.isError && (
              <p role="alert" className="text-sm text-destructive">
                {start.error.message}
              </p>
            )}
            <Button
              disabled={!execution.canStart || start.isPending}
              onClick={() => {
                if (startBusy.current) return;
                startBusy.current = true;
                start.mutate();
              }}
            >
              {start.isPending ? "Starting…" : "Start Examination"}
            </Button>
            <Button variant="outline" onClick={() => refetchExecution()}>
              Refresh status
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  if (questionsQuery.isPending) return <Skeleton className="h-64 w-full" />;
  if (questionsQuery.isError)
    return (
      <Alert>
        <AlertDescription>
          Examination content could not be loaded.{" "}
          <Button variant="outline" onClick={() => questionsQuery.refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (!draftState.ready)
    return draftState.status === "error" ? (
      <Alert>
        <AlertDescription>
          Saved answers could not be loaded.{" "}
          <Button variant="outline" onClick={() => drafts.activate()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    ) : (
      <Skeleton className="h-64 w-full" />
    );
  // --- STATE 5: EXAM IN PROGRESS ---
  return (
    <ExamExecutionContext.Provider value={execution.applicationId}>
      <div className="space-y-4 relative">
        <p className="text-sm text-muted-foreground">
          Original appointment:{" "}
          {formatScheduleDate(execution.appointment.examDate)} ·{" "}
          {formatScheduleTime(execution.appointment.examTime)}. Deadline:{" "}
          {examinationTimestamp(execution.deadlineAt!)}.
        </p>
        <div
          className="flex flex-wrap items-center gap-2 text-sm"
          role="status"
          aria-live="polite"
        >
          <span>{draftStatusText[draftState.status]}</span>
          {draftState.status === "error" && (
            <Button variant="outline" onClick={() => drafts.prepare()}>
              Retry save
            </Button>
          )}
          {draftState.status === "conflict" && (
            <Button variant="outline" onClick={() => drafts.resync(true)}>
              Refresh saved answers
            </Button>
          )}
          {preparing && <span>Synchronizing answers…</span>}
        </div>
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

        <fieldset
          disabled={editingLocked}
          className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-4"
        >
          <legend className="sr-only">Examination answers</legend>
          {/* Main Content Area */}
          <div className="min-w-0 lg:col-span-3">
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
                  <ApplicantQuestionRenderer
                    key={mcqQuestions[currentQuestion].id}
                    question={mcqQuestions[currentQuestion]}
                    selectedOptionId={answers[mcqQuestions[currentQuestion].id]}
                    onSelect={(optionId) =>
                      drafts.change(mcqQuestions[currentQuestion].id, {
                        selectedOptionId: optionId,
                      })
                    }
                  />
                  <Button
                    variant="outline"
                    disabled={!answers[mcqQuestions[currentQuestion].id]}
                    onClick={() =>
                      drafts.change(mcqQuestions[currentQuestion].id, {
                        selectedOptionId: null,
                      })
                    }
                  >
                    Clear answer
                  </Button>

                  {/* Navigation Buttons */}
                  <div className="flex items-center justify-between border-t border-(--earist-border-gray) pt-4">
                    <Button
                      variant="outline"
                      disabled={currentQuestion === 0}
                      onClick={() => {
                        void drafts.flush();
                        setCurrentQuestion((prev) => prev - 1);
                      }}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                    </Button>

                    {currentQuestion < mcqQuestions.length - 1 ? (
                      <Button
                        className="bg-(--earist-primary) hover:bg-red-900"
                        onClick={() => {
                          void drafts.flush();
                          setCurrentQuestion((prev) => prev + 1);
                        }}
                      >
                        Next <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    ) : (
                      essayQuestion && (
                        <Button
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => {
                            void drafts.flush();
                            setShowEssay(true);
                          }}
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
                  <StimulusRenderer
                    stimulusType={essayQuestion.stimulusType}
                    stimulusMediaId={essayQuestion.stimulusMediaId}
                    structuredStimulus={essayQuestion.structuredStimulus}
                    structuredStimulusEmphasis={
                      essayQuestion.structuredStimulusEmphasis
                    }
                  />
                  <p className="text-sm font-medium text-(--earist-body-text)">
                    <SemanticText
                      text={essayQuestion.questionText}
                      emphasis={essayQuestion.questionTextEmphasis}
                    />
                  </p>

                  <textarea
                    className="min-h-64 w-full rounded-md border border-(--earist-border-gray) p-3 text-sm focus:border-(--earist-primary) focus:ring-1 focus:ring-(--earist-primary) outline-none"
                    placeholder="Type your essay response here..."
                    aria-label="Essay response"
                    value={essayText}
                    onChange={(e) =>
                      drafts.change(essayQuestion.id, {
                        essayAnswer: e.target.value,
                      })
                    }
                    onBlur={() => {
                      void drafts.flush();
                    }}
                  />

                  <div className="flex items-center justify-between border-t border-(--earist-border-gray) pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        void drafts.flush();
                        setShowEssay(false);
                      }}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" /> Back to MCQs
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        void prepareSubmission();
                      }}
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
                          void drafts.flush();
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
                      onClick={() => {
                        void drafts.flush();
                        setShowEssay(true);
                      }}
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
                  onClick={() => {
                    void prepareSubmission();
                  }}
                >
                  Submit Exam
                </Button>
              </CardContent>
            </Card>
          </div>
        </fieldset>

        <Dialog
          open={showSubmitConfirm}
          onOpenChange={(value) => {
            if (!submitBusy.current) setShowSubmitConfirm(value);
          }}
        >
          <DialogContent showCloseButton={!submit.isPending}>
            <DialogHeader>
              <DialogTitle>Confirm Exam Submission</DialogTitle>
              <DialogDescription>
                Once submitted, you cannot change your answers.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm">
              MCQ Progress: {Object.keys(answers).length} /{" "}
              {mcqQuestions.length} answered. Essay:{" "}
              {essayText.trim()
                ? `${essayWordCount} words written`
                : "Not answered"}
              .
            </p>
            {errorMsg && (
              <p role="alert" className="text-sm text-destructive">
                {errorMsg}
              </p>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                disabled={submit.isPending}
                onClick={() => setShowSubmitConfirm(false)}
              >
                Continue Exam
              </Button>
              <Button
                disabled={
                  submit.isPending ||
                  preparing ||
                  !active ||
                  draftState.status !== "saved"
                }
                onClick={handleFinalSubmit}
              >
                {submit.isPending ? "Submitting…" : "Yes, Submit Exam"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ExamExecutionContext.Provider>
  );
}
