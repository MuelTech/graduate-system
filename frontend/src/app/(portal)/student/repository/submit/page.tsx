"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  AlertTriangle,
  Database,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";

type EligibilityReason =
  | "FINAL_DEFENSE_NOT_PASSED"
  | "FINAL_RAP_NOT_FINALIZED"
  | "OFFICIAL_TITLE_MISSING"
  | "RESEARCH_CONTEXT_MISSING"
  | "RESEARCH_CONTEXT_AMBIGUOUS"
  | string;

interface DatabankArchiveContext {
  eligible: boolean;
  reasons: EligibilityReason[];
  researchContext: {
    thesisId: string;
    officialTitle: string;
    finalDefenseConcludedAt: string | null;
    finalRapFinalizedAt: string | null;
  } | null;
  archive: {
    id: string;
    officialTitle: string;
    abstract: string | null;
    keywords: string | null;
    registeredAt: string;
  } | null;
  artifactPolicy: { archivalArtifactLinked: boolean; policyResolved: boolean };
}

const REASON_MESSAGES: Record<string, string> = {
  FINAL_DEFENSE_NOT_PASSED:
    "Final Defense is not yet formally PASSED and concluded.",
  FINAL_RAP_NOT_FINALIZED:
    "The Final Defense RAP is not yet FINALIZED (all signatures complete).",
  OFFICIAL_TITLE_MISSING:
    "The official research title is not yet recorded from the Title Defense.",
  RESEARCH_CONTEXT_MISSING:
    "No completed Final Defense research context was found for your account.",
  RESEARCH_CONTEXT_AMBIGUOUS:
    "More than one completed research context was found. Please contact the Graduate School to reconcile your records.",
};

