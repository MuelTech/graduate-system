import { redirect } from "next/navigation";

/** Compatibility redirect — Programs content now lives inline on the Home page (`/#programs`). */
export default function ProgramsRedirectPage() {
  redirect("/#programs");
}
