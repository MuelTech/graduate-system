"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminQuestion } from "@/types";
import { apiClientRequest } from "@/lib/api.client";
import { optionLabel } from "@/lib/exam-content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminQuestionEditor } from "@/components/exam-content/admin-question-editor";
import { StimulusRenderer } from "@/components/exam-content/stimulus-renderer";
import { OptionContentRenderer } from "@/components/exam-content/option-content-renderer";

const PAGE_SIZE = 8;
export default function AdminExamQuestionsPage() {
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<{
    question: AdminQuestion | null;
  } | null>(null);
  const [working, setWorking] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const listRequest = useRef<AbortController | null>(null);
  const fetchQuestions = useCallback(async () => {
    listRequest.current?.abort();
    const request = new AbortController();
    listRequest.current = request;
    setLoading(true);
    setError("");
    try {
      const result = await apiClientRequest("/exam-engine/admin/questions", {
        signal: request.signal,
      });
      if (!request.signal.aborted) setQuestions(result);
    } catch {
      if (!request.signal.aborted)
        setError("Could not load questions. Check your session and try again.");
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const request = new AbortController();
    listRequest.current = request;
    void apiClientRequest("/exam-engine/admin/questions", {
      signal: request.signal,
    })
      .then((result) => {
        if (!request.signal.aborted) setQuestions(result);
      })
      .catch(() => {
        if (!request.signal.aborted)
          setError(
            "Could not load questions. Check your session and try again.",
          );
      })
      .finally(() => {
        if (!request.signal.aborted) setLoading(false);
      });
    return () => listRequest.current?.abort();
  }, []);
  async function remove(question: AdminQuestion) {
    if (
      !window.confirm(
        "Delete this question? Its linked answers may also be removed.",
      )
    )
      return;
    setDeleting(question.id);
    setError("");
    try {
      await apiClientRequest(`/exam-engine/admin/questions/${question.id}`, {
        method: "DELETE",
      });
      await fetchQuestions();
    } catch {
      setError(
        "Could not delete the question. Check your session and try again.",
      );
    } finally {
      setDeleting(null);
    }
  }
  const pageCount = Math.max(1, Math.ceil(questions.length / PAGE_SIZE));
  const visiblePage = Math.min(page, pageCount - 1);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-(--earist-primary)">
            Exam Question Bank
          </h1>
          <p className="text-sm text-(--earist-body-text)">
            View and maintain entrance-exam questions and answer choices.
          </p>
        </div>
        <Button
          onClick={() => {
            setWorking(false);
            setEditor({ question: null });
          }}
        >
          Add question
        </Button>
      </div>
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
          <Button variant="outline" onClick={() => void fetchQuestions()}>
            Reload
          </Button>
        </div>
      )}
      {loading ? (
        <p role="status">Loading questions…</p>
      ) : !questions.length ? (
        <Card>
          <CardContent className="p-6 text-sm">
            No questions found. Add a question to get started.
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            {questions.length} questions · Page {visiblePage + 1} of {pageCount}
          </p>
          {questions
            .slice(visiblePage * PAGE_SIZE, (visiblePage + 1) * PAGE_SIZE)
            .map((question) => (
              <Card key={question.id}>
                <CardContent className="space-y-4 p-4 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Order {question.order}</Badge>
                      <Badge variant="outline">
                        {question.type === "ESSAY"
                          ? "Essay"
                          : "Multiple choice"}
                      </Badge>
                      <Badge variant="outline">
                        {question.stimulusType === "NONE"
                          ? "No stimulus"
                          : question.stimulusType === "IMAGE"
                            ? "Image stimulus"
                            : "Structured stimulus"}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setWorking(false);
                          setEditor({ question });
                        }}
                        aria-label={`Edit question ${question.order}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deleting !== null}
                        onClick={() => void remove(question)}
                        aria-label={`Delete question ${question.order}`}
                      >
                        {deleting === question.id ? "Deleting…" : "Delete"}
                      </Button>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap font-medium text-(--earist-primary)">
                    {question.questionText}
                  </p>
                  <StimulusRenderer
                    stimulusType={question.stimulusType}
                    stimulusMediaId={question.stimulusMediaId}
                    structuredStimulus={question.structuredStimulus}
                  />
                  {question.type === "MULTIPLE_CHOICE" && (
                    <ol
                      aria-label="Answer options"
                      className="grid list-none gap-3 sm:grid-cols-2"
                    >
                      {question.options
                        .slice()
                        .sort(
                          (a, b) =>
                            a.order - b.order || a.id.localeCompare(b.id),
                        )
                        .map((option) => (
                          <li
                            key={option.id}
                            className={`space-y-2 rounded-lg border p-3 ${option.isCorrect ? "border-green-300 bg-green-50" : "border-gray-200"}`}
                          >
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-semibold">
                                {optionLabel(option)}
                              </span>
                              <span className="text-xs text-gray-500">
                                Order {option.order}
                              </span>
                              {option.isCorrect && (
                                <Badge
                                  variant="outline"
                                  className="border-green-300 text-green-800"
                                >
                                  Correct answer
                                </Badge>
                              )}
                            </div>
                            <OptionContentRenderer
                              optionText={option.optionText}
                              mediaId={option.mediaId}
                              alt={`${optionLabel(option)} image`}
                            />
                          </li>
                        ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            ))}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              disabled={visiblePage === 0}
              onClick={() => setPage(visiblePage - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={visiblePage >= pageCount - 1}
              onClick={() => setPage(visiblePage + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open && !working) setEditor(null);
        }}
      >
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
          showCloseButton={!working}
        >
          <DialogHeader>
            <DialogTitle>
              {editor?.question ? "Edit question" : "Add question"}
            </DialogTitle>
            <DialogDescription>
              Edit question wording, stimulus and ordered answer options.
            </DialogDescription>
          </DialogHeader>
          {editor && (
            <AdminQuestionEditor
              key={editor.question?.id ?? "new"}
              question={editor.question}
              defaultOrder={
                Math.max(0, ...questions.map((question) => question.order)) + 1
              }
              onBusyChange={setWorking}
              onCancel={() => setEditor(null)}
              onSaved={() => {
                setEditor(null);
                setWorking(false);
                void fetchQuestions();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
