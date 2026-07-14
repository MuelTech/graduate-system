"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle2, RotateCcw } from "lucide-react";

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
  const [signatureMode, setSignatureMode] = useState<"draw" | "type">("draw");
  const [typedSignature, setTypedSignature] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);

  const isSignatureValid =
    signatureMode === "type"
      ? typedSignature.trim().length > 0
      : hasDrawnSignature;

  // 1. Fetch real pending signatures from our new API
  const { data: pendingDocs = [], isLoading } = useQuery({
    queryKey: ["pendingRapReports"],
    queryFn: async () => {
      const res = await apiClientRequest("/thesis/defense/rap-reports/pending");
      return Array.isArray(res) ? res : [];
    },
  });

  // Since we only built a 'pending' endpoint, we will leave 'signed' empty for now
  const signedDocs: unknown[] = [];

  const selectedDocument = pendingDocs.find((d: PendingDoc) => d.id === selectedDoc);

  // 2. Submit Signature Mutation
  const signMutation = useMutation({
    mutationFn: async (base64Image: string) => {
      if (!selectedDoc) throw new Error("No document selected");
      return apiClientRequest(
        `/thesis/defense/rap-reports/${selectedDoc}/sign`,
        {
          method: "POST",
          body: JSON.stringify({ signatureData: base64Image }),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingRapReports"] });
      setSelectedDoc(null);
      setShowConfirm(false);
      clearCanvas();
    },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, [selectedDoc]);

  // --- Drawing Logic ---
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHasDrawnSignature(imageData.data.some((v, i) => i % 4 === 3 && v > 0));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTypedSignature("");
    setHasDrawnSignature(false);
  };

  // --- Submit Logic ---
  const handleSubmitSignature = () => {
    let base64Image = "";

    if (signatureMode === "draw") {
      const canvas = canvasRef.current;
      if (!canvas) return;
      base64Image = canvas.toDataURL("image/png");
    } else {
      // For typed signatures, we create a temporary canvas to generate an image
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = 400;
      tempCanvas.height = 100;
      const ctx = tempCanvas.getContext("2d");
      if (ctx) {
        ctx.font = '40px "Brush Script MT", cursive';
        ctx.fillText(typedSignature, 20, 60);
        base64Image = tempCanvas.toDataURL("image/png");
      }
    }

    signMutation.mutate(base64Image);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          E-Signatures
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Review and sign RAP Reports and other documents digitally
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setActiveTab("pending");
            setSelectedDoc(null);
          }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "pending"
              ? "bg-(--earist-primary) text-white"
              : "bg-(--earist-surface-gray) text-(--earist-body-text) hover:bg-(--earist-border-gray)"
          }`}
        >
          Pending ({pendingDocs.length})
        </button>
        <button
          onClick={() => setActiveTab("signed")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "signed"
              ? "bg-(--earist-primary) text-white"
              : "bg-(--earist-surface-gray) text-(--earist-body-text) hover:bg-(--earist-border-gray)"
          }`}
        >
          Signed ({signedDocs.length})
        </button>
      </div>

      {/* Pending Tab */}
      {activeTab === "pending" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Queue List */}
          <div className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-gray-500 animate-pulse mt-4">
                Loading signature queue...
              </p>
            ) : pendingDocs.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 border rounded-lg bg-gray-50">
                You are all caught up! No pending documents require your
                signature.
              </div>
            ) : (
              pendingDocs.map((doc: PendingDoc) => {
                const rap = doc.rapReport;
                const thesis = rap?.thesis;
                const student = thesis?.student?.user;

                if (!rap || !student) return null;

                return (
                  <button
                    key={doc.id}
                    onClick={() => {
                      setSelectedDoc(doc.id);
                      setShowConfirm(false);
                    }}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      selectedDoc === doc.id
                        ? "border-(--earist-primary) bg-blue-50/50"
                        : "border-(--earist-border-gray) hover:bg-(--earist-surface-gray)"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded bg-amber-50">
                          <FileText className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-(--earist-primary)">
                            RAP Report
                          </p>
                          <p className="text-xs font-semibold text-(--earist-body-text) capitalize">
                            {rap.defenseType.replace("_", " ").toLowerCase()} —{" "}
                            {student.firstName} {student.lastName}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-amber-100 text-amber-700">
                        Awaiting
                      </Badge>
                    </div>
                    <p className="mt-3 text-[11px] text-gray-500">
                      Generated:{" "}
                      {new Date(rap.generatedAt).toLocaleDateString()}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          {/* Document Preview & Signature Pad */}
          {selectedDoc && selectedDocument && (
            <div className="space-y-4">
              {/* Document Preview */}
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
                          "_",
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

              {/* E-Signature Pad */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                      Your Signature
                    </CardTitle>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setSignatureMode("draw")}
                        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                          signatureMode === "draw"
                            ? "bg-(--earist-primary) text-white"
                            : "bg-(--earist-surface-gray) text-(--earist-body-text)"
                        }`}
                      >
                        Draw
                      </button>
                      <button
                        onClick={() => setSignatureMode("type")}
                        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                          signatureMode === "type"
                            ? "bg-(--earist-primary) text-white"
                            : "bg-(--earist-surface-gray) text-(--earist-body-text)"
                        }`}
                      >
                        Type
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {signatureMode === "draw" ? (
                    <div className="space-y-2">
                      <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        className="h-32 w-full cursor-crosshair rounded-lg border border-(--earist-border-gray) bg-white"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={clearCanvas}
                          className="flex items-center gap-1 text-xs text-(--earist-body-text) hover:text-(--earist-primary)"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={typedSignature}
                        onChange={(e) => setTypedSignature(e.target.value)}
                        placeholder="Type your full name..."
                        className="w-full rounded-lg border border-(--earist-border-gray) p-3 text-sm focus:border-(--earist-primary) focus:outline-none focus:ring-1 focus:ring-(--earist-primary)"
                      />
                      <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-(--earist-border-gray) bg-white">
                        <span
                          className="text-3xl text-(--earist-primary)"
                          style={{ fontFamily: '"Brush Script MT", cursive' }}
                        >
                          {typedSignature || "Signature Preview"}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t">
                    {!showConfirm ? (
                      <Button
                        onClick={() => setShowConfirm(true)}
                        disabled={!isSignatureValid}
                        className="w-full bg-(--earist-primary) hover:bg-(--earist-primary)/90 text-white"
                      >
                        Apply Signature
                      </Button>
                    ) : (
                      <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4">
                        <p className="text-xs text-green-800 flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>
                            By confirming, you are securely attaching your
                            timestamped e-signature to this official document.
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
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
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

      {/* Signed Tab */}
      {activeTab === "signed" && (
        <div className="rounded-lg border border-dashed border-(--earist-border-gray) p-12 text-center text-(--earist-body-text)">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500/50" />
          <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
            All Caught Up!
          </h3>
          <p className="text-sm">
            You don&apos;t have any completed signatures yet. (We will implement this
            tab in the future).
          </p>
        </div>
      )}
    </div>
  );
}
