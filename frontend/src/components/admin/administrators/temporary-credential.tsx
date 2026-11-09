"use client";
import { AdminDialogContent as DialogContent } from "@/components/admin/access/admin-dialog";
import { useState } from "react";
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
export interface AdministratorCredential {
  name: string;
  email: string;
  temporaryPassword: string;
}
export function AdministratorCredentialDialog({
  value,
  close,
  returnFocus,
}: {
  value: AdministratorCredential;
  close: () => void;
  returnFocus: () => HTMLElement | null;
}) {
  const [message, setMessage] = useState("");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="sm:max-w-lg" finalFocus={returnFocus}>
        <DialogHeader>
          <DialogTitle>Administrator Created</DialogTitle>
          <DialogDescription>
            The Administrator must change this password on first sign-in. Copy
            it before closing.
          </DialogDescription>
        </DialogHeader>
        <div>
          <p className="font-medium">{value.name}</p>
          <p className="break-all text-sm">{value.email}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="administrator-temporary-password">
            Temporary password
          </Label>
          <Input
            id="administrator-temporary-password"
            readOnly
            autoComplete="off"
            value={value.temporaryPassword}
            onFocus={(event) => event.target.select()}
          />
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(value.temporaryPassword);
                setMessage("Copied.");
              } catch {
                setMessage("Select and copy the temporary password.");
              }
            }}
          >
            Copy
          </Button>
          <p role="status" className="text-sm">
            {message}
          </p>
        </div>
        <DialogFooter>
          <Button onClick={close}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
