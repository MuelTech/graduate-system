import { redirect } from "next/navigation";

/** Compatibility redirect — About content now lives inline on the Home page (`/#about`). */
export default function AboutRedirectPage() {
  redirect("/#about");
}
