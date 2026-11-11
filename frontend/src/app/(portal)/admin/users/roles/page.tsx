import { redirect } from "next/navigation";

export default function RetiredCustomRolesRedirectPage() {
  redirect("/admin/users/administrators");
}
