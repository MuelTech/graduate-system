import Link from "next/link";
import { User, ArrowLeft } from "lucide-react";

export default function ApplicantProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-2xl font-bold text-[var(--earist-primary)]"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Profile
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          Manage your personal information
        </p>
      </div>

      <div className="rounded-lg border border-[var(--earist-border-gray)] bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--earist-surface-light-red)]">
          <User className="h-8 w-8 text-[var(--earist-primary)]" />
        </div>
        <h3 className="mb-2 text-lg font-bold text-[var(--earist-primary)]">
          Profile Setup & Management
        </h3>
        <p className="mb-4 text-sm text-[var(--earist-body-text)]">
          This page is under construction. Check back soon.
        </p>
        <Link
          href="/applicant/dashboard"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--earist-secondary)] transition-colors hover:text-[var(--earist-primary)]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