function reasonMessage(reason: string): string {
  return REASON_MESSAGES[reason] ?? "The requirement is not yet satisfied.";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export default function DatabankSubmitPage() {
  const queryClient = useQueryClient();
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["databank-archive-context"],
    queryFn: async () =>
      (await apiClientRequest("/databank/archive/me")) as DatabankArchiveContext,
  });

  const registerMutation = useMutation({
    mutationFn: async () =>
      apiClientRequest("/databank/archive", {
        method: "POST",
        body: JSON.stringify({ abstract, keywords }),
      }),
    onSuccess: () => {
      setAbstract("");
      setKeywords("");
      queryClient.invalidateQueries({ queryKey: ["databank-archive-context"] });
    },
    onError: (error: Error) => {
      alert(error.message || "Databank registration could not be completed.");
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/student/repository"
          className="mb-2 inline-flex items-center text-xs text-(--earist-secondary) hover:underline"
        >
          <ArrowLeft className="mr-1 h-3 w-3" /> Back to Research Repository
        </Link>
        <h2
          className="text-3xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Research Databank Archive
        </h2>
        <p className="mt-2 text-sm text-(--earist-body-text)">
          Register a private archival record for your completed research. This
          registration is a controlled Graduate School archive record and is not
          public by default.
        </p>
      </div>

      {isLoading && (
        <p className="py-8 text-center text-sm text-(--earist-body-text)">
          Loading your Databank archive status…
        </p>
      )}

      {isError && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-red-600">
            Unable to load your Databank archive status. Please try again.
          </CardContent>
        </Card>
      )}

      {data && !data.eligible && (
        <Card className="border-t-4 border-t-amber-400 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-(--earist-secondary)">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Not yet eligible for Databank registration
            </CardTitle>
            <CardDescription>
              Your research must first complete the Final Defense workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-(--earist-body-text)">
              Required completed research context:
            </p>
            <ul className="space-y-1">
              <li className="flex items-start gap-2">
                <Badge variant="outline">Final Defense — PASSED</Badge>
                <span className="text-xs text-(--earist-body-text)">
                  {data.reasons.includes("FINAL_DEFENSE_NOT_PASSED")
                    ? "Not yet recorded."
                    : "Recorded."}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="outline">Final RAP — FINALIZED</Badge>
                <span className="text-xs text-(--earist-body-text)">
                  {data.reasons.includes("FINAL_RAP_NOT_FINALIZED")
                    ? "Not yet finalized."
                    : "Finalized."}
                </span>
              </li>
            </ul>
            <ul className="list-disc space-y-1 pl-5 text-xs text-amber-700">
              {data.reasons.map((reason) => (
                <li key={reason}>{reasonMessage(reason)}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {data && data.eligible && !data.archive && (
        <>
          <Card className="border-t-4 border-t-(--earist-primary) shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-(--earist-secondary)">
                <ShieldCheck className="h-5 w-5" />
                Completed research context
              </CardTitle>
              <CardDescription>
                These values are derived from the official defense records and
                cannot be edited here.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold text-(--earist-secondary)">
                  Official Research Title
                </p>
                <p className="break-words font-medium">
                  {data.researchContext?.officialTitle}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Final Defense — Passed
                </Badge>
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Final RAP — Finalized
                </Badge>
              </div>
              <p className="text-xs text-(--earist-body-text)">
                Final Defense concluded{" "}
                {formatDate(data.researchContext?.finalDefenseConcludedAt ?? null)} ·
                Final RAP finalized{" "}
                {formatDate(data.researchContext?.finalRapFinalizedAt ?? null)}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-(--earist-secondary)">
                <Database className="h-5 w-5" />
                Private archive metadata (optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="abstract"
                  className="text-sm font-semibold text-(--earist-primary)"
                >
                  Abstract
                </Label>
                <Textarea
                  id="abstract"
                  placeholder="Optional archival abstract"
                  className="min-h-32 focus-visible:ring-(--earist-primary)"
                  value={abstract}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setAbstract(e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="keywords"
                  className="text-sm font-semibold text-(--earist-primary)"
                >
                  Keywords (comma-separated)
                </Label>
                <Input
                  id="keywords"
                  placeholder="e.g. Machine Learning, Education"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
              </div>

              <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                The archival manuscript/file submission step is not yet enabled
                because the Graduate School&apos;s authoritative post-Final
                archival-copy policy must be confirmed.
              </div>
              <div className="rounded-lg bg-(--earist-surface-gray) p-3 text-xs text-(--earist-body-text)">
                Respondent/raw research data is not collected through this
                Databank registration.
              </div>

              <Button
                disabled={registerMutation.isPending}
                onClick={() => registerMutation.mutate()}
                className="w-full bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                {registerMutation.isPending
                  ? "Registering…"
                  : "Register Private Databank Archive"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {data && data.eligible && data.archive && (
        <Card className="border-t-4 border-t-green-500 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-(--earist-secondary)">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Databank archive registered
            </CardTitle>
            <CardDescription>
              A private archival registration already exists for your completed
              research.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-semibold text-(--earist-secondary)">
                Official Research Title
              </p>
              <p className="break-words font-medium">
                {data.archive.officialTitle}
              </p>
            </div>
            <p className="text-xs text-(--earist-body-text)">
              Registered at: {formatDate(data.archive.registeredAt)}
            </p>
            {data.archive.abstract && (
              <div>
                <p className="text-xs font-semibold text-(--earist-secondary)">
                  Abstract
                </p>
                <p className="break-words text-(--earist-body-text)">
                  {data.archive.abstract}
                </p>
              </div>
            )}
            {data.archive.keywords && (
              <div>
                <p className="text-xs font-semibold text-(--earist-secondary)">
                  Keywords
                </p>
                <p className="break-words text-(--earist-body-text)">
                  {data.archive.keywords}
                </p>
              </div>
            )}
            <div className="rounded-lg bg-(--earist-surface-gray) p-3 text-xs text-(--earist-body-text)">
              This archival registration does not by itself publish the research
              in the public Repository.
            </div>
            <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
              The archival manuscript/file submission step is not yet enabled
              because the Graduate School&apos;s authoritative post-Final
              archival-copy policy must be confirmed.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
