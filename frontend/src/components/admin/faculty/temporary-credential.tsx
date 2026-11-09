"use client";
import { AdminDialogContent as DialogContent } from "@/components/admin/access/admin-dialog";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface TemporaryCredential {
  name: string;
  email: string;
  temporaryPassword: string;
}

/** Parent mounts this only for a successful create and clears its local state on every close. */
export function TemporaryCredentialDialog({
  credential,
  onClose,
  returnFocus,
}: {
  credential: TemporaryCredential;
  onClose: () => void;
  returnFocus: () => HTMLElement | null;
}) {
  const [copyState, setCopyState] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(credential.temporaryPassword);
      setCopyState("Copied.");
    } catch {
      setCopyState(
        "Copy is unavailable. Select and copy the temporary password.",
      );
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg" finalFocus={returnFocus}>
        <DialogHeader>
          <DialogTitle>Faculty Created</DialogTitle>
          <DialogDescription>
            The Faculty member must change this password on first sign-in. Copy
            it before closing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <p className="font-medium">{credential.name}</p>
          <p className="break-all text-muted-foreground">{credential.email}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="faculty-temporary-password">Temporary password</Label>
          <Input
            id="faculty-temporary-password"
            readOnly
            autoComplete="off"
            value={credential.temporaryPassword}
            onFocus={(event) => event.target.select()}
          />
          <Button variant="outline" onClick={() => void copy()}>
            Copy
          </Button>
          <p role="status" className="text-sm text-muted-foreground">
            {copyState}
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
