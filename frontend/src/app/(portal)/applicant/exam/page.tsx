"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

export default function ApplicantExamPage() {
  const examState = "in_progress" as "countdown" | "in_progress" | "submitted";

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [essayText, setEssayText] = useState("");
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10800);
  const [showEssay, setShowEssay] = useState(false);

  const mcqQuestions = [
    {
      id: 1,
      question:
        "Which of the following best describes the primary purpose of a literature review in research?",
      options: [
        "To present the researcher's personal opinions on the topic",
        "To summarize existing research and identify gaps in knowledge",
        "To prove that the researcher has read enough books",
        "To replace the need for primary data collection",
      ],
    },
    {
      id: 2,
      question: "In research methodology, what does 'validity' refer to?",
      options: [
        "The consistency of a measurement instrument",
        "The extent to which a test measures what it claims to measure",
        "The sample size of the study",
        "The speed of data collection",
      ],
    },
    {
      id: 3,
      question:
        "Which sampling technique gives every member of a population an equal chance of being selected?",
      options: [
        "Convenience sampling",
        "Purposive sampling",
        "Random sampling",
        "Snowball sampling",
      ],
    },
    {
      id: 4,
      question:
        "What is the primary advantage of using a mixed-methods research design?",
      options: [
        "It is faster to complete than single-method studies",
        "It combines quantitative and qualitative data for comprehensive insights",
        "It eliminates the need for statistical analysis",
        "It requires fewer resources than other approaches",
      ],
    },
    {
      id: 5,
      question: "Which of the following is an example of a null hypothesis?",
      options: [
        "There is a significant relationship between study hours and exam scores",
        "There is no significant difference between group A and group B",
        "The treatment will improve patient outcomes",
        "The sample mean is greater than the population mean",
      ],
    },
    {
      id: 6,
      question:
        "What does 'ethical consideration' in research primarily ensure?",
      options: [
        "That the research will be published in a reputable journal",
        "That participants' rights, privacy, and well-being are protected",
        "That the researcher will receive academic credit",
        "That the results will be statistically significant",
      ],
    },
    {
      id: 7,
      question: "In qualitative research, what is 'triangulation'?",
      options: [
        "Using three different statistical tests",
        "Collecting data from three different countries",
        "Using multiple methods or data sources to verify findings",
        "Having three researchers conduct the same study",
      ],
    },
    {
      id: 8,
      question:
        "Which of the following is NOT a characteristic of a good research question?",
      options: [
        "Clear and specific",
        "Feasible to investigate",
        "Broad and general",
        "Relevant to the field of study",
      ],
    },
    {
      id: 9,
      question: "What is the purpose of a pilot study in research?",
      options: [
        "To replace the main study",
        "To test the research instruments and procedures before full implementation",
        "To collect preliminary data for publication",
        "To train other researchers",
      ],
    },
    {
      id: 10,
      question: "Which of the following best describes 'academic integrity'?",
      options: [
        "Writing papers as quickly as possible",
        "Maintaining honesty, trust, fairness, and responsibility in academic work",
        "Citing only sources that support your argument",
        "Submitting work before the deadline",
      ],
    },
  ];

  const allMcqAnswered = Object.keys(answers).length === mcqQuestions.length;

  useEffect(() => {
    if (examState !== "in_progress") return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [examState]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const essayWordCount = essayText
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

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
                Your entrance examination has been submitted. Results will be
                sent to your registered email address.
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
                Your exam is scheduled for June 15, 2026 at 9:00 AM.
              </p>
              <div className="rounded-lg bg-(--earist-surface-gray) p-4">
                <p className="text-xs text-(--earist-body-text)">
                  Time until exam
                </p>
                <p className="font-mono text-2xl font-bold text-(--earist-primary)">
                  23:45:30
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Exam Header Bar */}
      <div className="sticky top-16 z-20 flex items-center justify-between rounded-xl border border-(--earist-border-gray) bg-white px-4 py-3">
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
          {/* MCQ Section */}
          {!showEssay && (
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
                    {mcqQuestions[currentQuestion].question}
                  </p>
                  <div className="space-y-2">
                    {mcqQuestions[currentQuestion].options.map((option, i) => {
                      const optionLabel = String.fromCharCode(65 + i);
                      const isSelected =
                        answers[currentQuestion] === optionLabel;
                      return (
                        <label
                          key={i}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                            isSelected
                              ? "border-(--earist-primary) bg-(--earist-surface-light-red)"
                              : "border-(--earist-border-gray) hover:bg-(--earist-surface-gray)"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q-${currentQuestion}`}
                            value={optionLabel}
                            checked={isSelected}
                            onChange={() =>
                              setAnswers((prev) => ({
                                ...prev,
                                [currentQuestion]: optionLabel,
                              }))
                            }
                            className="mt-0.5"
                          />
                          <span className="text-sm text-(--earist-body-text)">
                            <span className="mr-2 font-semibold text-(--earist-primary)">
                              {optionLabel}.
                            </span>
                            {option}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-between border-t border-(--earist-border-gray) pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentQuestion((prev) => Math.max(0, prev - 1))
                      }
                      disabled={currentQuestion === 0}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Previous
                    </Button>
                    {currentQuestion === mcqQuestions.length - 1 ? (
                      <Button
                        size="sm"
                        onClick={() => setShowEssay(true)}
                        className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                      >
                        Proceed to Essay
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() =>
                          setCurrentQuestion((prev) =>
                            Math.min(mcqQuestions.length - 1, prev + 1),
                          )
                        }
                        className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                      >
                        Next
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Essay Section */}
          {showEssay && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                    Essay Section
                  </CardTitle>
                  <Badge variant="outline">{essayWordCount} words</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-lg bg-(--earist-surface-gray) p-4">
                    <p className="text-sm font-medium text-(--earist-primary)">
                      Essay Question:
                    </p>
                    <p className="mt-1 text-sm text-(--earist-body-text)">
                      Discuss the importance of research ethics in graduate
                      studies. How does maintaining academic integrity
                      contribute to the advancement of knowledge in your chosen
                      field? Provide specific examples to support your answer.
                    </p>
                  </div>
                  <textarea
                    value={essayText}
                    onChange={(e) => setEssayText(e.target.value)}
                    placeholder="Type your essay response here..."
                    className="min-h-[300px] w-full rounded-lg border border-(--earist-border-gray) p-4 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                  />
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEssay(false)}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Back to MCQ
                    </Button>
                    <p className="text-xs text-(--earist-body-text)">
                      Auto-saved every 60 seconds
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Question Palette Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-32">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                Question Palette
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {mcqQuestions.map((_, i) => {
                  const isAnswered = answers[i] !== undefined;
                  const isCurrent = i === currentQuestion && !showEssay;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setCurrentQuestion(i);
                        setShowEssay(false);
                      }}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                        isCurrent
                          ? "bg-(--earist-primary) text-white"
                          : isAnswered
                            ? "bg-green-100 text-green-700"
                            : "bg-(--earist-surface-gray) text-(--earist-body-text) hover:bg-(--earist-border-gray)"
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 space-y-2 border-t border-(--earist-border-gray) pt-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-green-100" />
                  <span className="text-xs text-(--earist-body-text)">
                    Answered ({Object.keys(answers).length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-(--earist-surface-gray)" />
                  <span className="text-xs text-(--earist-body-text)">
                    Not answered (
                    {mcqQuestions.length - Object.keys(answers).length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-(--earist-primary)" />
                  <span className="text-xs text-(--earist-body-text)">
                    Current
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <div className="mt-4 border-t border-(--earist-border-gray) pt-4">
                <Button
                  onClick={() => setShowSubmitConfirm(true)}
                  disabled={!allMcqAnswered}
                  className={`w-full ${
                    allMcqAnswered
                      ? "bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                      : "cursor-not-allowed bg-gray-200 text-gray-400"
                  }`}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Submit Examination
                </Button>
                {!allMcqAnswered && (
                  <p className="mt-2 text-center text-[11px] text-(--earist-body-text)">
                    Answer all MCQ questions to submit
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Submit Examination
              </h3>
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 space-y-2">
              <p className="text-sm text-(--earist-body-text)">
                Are you sure you want to submit your examination?
              </p>
              <div className="rounded-lg bg-(--earist-surface-gray) p-3 text-xs">
                <p className="text-(--earist-body-text)">
                  MCQ: {Object.keys(answers).length} / {mcqQuestions.length}{" "}
                  answered
                </p>
                <p className="text-(--earist-body-text)">
                  Essay: {essayWordCount} words
                </p>
              </div>
              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700">
                  This action cannot be undone.
                </AlertDescription>
              </Alert>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                Confirm Submit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
