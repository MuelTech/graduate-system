"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    },
  });

  const handleSubmitSignature = () => {
    if (!isSignatureValid) return;
    signMutation.mutate(signatureData);
  };

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          E-Signatures
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Review and sign your pending RAP Report signature slots. Signing is
          limited to your own assigned slot.
        </p>
      </div>

      <div className="flex gap-2 border-b border-(--earist-border-gray)">
        {(["pending", "signed"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "border-b-2 border-(--earist-primary) text-(--earist-primary)"
                : "text-(--earist-body-text) hover:text-(--earist-primary)"
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
              <p className="text-sm text-(--earist-body-text)">Loading…</p>
            ) : pendingDocs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-(--earist-border-gray) p-8 text-center text-(--earist-body-text)">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                <p className="text-sm">No pending RAP signatures.</p>
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
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedDoc === rap.id
                      ? "border-(--earist-primary) bg-(--earist-primary)/5"
                      : "border-(--earist-border-gray) hover:border-(--earist-primary)/50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-(--earist-primary)">
                        {rap.rapReport.thesis.student.user.firstName}{" "}
                        {rap.rapReport.thesis.student.user.lastName}
                      </p>
                      <p className="text-xs text-(--earist-body-text)">
                        {rap.rapReport.defenseType.replace(/_/g, " ")}
                      </p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-800">
                      Signature required
                    </Badge>
                  </div>
                  <p className="mt-2 text-[11px] text-(--earist-body-text)">
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
                  <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                    Document Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex h-48 items-center justify-center rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray)">
                    <div className="text-center">
                      <FileText className="mx-auto mb-2 h-10 w-10 text-(--earist-body-text)/40" />
                      <p className="text-sm text-(--earist-body-text)">
                        RAP Report
                      </p>
                      <p className="text-xs text-(--earist-body-text) capitalize">
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
                  <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                    Your Signature
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ESignaturePad
                    value={signatureData}
                    onChange={setSignatureData}
                  />

                  <div className="mt-4 border-t pt-4">
                    {!showConfirm ? (
                      <Button
                        onClick={() => setShowConfirm(true)}
                        disabled={!isSignatureValid}
                        className="w-full bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                      >
                        Apply Signature
                      </Button>
                    ) : (
                      <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4">
                        <p className="flex items-start gap-2 text-xs text-green-800">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            By confirming, you are securely attaching your
                            timestamped e-signature to this official RAP record.
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
                            className="flex-1 bg-green-600 text-white hover:bg-green-700"
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
        <div className="rounded-lg border border-dashed border-(--earist-border-gray) p-12 text-center text-(--earist-body-text)">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500/50" />
          <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
            Signed history
          </h3>
          <p className="text-sm">
            {signedDocs.length === 0
              ? "No signed RAP slots loaded in this view yet."
              : `${signedDocs.length} signed slot(s).`}
          </p>
        </div>
      )}
    </div>
  );
}
