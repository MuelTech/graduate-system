"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiClientRequest } from "@/lib/api.client";
import {
  sameSelection,
  toggleQuestion,
  type QuestionSetDraft,
  type QuestionSetPublication,
} from "@/lib/exam-question-set";
import type { AdminQuestion } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const endpoint = "/exam-engine/admin/question-set";
const queryKey = ["adminExamQuestionSet"];
const PAGE_SIZE = 10;
interface LoadedSet {
  draft: QuestionSetDraft;
  bank: AdminQuestion[];
}

export function QuestionSetForm({
  loaded,
  onBusyChange,
}: {
  loaded: LoadedSet;
  onBusyChange: (busy: boolean) => void;
}) {
  const [saved, setSaved] = useState(loaded.draft);
  const [ids, setIds] = useState(loaded.draft.questionIds);
  const [page, setPage] = useState(0);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const queryClient = useQueryClient();
  const dirty = !sameSelection(ids, saved.questionIds);
  const questions = loaded.bank.filter(
    (q) => !selectedOnly || ids.includes(q.id),
  );
  const pageCount = Math.max(1, Math.ceil(questions.length / PAGE_SIZE));
  const visiblePage = Math.min(page, pageCount - 1);

  async function act(action: "save" | "publish") {
    if (
      inFlight.current ||
      (action === "publish" && (dirty || !ids.length || !confirmation))
    )
      return;
    inFlight.current = true;
    setBusy(action);
    onBusyChange(true);
    setError("");
    setMessage("");
    try {
      if (action === "save") {
        const draft: QuestionSetDraft = await apiClientRequest(endpoint, {
          method: "PUT",
          body: JSON.stringify({ questionIds: ids }),
        });
        setSaved(draft);
        setIds(draft.questionIds);
        queryClient.setQueryData(queryKey, { ...loaded, draft });
        setMessage("Draft selection saved.");
      } else {
        const publication: QuestionSetPublication = await apiClientRequest(
          `${endpoint}/publish`,
          {
            method: "POST",
            body: JSON.stringify({ questionIds: saved.questionIds }),
          },
        );
        const draft = { ...saved, latestPublication: publication };
        setSaved(draft);
        queryClient.setQueryData(queryKey, { ...loaded, draft });
        setConfirmation(false);
        setMessage(
          "Question set published. Later bank edits will not change this published set.",
        );
      }
    } catch (failure) {
      setError(
        failure instanceof ApiError &&
          (failure.statusCode === 400 || failure.statusCode === 409)
          ? failure.message
          : "Could not complete this action. Your edits are still here; please try again.",
      );
    } finally {
      inFlight.current = false;
      setBusy(null);
      onBusyChange(false);
    }
  }

  return (
    <div className="space-y-4" aria-busy={busy !== null}>
      <p className="text-sm text-(--earist-body-text)">
        Prepare questions for future use. Publishing does not start an exam or
        change current Applicant content. Exam composition still requires
        institutional approval.
      </p>
      <p role="status" className="text-sm font-medium">
        {ids.length} selected
        {dirty ? " · Unsaved changes" : " · Saved selection"}
      </p>
      <p className="text-sm">
        {saved.latestPublication
          ? `Published question set available · ${saved.latestPublication.questionCount} questions.`
          : "No question set published yet."}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-(--earist-success)">
          {message}
        </p>
      ) : null}
      <fieldset
        disabled={busy !== null || confirmation}
        className="space-y-3 disabled:opacity-70"
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selectedOnly}
            onChange={(e) => {
              setSelectedOnly(e.target.checked);
              setPage(0);
            }}
          />
          Show selected questions only
        </label>
        <p className="text-xs text-(--earist-body-text)">
          Questions keep their bank order. New questions are not selected
          automatically.
        </p>
        {!questions.length ? (
          <p className="text-sm">
            {selectedOnly
              ? "No selected questions."
              : "No questions available. Add questions in the Question Bank."}
          </p>
        ) : null}
        <ul className="divide-y rounded-lg border">
          {questions
            .slice(visiblePage * PAGE_SIZE, (visiblePage + 1) * PAGE_SIZE)
            .map((q) => (
              <li key={q.id} className="p-3">
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={ids.includes(q.id)}
                    onChange={() => {
                      setIds((current) => toggleQuestion(current, q.id));
                      setMessage("");
                    }}
                  />
                  <span>
                    <span className="block font-medium">
                      Order {q.order} ·{" "}
                      {q.type === "ESSAY" ? "Essay" : "Multiple choice"}
                    </span>
                    <span className="line-clamp-3 whitespace-pre-wrap">
                      {q.questionText}
                    </span>
                  </span>
                </label>
              </li>
            ))}
        </ul>
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={visiblePage === 0}
            onClick={() => setPage(visiblePage - 1)}
          >
            Previous
          </Button>
          <p className="text-sm">
            Page {visiblePage + 1} of {pageCount}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={visiblePage + 1 >= pageCount}
            onClick={() => setPage(visiblePage + 1)}
          >
            Next
          </Button>
        </div>
      </fieldset>
      {confirmation ? (
        <section
          aria-label="Confirm publication"
          className="space-y-3 rounded-lg border p-4"
        >
          <p className="font-medium">
            Publish {saved.questionIds.length} selected questions?
          </p>
          <p className="text-sm">
            This freezes the selected content and order. Later bank edits do not
            alter this published set.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy !== null}
              onClick={() => void act("publish")}
            >
              {busy === "publish" ? "Publishing…" : "Confirm publication"}
            </Button>
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() => setConfirmation(false)}
            >
              Cancel publication
            </Button>
          </div>
        </section>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy !== null || !dirty}
            onClick={() => void act("save")}
          >
            {busy === "save" ? "Saving…" : "Save draft selection"}
          </Button>
          <Button
            variant="outline"
            disabled={busy !== null || dirty || !ids.length}
            onClick={() => {
              setConfirmation(true);
              setError("");
              setMessage("");
            }}
          >
            Publish Question Set
          </Button>
          {dirty ? (
            <p className="w-full text-sm">
              Save your selection before publishing.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function ExamQuestionSetDialog({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const query = useQuery<LoadedSet>({
    queryKey,
    queryFn: async ({ signal }) => {
      const [draft, bank] = await Promise.all([
        apiClientRequest(endpoint, { signal, cache: "no-store" }),
        apiClientRequest("/exam-engine/admin/questions", {
          signal,
          cache: "no-store",
        }),
      ]);
      return { draft, bank };
    },
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busyRef.current) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>Question Set</DialogTitle>
          <DialogDescription>
            Select questions, save the draft, then publish the content for
            future use.
          </DialogDescription>
        </DialogHeader>
        {query.isLoading || query.isFetching ? (
          <p role="status">Loading Question Set…</p>
        ) : query.isError || !query.data ? (
          <div className="space-y-3">
            <p role="alert">
              Could not load the Question Set. Please try again.
            </p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <QuestionSetForm
            loaded={query.data}
            onBusyChange={(value) => {
              busyRef.current = value;
              setBusy(value);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
