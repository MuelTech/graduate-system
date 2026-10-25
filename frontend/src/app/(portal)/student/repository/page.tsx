"use client";

import Link from "next/link";
import { Upload, CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { RepositoryBrowser } from "@/components/repository/repository-browser";

export default function StudentRepositoryPage() {
  const { data: databankData } = useQuery({
    queryKey: ["databank-archive-context"],
    queryFn: async () =>
      apiClientRequest("/databank/archive/me").catch(() => null),
  });

  return (
    <div className="space-y-4">
      {databankData?.archive && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-900">
                Research Databank Archive Registered
              </p>
              <p className="text-xs text-green-700">
                Your post-defense archival package is securely stored in the private Graduate School databank.
              </p>
            </div>
          </div>
          <Link href="/student/repository/submit">
            <Button size="sm" variant="outline" className="text-xs border-green-300 text-green-800 hover:bg-green-100">
              View My Archive
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {databankData?.eligible && !databankData.archive && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Action Required: Research Databank Archival Submission
              </p>
              <p className="text-xs text-amber-700">
                You have passed your Final Defense. Submit your final corrected manuscript and research artifacts.
              </p>
            </div>
          </div>
          <Link href="/student/repository/submit">
            <Button size="sm" className="bg-(--earist-primary) text-white text-xs hover:bg-(--earist-primary)/90">
              Submit Databank Archive
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}

      <RepositoryBrowser
        title="Research Repository"
        description="Browse the institutional research repository and explore approved graduate school publications."
        headerAction={
          <Link href="/student/repository/submit">
            <Button className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90">
              <Upload className="mr-2 h-4 w-4" />
              Databank Archive
            </Button>
          </Link>
        }
      />
    </div>
  );
}
