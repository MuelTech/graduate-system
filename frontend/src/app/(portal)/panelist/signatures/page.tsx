"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClientRequest } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { FileText, CheckCircle2 } from "lucide-react";
import { ESignaturePad } from "@/components/defense-workspace/e-signature-pad";

interface PendingDoc {
  id: string;
  rapReport: {
    defenseType: string;
    generatedAt: string;
    thesis: {
      student: {
        user: {
          firstName: string;
          lastName: string;
        };
      };
    };
  };
}

export default function PanelistSignaturesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"pending" | "signed">("pending");
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const isSignatureValid = signatureData.startsWith("data:image/png;base64,");

  const { data: pendingDocs = [], isLoading } = useQuery({
    queryKey: ["pendingRapReports"],
    queryFn: async () => {
      const res = await apiClientRequest("/thesis/defense/rap-reports/pending");
      return Array.isArray(res) ? res : [];
    },
  });

  const signedDocs: unknown[] = [];
  const selectedDocument = pendingDocs.find(
    (d: PendingDoc) => d.id === selectedDoc,
  );

  const signMutation = useMutation({
    mutationFn: async (pngDataUrl: string) => {
      if (!selectedDoc) throw new Error("No document selected");
      return apiClientRequest(
        `/thesis/defense/rap-reports/${selectedDoc}/sign`,
        {
          method: "POST",
          body: JSON.stringify({ signatureData: pngDataUrl }),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingRapReports"] });
      queryClient.invalidateQueries({ queryKey: ["defenseWorkspace"] });
      setSelectedDoc(null);
      setShowConfirm(false);
      setSignatureData("");
      toast.success("RAP report digitally signed.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to record digital signature.");
    },
  });

  const handleSubmitSignature = () => {
    if (!isSignatureValid) return;
    signMutation.mutate(signatureData);
  };

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title="E-Signatures"
        description="Review and sign your pending Committee Report signatures. Signing is limited to your own assigned slot."
      />

      <div className="flex gap-2 border-b border-gray-200">
        {(["pending", "signed"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "border-b-2 border-[#e02b20] font-semibold text-[#e02b20]"
                : "text-gray-500 hover:text-[#333333]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "pending" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : pendingDocs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-gray-500">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                <p className="text-sm">No pending Committee Report signatures.</p>
              </div>
            ) : (
              pendingDocs.map((rap: PendingDoc) => (
                <button
                  key={rap.id}
                  type="button"
                  onClick={() => {
                    setSelectedDoc(rap.id);
                    setSignatureData("");
                    setShowConfirm(false);
                  }}
                  className={`w-full rounded-xl border bg-white p-4 text-left shadow-xs transition-colors ${
                    selectedDoc === rap.id
                      ? "border-[#e02b20] bg-[#e02b20]/5"
                      : "border-gray-100 hover:border-[#e02b20]/40"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#333333]">
                        {rap.rapReport.thesis.student.user.firstName}{" "}
                        {rap.rapReport.thesis.student.user.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {rap.rapReport.defenseType.replace(/_/g, " ")}
                      </p>
                    </div>
                    <Badge className="bg-amber-50 text-amber-700 border border-amber-200">
                      Signature required
                    </Badge>
                  </div>
                  <p className="mt-2 text-[11px] text-gray-500">
                    Generated:{" "}
                    {new Date(rap.rapReport.generatedAt).toLocaleDateString()}
                  </p>
                </button>
              ))
            )}
          </div>

          {selectedDoc && selectedDocument && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-[#333333]">
                    Document Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex h-48 items-center justify-center rounded-xl border border-gray-100 bg-gray-50/70">
                    <div className="text-center">
                      <FileText className="mx-auto mb-2 h-10 w-10 text-gray-300" />
                      <p className="text-sm font-semibold text-[#333333]">
                        Committee Report
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {selectedDocument.rapReport.defenseType.replace(
                          /_/g,
                          " ",
                        )}{" "}
                        —{" "}
                        {
                          selectedDocument.rapReport.thesis.student.user
                            .firstName
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-[#333333]">
                    Your Signature
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ESignaturePad
                    value={signatureData}
                    onChange={setSignatureData}
                  />

                  <div className="mt-4 border-t border-gray-100 pt-4">
                    {!showConfirm ? (
                      <Button
                        onClick={() => setShowConfirm(true)}
                        disabled={!isSignatureValid}
                        className="w-full bg-[#e02b20] text-white hover:bg-[#c62828]"
                      >
                        Apply Signature
                      </Button>
                    ) : (
                      <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="flex items-start gap-2 text-xs text-emerald-800">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            By confirming, you are securely attaching your
                            timestamped e-signature to this official Committee Report.
                            Double-signing is blocked.
                          </span>
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setShowConfirm(false)}
                            className="flex-1"
                            disabled={signMutation.isPending}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleSubmitSignature}
                            disabled={signMutation.isPending}
                            className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            {signMutation.isPending
                              ? "Signing..."
                              : "Confirm & Sign"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {activeTab === "signed" && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center text-gray-500">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500/50" />
          <h3 className="mb-2 text-lg font-bold text-[#333333]">
            Signed history
          </h3>
          <p className="text-sm">
            {signedDocs.length === 0
              ? "No signed Committee Report slots loaded in this view yet."
              : `${signedDocs.length} signed slot(s).`}
          </p>
        </div>
      )}
    </div>
  );
}
