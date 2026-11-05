"use client";

import { useCallback, useEffect, useId, useState } from "react";
import type {
  AdminQuestion,
  ExamQuestionType,
  ExamStimulusType,
} from "@/types";
import { ApiError, apiClientRequest } from "@/lib/api.client";
import {
  buildQuestionPayload,
  buildQuestionSavePayload,
  newOption,
  optionLabel,
  questionDraft,
  selectCorrectOption,
  type OptionDraft,
} from "@/lib/exam-content";
import { Button } from "@/components/ui/button";
import { ExamImageUpload } from "./exam-image-upload";
import { StructuredStimulusEditor } from "./structured-stimulus-editor";
import { StimulusRenderer } from "./stimulus-renderer";
import { SemanticText } from "./semantic-text";
import { SemanticTextEditor } from "./semantic-text-editor";
import { OptionContentRenderer } from "./option-content-renderer";

const inputClass =
  "mt-1 block w-full rounded-md border border-gray-300 bg-white p-2 text-sm";

export function AdminQuestionEditor({
  question,
  defaultOrder,
  onSaved,
  onCancel,
  onBusyChange,
}: {
  question: AdminQuestion | null;
  defaultOrder: number;
  onSaved: () => void;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [draft, setDraft] = useState(() =>
    questionDraft(question, defaultOrder),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const radioName = useId();
  const busy = saving || pendingUploads > 0;
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  const uploadBusy = useCallback(
    (pending: boolean) =>
      setPendingUploads((count) => Math.max(0, count + (pending ? 1 : -1))),
    [],
  );
  const updateOption = (key: string, patch: Partial<OptionDraft>) =>
    setDraft((current) => ({
      ...current,
      options: current.options.map((option) =>
        option.key === key ? { ...option, ...patch } : option,
      ),
    }));
  let preview: ReturnType<typeof buildQuestionPayload> | null = null;
  if (showPreview) {
    try {
      preview = buildQuestionPayload(draft);
    } catch {
      /* Invalid edits withhold the live preview. */
    }
  }

  function buildPreview() {
    try {
      buildQuestionPayload(draft);
      setShowPreview(true);
      setError("");
    } catch (error) {
      setShowPreview(false);
      setError(
        error instanceof Error ? error.message : "Check question content.",
      );
    }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    let payload: ReturnType<typeof buildQuestionSavePayload>;
    try {
      payload = buildQuestionSavePayload(draft, question);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Check question content.",
      );
      return;
    }
    setSaving(true);
    try {
      await apiClientRequest(
        question
          ? `/exam-engine/admin/questions/${question.id}`
          : "/exam-engine/admin/questions",
        { method: question ? "PUT" : "POST", body: JSON.stringify(payload) },
      );
      onSaved();
    } catch (error) {
      setError(
        error instanceof ApiError && error.statusCode === 409
            ? "Saved answers or a published question set use these options. Keep their existing identities; removing referenced options is not allowed."
          : error instanceof ApiError && error.statusCode === 400
            ? "The question was rejected. Check its text, stimulus, labels, orders and correct answer."
            : "Could not save the question. Check your session and try again.",
      );
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      {error && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      <fieldset disabled={busy} className="space-y-5 disabled:opacity-70">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Response type
            <select
              className={inputClass}
              value={draft.type}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  type: event.target.value as ExamQuestionType,
                }))
              }
            >
              <option value="MULTIPLE_CHOICE">Multiple choice</option>
              <option value="ESSAY">Essay</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Display order
            <input
              type="number"
              min={0}
              max={2147483647}
              step={1}
              required
              className={inputClass}
              value={draft.order}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  order: Number(event.target.value),
                }))
              }
            />
          </label>
        </div>
        <SemanticTextEditor
          label="Question text / instructions"
          text={draft.questionText}
          emphasis={draft.questionTextEmphasis}
          maxLength={20000}
          rows={4}
          onChange={(questionText, questionTextEmphasis) =>
            setDraft((current) => ({
              ...current,
              questionText,
              questionTextEmphasis,
            }))
          }
        />
        <label className="block text-sm font-medium">
          Stimulus
          <select
            className={inputClass}
            value={draft.stimulusType}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                stimulusType: event.target.value as ExamStimulusType,
                structuredStimulusEmphasis: null,
              }))
            }
          >
            <option value="NONE">None</option>
            <option value="IMAGE">Image</option>
            <option value="STRUCTURED">Structured content</option>
          </select>
        </label>
        {draft.stimulusType === "IMAGE" && (
          <ExamImageUpload
            mediaId={draft.stimulusMediaId}
            label="Stimulus image"
            onBusyChange={uploadBusy}
            onChange={(stimulusMediaId) =>
              setDraft((current) => ({ ...current, stimulusMediaId }))
            }
          />
        )}
        {draft.stimulusType === "STRUCTURED" && (
          <StructuredStimulusEditor
            value={draft.structured}
            emphasis={draft.structuredStimulusEmphasis}
            onChange={(structured, structuredStimulusEmphasis) =>
              setDraft((current) => ({
                ...current,
                structured,
                structuredStimulusEmphasis,
              }))
            }
          />
        )}
        {draft.type === "MULTIPLE_CHOICE" && (
          <fieldset className="space-y-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-semibold">
              Answer options
            </legend>
            <p className="text-xs text-gray-600">
              Select exactly one correct answer. Use a unique order for each
              option. Labels may all be left blank.
            </p>
            {draft.options.map((option) => (
              <div
                key={option.key}
                className="space-y-3 rounded-lg border bg-gray-50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="radio"
                      name={radioName}
                      checked={option.isCorrect}
                      onChange={() =>
                        setDraft((current) => ({
                          ...current,
                          options: selectCorrectOption(
                            current.options,
                            option.key,
                          ),
                        }))
                      }
                    />
                    {optionLabel(option)} — correct answer
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={draft.options.length <= 2}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        options: current.options.filter(
                          (item) => item.key !== option.key,
                        ),
                      }))
                    }
                    aria-label={`Remove ${optionLabel(option)}`}
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-xs font-medium">
                    Label
                    <input
                      maxLength={8}
                      className={inputClass}
                      value={option.label ?? ""}
                      onChange={(event) =>
                        updateOption(option.key, {
                          label: event.target.value || null,
                        })
                      }
                    />
                  </label>
                  <label className="text-xs font-medium">
                    Order
                    <input
                      type="number"
                      min={0}
                      max={2147483647}
                      step={1}
                      required
                      className={inputClass}
                      value={option.order}
                      onChange={(event) =>
                        updateOption(option.key, {
                          order: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="text-xs font-medium">
                    Content
                    <select
                      className={inputClass}
                      value={option.optionText === null ? "IMAGE" : "TEXT"}
                      onChange={(event) =>
                        updateOption(
                          option.key,
                          event.target.value === "IMAGE"
                            ? {
                                optionText: null,
                                optionTextEmphasis: null,
                                mediaId: null,
                              }
                            : {
                                optionText: "",
                                optionTextEmphasis: null,
                                mediaId: null,
                              },
                        )
                      }
                    >
                      <option value="TEXT">Text</option>
                      <option value="IMAGE">Image</option>
                    </select>
                  </label>
                </div>
                {option.optionText === null ? (
                  <ExamImageUpload
                    mediaId={option.mediaId}
                    label={`${optionLabel(option)} image`}
                    onBusyChange={uploadBusy}
                    onChange={(mediaId) =>
                      updateOption(option.key, { mediaId })
                    }
                  />
                ) : (
                  <SemanticTextEditor
                    label={`${optionLabel(option)} option text`}
                    text={option.optionText}
                    emphasis={option.optionTextEmphasis}
                    maxLength={10000}
                    rows={2}
                    onChange={(optionText, optionTextEmphasis) =>
                      updateOption(option.key, {
                        optionText,
                        optionTextEmphasis,
                      })
                    }
                  />
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={draft.options.length >= 26}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  options: [
                    ...current.options,
                    newOption(
                      Math.max(
                        -1,
                        ...current.options.map((option) => option.order),
                      ) + 1,
                    ),
                  ],
                }))
              }
            >
              Add option
            </Button>
          </fieldset>
        )}
        <Button type="button" variant="outline" onClick={buildPreview}>
          Preview current content
        </Button>
      </fieldset>
      {preview && (
        <section
          aria-label="Question preview"
          className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4"
        >
          <p className="whitespace-pre-wrap font-medium">
            <SemanticText
              text={preview.questionText}
              emphasis={preview.questionTextEmphasis}
            />
          </p>
          <StimulusRenderer
            stimulusType={preview.stimulusType}
            stimulusMediaId={preview.stimulusMediaId}
            structuredStimulus={preview.structuredStimulus}
            structuredStimulusEmphasis={preview.structuredStimulusEmphasis}
          />
          {preview.options
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((option) => (
              <div
                key={option.id ?? option.order}
                className="space-y-1 rounded border bg-white p-3"
              >
                <p className="text-sm font-semibold">
                  {optionLabel(option)}
                  {option.isCorrect ? " · Correct" : ""}
                </p>
                <OptionContentRenderer
                  optionText={option.optionText}
                  optionTextEmphasis={option.optionTextEmphasis}
                  mediaId={option.mediaId}
                  alt={`${optionLabel(option)} image`}
                />
              </div>
            ))}
        </section>
      )}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={busy}
          className="bg-(--earist-primary) text-white"
        >
          {saving ? "Saving…" : pendingUploads ? "Uploading…" : "Save question"}
        </Button>
      </div>
    </form>
  );
}
