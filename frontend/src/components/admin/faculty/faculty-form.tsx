"use client";
import { AdminDialogContent as DialogContent } from "@/components/admin/access/admin-dialog";

import { useState, type FormEvent } from "react";
import type {
  Faculty,
  FacultyCreateResponse,
  FacultyForm,
} from "@/types/faculty";
import { apiClientRequest } from "@/lib/api.client";
import {
  emptyFacultyForm,
  FACULTY_API,
  facultyError,
  facultyName,
  facultyPayload,
} from "@/lib/faculty-management";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const textFields = [
  ["firstName", "First name", true],
  ["lastName", "Last name", true],
  ["email", "Email", true],
  ["title", "Title (optional)", false],
  ["suffix", "Suffix (optional)", false],
  ["qualification", "Qualification (optional)", false],
  ["affiliation", "Office / affiliation (optional)", false],
  ["specialization", "Specialization (optional)", false],
] as const;

export function FacultyFormDialog({
  faculty,
  canManage,
  onClose,
  onSaved,
  onCreated,
}: {
  faculty?: Faculty;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onCreated: (credential: {
    name: string;
    email: string;
    temporaryPassword: string;
  }) => void;
}) {
  const [form, setForm] = useState<FacultyForm>(() =>
    faculty ? { ...faculty } : { ...emptyFacultyForm },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmStatus, setConfirmStatus] = useState(false);
  const formDisabled = busy || !canManage || confirmStatus;
  function change<K extends keyof FacultyForm>(key: K, value: FacultyForm[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function save() {
    if (!canManage || busy) return;
    setBusy(true);
    setError("");
    try {
      // Deliberately not useMutation: the one-time credential must never enter a mutation cache.
      const response = await apiClientRequest(
        faculty
          ? `${FACULTY_API}/${encodeURIComponent(faculty.id)}`
          : FACULTY_API,
        {
          method: faculty ? "PUT" : "POST",
          body: JSON.stringify(facultyPayload(form)),
        },
      );
      if (!faculty) {
        const created = response as FacultyCreateResponse;
        onCreated({
          name: facultyName(created.account.user),
          email: created.account.user.email,
          temporaryPassword: created.temporaryPassword,
        });
      }
      await onSaved();
      onClose();
    } catch (failure) {
      setError(facultyError(failure));
    } finally {
      setBusy(false);
      setConfirmStatus(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (faculty && faculty.isActive !== form.isActive) setConfirmStatus(true);
    else void save();
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>
            {faculty ? "Edit Faculty" : "Create Faculty"}
          </DialogTitle>
          <DialogDescription>
            {faculty
              ? facultyName(faculty)
              : "Create a Faculty account and configure its access."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-6">
          <fieldset disabled={formDisabled} className="space-y-6">
            <legend className="mb-4 font-semibold">Faculty Profile</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {textFields.map(([key, label, required]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`faculty-${key}`}>{label}</Label>
                  <Input
                    id={`faculty-${key}`}
                    type={key === "email" ? "email" : "text"}
                    required={required}
                    maxLength={191}
                    value={form[key]}
                    onChange={(event) => change(key, event.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="faculty-classification">Classification</Label>
              <select
                id="faculty-classification"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                value={form.isExternal ? "external" : "internal"}
                onChange={(event) => {
                  const isExternal = event.target.value === "external";
                  setForm((previous) => ({
                    ...previous,
                    isExternal,
                    isAvailableAsAdviser: isExternal
                      ? false
                      : previous.isAvailableAsAdviser,
                  }));
                }}
              >
                <option value="internal">Internal</option>
                <option value="external">External</option>
              </select>
            </div>
            <section className="space-y-3">
              <h3 className="font-semibold">Account Status</h3>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="faculty-active">
                  {form.isActive ? "Active" : "Inactive"}
                </Label>
                <Switch
                  id="faculty-active"
                  disabled={formDisabled}
                  checked={form.isActive}
                  onCheckedChange={(value) => change("isActive", value)}
                />
              </div>
            </section>
            <section className="space-y-3">
              <h3 className="font-semibold">Faculty Access</h3>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="faculty-essay">Essay Evaluation</Label>
                <Switch
                  id="faculty-essay"
                  disabled={formDisabled}
                  checked={form.essayEvaluation}
                  onCheckedChange={(value) => change("essayEvaluation", value)}
                />
              </div>
            </section>
            <section className="space-y-3">
              <h3 className="font-semibold">Adviser Availability</h3>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="faculty-adviser">Available as Adviser</Label>
                <Switch
                  id="faculty-adviser"
                  aria-describedby="faculty-adviser-help"
                  disabled={form.isExternal || formDisabled}
                  checked={!form.isExternal && form.isAvailableAsAdviser}
                  onCheckedChange={(value) =>
                    change("isAvailableAsAdviser", value)
                  }
                />
              </div>
              <p
                id="faculty-adviser-help"
                className="text-sm text-muted-foreground"
              >
                {form.isExternal
                  ? "Not applicable to External Faculty."
                  : "Applies to new assignments. Current and historical Adviser relationships are retained."}
              </p>
            </section>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {!canManage && (
            <p role="alert">
              Faculty editing is currently unavailable. Close this form and
              refresh the list.
            </p>
          )}
          {confirmStatus && (
            <div
              role="group"
              aria-labelledby="faculty-status-confirm"
              className="space-y-3 rounded-lg border p-4"
            >
              <p id="faculty-status-confirm" className="font-medium">
                {form.isActive
                  ? "Activate this account?"
                  : "Deactivate this account?"}
              </p>
              <p className="text-sm text-muted-foreground">
                {form.isActive
                  ? "The Faculty member will be able to sign in."
                  : "The Faculty member will be unable to sign in. Records and assignments are retained."}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setConfirmStatus(false)}
                >
                  Back to form
                </Button>
                <Button
                  type="button"
                  disabled={busy || !canManage}
                  onClick={() => void save()}
                >
                  {busy ? "Saving…" : "Confirm and Save"}
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || !canManage || confirmStatus}
            >
              {busy ? "Saving…" : faculty ? "Save Changes" : "Create Faculty"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
