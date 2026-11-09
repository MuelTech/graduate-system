"use client";
import { AdminDialogContent as DialogContent } from "@/components/admin/access/admin-dialog";
import { useRef, useState } from "react";
import { apiClientRequest } from "@/lib/api.client";
import {
  ADMINISTRATORS_API,
  ADMIN_CAPABILITY_LABELS,
  ADMIN_GRANTABLE_KEYS,
  administratorError,
  capabilityGroup,
  directAdminKeys,
  prerequisiteLabels,
  type AdminCapability,
  type AdministratorAccount,
} from "@/lib/admin-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function AdministratorForm({
  account,
  canManage,
  onClose,
  onSaved,
  onCreated,
}: {
  account?: AdministratorAccount;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onCreated: (value: {
    name: string;
    email: string;
    temporaryPassword: string;
  }) => void;
}) {
  const [level, setLevel] = useState<"FULL" | "RESTRICTED">(
    account?.level ?? "RESTRICTED",
  );
  const [keys, setKeys] = useState<AdminCapability[]>(
    account?.capabilityKeys ?? [],
  );
  const [active, setActive] = useState(account?.isActive ?? true);
  const [identity, setIdentity] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const critical =
    account &&
    ((account.level === "FULL" && level === "RESTRICTED") ||
      (account.isActive && !active));
  async function save() {
    if (!canManage || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const capabilityKeys = directAdminKeys(keys);
      const data = account
        ? { level, capabilityKeys, isActive: active }
        : {
            level,
            capabilityKeys,
            firstName: identity.firstName.trim(),
            lastName: identity.lastName.trim(),
            email: identity.email.trim(),
          };
      // One-time credentials must never enter a React Query mutation/result cache.
      const result = await apiClientRequest(
        account
          ? `${ADMINISTRATORS_API}/${encodeURIComponent(account.id)}`
          : ADMINISTRATORS_API,
        { method: account ? "PATCH" : "POST", body: JSON.stringify(data) },
      );
      let credential: {
        name: string;
        email: string;
        temporaryPassword: string;
      } | null = null;
      if (!account) {
        if (
          typeof result?.temporaryPassword !== "string" ||
          !result.temporaryPassword
        )
          throw new Error("Unavailable credential");
        credential = {
          name: `${identity.firstName.trim()} ${identity.lastName.trim()}`,
          email: identity.email.trim(),
          temporaryPassword: result.temporaryPassword,
        };
      }
      await onSaved();
      onClose();
      // Complete current-access synchronization before opening the only handoff.
      // Two concurrent modal roots would race their focus restoration.
      if (credential) onCreated(credential);
    } catch (failure) {
      setError(administratorError(failure));
      setConfirm(false);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const disabled = busy || !canManage;
  const groups = Array.from(new Set(ADMIN_GRANTABLE_KEYS.map(capabilityGroup)));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>
            {confirm
              ? "Confirm Administrator Change"
              : account
                ? "Edit Administrator Access"
                : "Create Administrator"}
          </DialogTitle>
          <DialogDescription>
            {account
              ? `${account.firstName} ${account.lastName} · ${account.email}`
              : "The new Administrator must change their temporary password on first sign-in."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (critical && !confirm) setConfirm(true);
            else void save();
          }}
        >
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {confirm ? (
            <div className="space-y-3">
              <p>
                Access level:{" "}
                <strong>
                  {level === "FULL"
                    ? "Full Administrator"
                    : "Restricted Administrator"}
                </strong>
              </p>
              <p>
                Account status:{" "}
                <strong>{active ? "Active" : "Inactive"}</strong>
              </p>
              <p>
                {!active
                  ? "Deactivating this account blocks sign-in."
                  : "This account will use only its selected access."}
              </p>
            </div>
          ) : (
            <fieldset disabled={disabled} className="space-y-5">
              {!account && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {(["firstName", "lastName", "email"] as const).map(
                    (field) => (
                      <div className="space-y-2" key={field}>
                        <Label htmlFor={`administrator-${field}`}>
                          {field === "firstName"
                            ? "First name"
                            : field === "lastName"
                              ? "Last name"
                              : "Email"}
                        </Label>
                        <Input
                          id={`administrator-${field}`}
                          type={field === "email" ? "email" : "text"}
                          required
                          maxLength={191}
                          value={identity[field]}
                          onChange={(event) =>
                            setIdentity((previous) => ({
                              ...previous,
                              [field]: event.target.value,
                            }))
                          }
                        />
                      </div>
                    ),
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="administrator-level">Access level</Label>
                <select
                  id="administrator-level"
                  className="w-full rounded-lg border bg-white px-3 py-2"
                  value={level}
                  onChange={(event) =>
                    setLevel(event.target.value as "FULL" | "RESTRICTED")
                  }
                >
                  <option value="RESTRICTED">Restricted Administrator</option>
                  <option value="FULL">Full Administrator</option>
                </select>
              </div>
              {account && (
                <div className="space-y-2">
                  <Label htmlFor="administrator-status">Account status</Label>
                  <select
                    id="administrator-status"
                    className="w-full rounded-lg border bg-white px-3 py-2"
                    value={active ? "active" : "inactive"}
                    onChange={(event) =>
                      setActive(event.target.value === "active")
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}
              {level === "FULL" ? (
                <p className="text-sm text-muted-foreground">
                  Full Administrators have all administrative access.
                </p>
              ) : (
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    Select the work this Administrator can perform. No
                    selections means account access only.
                  </p>
                  {groups.map((group) => (
                    <fieldset
                      key={group}
                      className="space-y-3 rounded-lg border p-4"
                    >
                      <legend className="px-1 font-semibold">{group}</legend>
                      {ADMIN_GRANTABLE_KEYS.filter(
                        (key) => capabilityGroup(key) === group,
                      ).map((key) => (
                        <label key={key} className="flex items-start gap-3">
                          <input
                            className="mt-1 h-4 w-4 accent-(--earist-primary)"
                            type="checkbox"
                            checked={keys.includes(key)}
                            onChange={(event) =>
                              setKeys((previous) =>
                                event.target.checked
                                  ? [...previous, key]
                                  : previous.filter((value) => value !== key),
                              )
                            }
                          />
                          <span>
                            <span className="text-sm">
                              {ADMIN_CAPABILITY_LABELS[key]}
                            </span>
                            {prerequisiteLabels(key).length > 0 && (
                              <span className="block text-xs text-muted-foreground">
                                Includes: {prerequisiteLabels(key).join(", ")}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </div>
              )}
            </fieldset>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => (confirm ? setConfirm(false) : onClose())}
            >
              {confirm ? "Back" : "Cancel"}
            </Button>
            <Button type="submit" disabled={disabled}>
              {busy
                ? "Saving…"
                : confirm
                  ? "Confirm Change"
                  : account
                    ? "Save Access"
                    : "Create Administrator"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
