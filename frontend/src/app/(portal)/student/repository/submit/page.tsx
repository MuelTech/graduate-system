"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Send, FileText, Database, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";

export default function DatabankSubmitPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState("");
  
  const [fullPaper, setFullPaper] = useState<File | null>(null);
  const [respondentData, setRespondentData] = useState<File | null>(null);

  const submitMutation = useMutation({
    mutationFn: async () => {
      // In a real implementation, files would be sent via FormData or uploaded to a bucket first.
      // We simulate the paths being passed to our backend since we expect JSON currently.
      const payload = {
        thesisId: "mock-thesis-id-123", // In a real flow, this is fetched from the student's active journey
        title,
        abstract,
        keywords,
        fullPaperPath: fullPaper ? `/uploads/databank/${fullPaper.name}` : undefined,
        respondentDataPath: respondentData ? `/uploads/databank/${respondentData.name}` : undefined,
      };

      return await apiClientRequest("/databank", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      alert("Successfully submitted to the Research Databank! Waiting for Admin approval.");
      queryClient.invalidateQueries({ queryKey: ["databank"] });
      // Reset form
      setTitle(""); setAbstract(""); setKeywords(""); setFullPaper(null); setRespondentData(null);
    },
    onError: (error: Error) => {
      alert("Submission failed: " + error.message);
    },
  });

  const isFormComplete = title && abstract && keywords && fullPaper && respondentData;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-(--earist-primary)" style={{ fontFamily: '"Calibri", sans-serif' }}>
          Research Databank Submission
        </h2>
        <p className="mt-2 text-sm text-(--earist-body-text)">
          Digitally archive your approved final manuscript, research instruments, and respondent data. 
          Once approved by the Administrator, your work will be published in the EARIST Research Repository.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {/* Metadata Card */}
          <Card className="border-t-4 border-t-(--earist-primary) shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-(--earist-secondary)">
                <FileText className="h-5 w-5" />
                Manuscript Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-semibold text-(--earist-primary)">Research Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Machine Learning Approaches for Early Detection..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="focus-visible:ring-(--earist-primary)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="abstract" className="text-sm font-semibold text-(--earist-primary)">Abstract</Label>
                <Textarea
                  id="abstract"
                  placeholder="Paste your approved abstract here..."
                  className="min-h-37.5 focus-visible:ring-(--earist-primary)"
                  value={abstract}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAbstract(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="keywords" className="text-sm font-semibold text-(--earist-primary)">Keywords (Comma-separated)</Label>
                <Input
                  id="keywords"
                  placeholder="e.g. Machine Learning, Education, Retention"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="focus-visible:ring-(--earist-primary)"
                />
              </div>
            </CardContent>
          </Card>

          {/* Uploads Card */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-(--earist-secondary)">
                <Database className="h-5 w-5" />
                Required Files
              </CardTitle>
              <CardDescription>
                Upload your clean, final PDF manuscript and your anonymized respondent data/instruments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Full Paper */}
              <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray)/50 p-4 transition-colors hover:bg-(--earist-surface-gray)">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-(--earist-primary)">Final Manuscript (Chapters 1-5)</h4>
                    <p className="text-xs text-(--earist-body-text) mt-1">{fullPaper ? fullPaper.name : "No file selected (PDF only)"}</p>
                  </div>
                  <div>
                    <label className="cursor-pointer">
                      <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFullPaper(e.target.files?.[0] || null)} />
                      <Badge className={fullPaper ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-(--earist-primary) hover:bg-(--earist-primary)/90 cursor-pointer"}>
                        {fullPaper ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <Upload className="mr-1 h-3 w-3" />}
                        {fullPaper ? "Uploaded" : "Upload File"}
                      </Badge>
                    </label>
                  </div>
                </div>
              </div>

              {/* Respondent Data */}
              <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray)/50 p-4 transition-colors hover:bg-(--earist-surface-gray)">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-(--earist-primary)">Respondent Data & Instruments</h4>
                    <p className="text-xs text-(--earist-body-text) mt-1">{respondentData ? respondentData.name : "No file selected (.zip, .pdf, .xlsx)"}</p>
                  </div>
                  <div>
                    <label className="cursor-pointer">
                      <input type="file" accept=".pdf,.zip,.xlsx,.csv" className="hidden" onChange={(e) => setRespondentData(e.target.files?.[0] || null)} />
                      <Badge className={respondentData ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-(--earist-primary) hover:bg-(--earist-primary)/90 cursor-pointer"}>
                        {respondentData ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <Upload className="mr-1 h-3 w-3" />}
                        {respondentData ? "Uploaded" : "Upload File"}
                      </Badge>
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Status */}
        <div className="space-y-6">
          <Card className="sticky top-6 shadow-sm bg-linear-to-br from-white to-gray-50 border-gray-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-(--earist-primary)">Submission Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-blue-50 p-3 flex items-start gap-3 border border-blue-100">
                <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-800 leading-relaxed">
                  Submitting to the Databank permanently replaces physical warehouse archiving. Ensure all files are final and complete.
                </p>
              </div>

              <div className="space-y-2 pt-4 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Metadata complete</span>
                  {title && abstract && keywords ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <span className="text-gray-400">—</span>}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Files uploaded</span>
                  {fullPaper && respondentData ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <span className="text-gray-400">—</span>}
                </div>
              </div>

              <Button
                disabled={!isFormComplete || submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
                className={`w-full mt-4 h-12 text-sm font-bold shadow-md transition-all ${
                  isFormComplete
                    ? "bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90 hover:shadow-lg"
                    : "cursor-not-allowed bg-gray-200 text-gray-400"
                }`}
              >
                <Send className="mr-2 h-4 w-4" />
                {submitMutation.isPending ? "Submitting..." : "Submit to Databank"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
