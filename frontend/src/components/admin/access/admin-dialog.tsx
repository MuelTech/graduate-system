"use client";

import { DialogContent } from "@/components/ui/dialog";
import { useAdminAccess } from "./admin-access-provider";

/** Portals live outside the route's hidden DOM subtree during access refresh. */
export function AdminDialogContent(
  props: React.ComponentProps<typeof DialogContent>,
) {
  const { loading } = useAdminAccess();
  return <DialogContent {...props} hidden={loading || props.hidden} />;
}
