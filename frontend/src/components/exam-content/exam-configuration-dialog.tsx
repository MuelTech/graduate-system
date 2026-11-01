"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiClientRequest } from "@/lib/api.client";
import {
  CONFIGURATION_FIELDS,
  configurationDraft,
  configurationPayload,
  type ExamConfiguration,
} from "@/lib/exam-configuration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const endpoint = "/exam-engine/admin/configuration";
const queryKey = ["adminExamConfiguration"];

function ConfigurationForm({
  configuration,
  onBusyChange,
}: {
  configuration: ExamConfiguration;
  onBusyChange: (busy: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => configurationDraft(configuration));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const saving = useRef(false);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (
      payload: ReturnType<typeof configurationPayload>,
    ): Promise<ExamConfiguration> =>
      apiClientRequest(endpoint, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
  });

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    setError("");
    setSaved(false);
    let payload: ReturnType<typeof configurationPayload>;
    try {
      payload = configurationPayload(draft);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Check the configuration values.",
      );
      return;
    }
    saving.current = true;
    onBusyChange(true);
    try {
      const current = await mutation.mutateAsync(payload);
      // Reconcile from the server's persisted response, not the submitted draft.
      setDraft(configurationDraft(current));
      queryClient.setQueryData(queryKey, current);
      setSaved(true);
    } catch (error) {
      setError(
        error instanceof ApiError && error.statusCode === 400
          ? error.message
          : "Could not save exam configuration. Your edits are still here; please try again.",
      );
    } finally {
      saving.current = false;
      onBusyChange(false);
    }
  }

  return (
    <form
      onSubmit={save}
      noValidate
      className="space-y-4"
      aria-busy={mutation.isPending}
    >
      <p
        id="configuration-draft-help"
        className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3 text-sm text-(--earist-body-text)"
      >
        Draft configuration. These settings do not change current examination
        timing or grading yet. Leave unresolved values blank.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-(--earist-success)">
          Draft configuration saved.
        </p>
      ) : null}
      <fieldset
        disabled={mutation.isPending}
        aria-describedby="configuration-draft-help"
        className="grid gap-4 disabled:opacity-70 sm:grid-cols-2"
      >
        {CONFIGURATION_FIELDS.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={`configuration-${field.key}`}>
              {field.label} ({field.unit})
            </Label>
            <Input
              id={`configuration-${field.key}`}
              type="number"
              min="0"
              step={field.integer ? "1" : "any"}
              value={draft[field.key]}
              placeholder="Unconfigured"
              onChange={(event) => {
                setDraft({ ...draft, [field.key]: event.target.value });
                setSaved(false);
              }}
            />
          </div>
        ))}
        <div className="space-y-2">
          <Label htmlFor="configuration-threshold">Passing Threshold</Label>
          <Input
            id="configuration-threshold"
            value=""
            disabled
            placeholder="Unconfigured"
            aria-describedby="configuration-threshold-help"
          />
          <p
            id="configuration-threshold-help"
            className="text-sm text-(--earist-body-text)"
          >
            The threshold unit and value require policy confirmation.
          </p>
        </div>
      </fieldset>
      <dl className="space-y-1 text-sm">
        <dt className="font-medium">Institutional Timezone</dt>
        <dd>
          {configuration.timezone}{" "}
          <span className="text-(--earist-body-text)">
            — system-defined, read-only
          </span>
        </dd>
      </dl>
      <div className="flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save draft"}
        </Button>
      </div>
    </form>
  );
}

export function ExamConfigurationDialog({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const query = useQuery<ExamConfiguration>({
    queryKey,
    queryFn: ({ signal }) =>
      apiClientRequest(endpoint, { signal, cache: "no-store" }),
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>Exam Configuration</DialogTitle>
          <DialogDescription>
            Prepare the current entrance examination settings. Unresolved policy
            values remain unconfigured.
          </DialogDescription>
        </DialogHeader>
        {query.isLoading || query.isFetching ? (
          <p role="status">Loading exam configuration…</p>
        ) : query.isError || !query.data ? (
          <div className="space-y-3">
            <p role="alert">
              Could not load exam configuration. Please try again.
            </p>
            <Button
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {query.isFetching ? "Retrying…" : "Retry"}
            </Button>
          </div>
        ) : (
          <ConfigurationForm
            configuration={query.data}
            onBusyChange={setBusy}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
