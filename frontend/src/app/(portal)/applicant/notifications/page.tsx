import Link from "next/link";
import { Bell, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export default function ApplicantNotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="View your notifications and alerts"
      />

      <div className="rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#e02b20]/10">
          <Bell className="h-8 w-8 text-[#e02b20]" />
        </div>
        <h3 className="mb-2 text-lg font-bold text-[#333333]">
          Notifications Center
        </h3>
        <p className="mb-4 text-sm text-gray-500">
          This page is under construction. Check back soon.
        </p>
        <Link
          href="/applicant/dashboard"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#e02b20] transition-colors hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
