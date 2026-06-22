"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Clock,
  CheckCircle2,
  PenTool,
  Download,
  X,
  Trash2,
  RotateCcw,
} from "lucide-react";

export default function PanelistSignaturesPage() {
  const [activeTab, setActiveTab] = useState<"pending" | "signed">("pending");
  const [selectedDoc, setSelectedDoc] = useState<number | null>(null);
  const [signatureMode, setSignatureMode] = useState<"draw" | "type">("draw");
  const [typedSignature, setTypedSignature] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const isSignatureValid = signatureMode === "type" ? typedSignature.trim().length > 0 : hasDrawnSignature;

  const pendingDocs = [
    {
      id: 1,
      type: "RAP Report",
      stage: "Title Defense",
      researcher: "Carlos Luna",
      generatedDate: "May 30, 2026",
      status: "awaiting" as "awaiting" | "urgent",
    },
    {
      id: 2,
      type: "RAP Report",
      stage: "Proposal Defense",
      researcher: "Elena Torres",
      generatedDate: "May 22, 2026",
      status: "urgent" as "awaiting" | "urgent",
    },
  ];

  const signedDocs = [
    {
      id: 101,
      type: "RAP Report",
      stage: "Final Defense",
      researcher: "Maria Santos",
      signedDate: "May 15, 2026",
      timestamp: "May 15, 2026 at 2:45 PM",
    },
    {
      id: 102,
      type: "RAP Report",
      stage: "Title Defense",
      researcher: "Juan Dela Cruz",
      signedDate: "May 10, 2026",
      timestamp: "May 10, 2026 at 10:30 AM",
    },
  ];

  const selectedDocument = pendingDocs.find((d) => d.id === selectedDoc);

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

  return (
    <div className="space-y-4">
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
            {pendingDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => setSelectedDoc(doc.id)}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  selectedDoc === doc.id
                    ? "border-(--earist-primary) bg-(--earist-surface-light-red)"
                    : "border-(--earist-border-gray) hover:bg-(--earist-surface-gray)"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded ${
                        doc.status === "urgent" ? "bg-red-50" : "bg-amber-50"
                      }`}
                    >
                      <FileText
                        className={`h-4 w-4 ${
                          doc.status === "urgent"
                            ? "text-red-600"
                            : "text-amber-600"
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-(--earist-primary)">
                        {doc.type}
                      </p>
                      <p className="text-xs text-(--earist-body-text)">
                        {doc.stage} — {doc.researcher}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={
                      doc.status === "urgent"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }
                  >
                    {doc.status === "urgent" ? "Urgent" : "Awaiting"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-(--earist-body-text)">
                  Generated: {doc.generatedDate}
                </p>
              </button>
            ))}
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
                        {selectedDocument.type}
                      </p>
                      <p className="text-xs text-(--earist-body-text)">
                        {selectedDocument.stage} — {selectedDocument.researcher}
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
                        placeholder="Type your full name"
                        className="font-script w-full rounded-lg border border-(--earist-border-gray) p-3 text-center text-lg text-(--earist-primary) focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                        style={{ fontFamily: "cursive" }}
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={() => setTypedSignature("")}
                          className="flex items-center gap-1 text-xs text-(--earist-body-text) hover:text-(--earist-primary)"
                        >
                          <Trash2 className="h-3 w-3" />
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Timestamp */}
              <div className="flex items-start gap-2 rounded-lg bg-(--earist-surface-gray) p-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-(--earist-body-text)" />
                <p className="text-xs text-(--earist-body-text)">
                  Your signature will be recorded with timestamp:{" "}
                  <span className="font-medium">
                    {new Date().toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}{" "}
                    at{" "}
                    {new Date().toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </p>
              </div>

              {/* Sign Button */}
              <Button
                disabled={!isSignatureValid}
                onClick={() => setShowConfirm(true)}
                className={`w-full py-6 text-base font-semibold ${
                  isSignatureValid
                    ? "bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                    : "cursor-not-allowed bg-gray-200 text-gray-400"
                }`}
              >
                <PenTool className="mr-2 h-5 w-5" />
                Confirm & Sign Document
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Signed Tab */}
      {activeTab === "signed" && (
        <div className="space-y-2">
          {signedDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-lg border border-(--earist-border-gray) p-4"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-(--earist-primary)">
                  {doc.type}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {doc.stage} — {doc.researcher}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  Signed: {doc.timestamp}
                </p>
              </div>
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Signed
              </Badge>
              <a
                href="#"
                className="flex items-center gap-1 rounded-lg border border-(--earist-border-gray) px-3 py-1.5 text-xs font-semibold text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <Download className="h-3 w-3" />
                Copy
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && selectedDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Confirm Signature
              </h3>
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 space-y-2">
              <p className="text-sm text-(--earist-body-text)">
                You are about to sign:
              </p>
              <div className="rounded-lg bg-(--earist-surface-gray) p-3">
                <p className="text-sm font-semibold text-(--earist-primary)">
                  {selectedDocument.type}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {selectedDocument.stage} — {selectedDocument.researcher}
                </p>
              </div>
              <p className="text-xs font-medium text-red-600">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowConfirm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                Sign Document
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
