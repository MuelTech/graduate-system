"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Megaphone, Plus, Send, Clock, Users, X } from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";

export default function AdminMemosPage() {
  const queryClient = useQueryClient();
  const [isComposing, setIsComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState("ALL");
  const [programId, setProgramId] = useState("");

  const { data: memos = [], isLoading } = useQuery({
    queryKey: ["admin-memos"],
    queryFn: async () => await apiClientRequest("/memos"),
  });

  const { data: programs = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: async () => {
        const res = await apiClientRequest("/programs");
        return res.graduatePrograms || [];
    },
  });

  const publishMemo = useMutation({
    mutationFn: async () => {
      return apiClientRequest("/memos", {
        method: "POST",
        body: JSON.stringify({
          title,
          content,
          targetAudience: audience,
          programId: audience === "PROGRAM" ? programId : undefined
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-memos"] });
      setIsComposing(false);
      setTitle("");
      setContent("");
      setAudience("ALL");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-(--earist-primary)" style={{ fontFamily: '"Calibri", sans-serif' }}>
            Announcements & Memos
          </h2>
          <p className="text-sm text-(--earist-body-text)">
            Broadcast memos and announcements via portal and email.
          </p>
        </div>
        {!isComposing && (
          <Button onClick={() => setIsComposing(true)} className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90">
            <Plus className="mr-2 h-4 w-4" /> Compose Memo
          </Button>
        )}
      </div>

      {isComposing && (
        <Card className="border-(--earist-accent) shadow-md">
          <CardHeader className="bg-(--earist-surface-gray) pb-4 flex flex-row items-center justify-between rounded-t-xl">
            <CardTitle className="text-lg font-bold text-(--earist-primary) flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-(--earist-accent)" /> New Broadcast
            </CardTitle>
            <button onClick={() => setIsComposing(false)} className="text-(--earist-body-text) hover:text-(--earist-primary)">
              <X className="h-5 w-5" />
            </button>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div>
              <label className="text-xs font-bold text-(--earist-secondary) uppercase tracking-wider mb-1 block">Audience Target</label>
              <div className="flex gap-4">
                <select 
                  value={audience} 
                  onChange={(e) => setAudience(e.target.value)}
                  className="rounded-lg border border-(--earist-border-gray) p-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:ring-1 focus:ring-(--earist-primary) outline-none w-1/3"
                >
                  <option value="ALL">Everyone</option>
                  <option value="STUDENTS">All Students</option>
                  <option value="PANELISTS">All Panelists</option>
                  <option value="PROGRAM">Specific Program</option>
                </select>
                {audience === "PROGRAM" && (
                  <select 
                    value={programId} 
                    onChange={(e) => setProgramId(e.target.value)}
                    className="rounded-lg border border-(--earist-border-gray) p-2 text-sm text-(--earist-body-text) w-2/3"
                  >
                    <option value="">Select a Program...</option>
                    {programs.map((p: { id: string; programName: string}) => (
                      <option key={p.id} value={p.id}>{p.programName}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-(--earist-secondary) uppercase tracking-wider mb-1 block">Memo Title</label>
              <input
                type="text"
                placeholder="e.g., Important Updates for Final Defense Requirements"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-(--earist-border-gray) p-3 text-sm focus:border-(--earist-primary) outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-(--earist-secondary) uppercase tracking-wider mb-1 block">Memo Content</label>
              <textarea
                placeholder="Write the full content of the memo here..."
                rows={6}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full rounded-lg border border-(--earist-border-gray) p-3 text-sm focus:border-(--earist-primary) outline-none resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-(--earist-border-gray)">
              <Button variant="outline" onClick={() => setIsComposing(false)}>Cancel</Button>
              <Button 
                onClick={() => publishMemo.mutate()} 
                disabled={!title || !content || publishMemo.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Send className="mr-2 h-4 w-4" /> 
                {publishMemo.isPending ? "Broadcasting..." : "Publish Broadcast"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History List */}
      <div className="space-y-4 mt-8">
        <h3 className="text-sm font-bold text-(--earist-secondary) uppercase tracking-wider mb-2">Broadcast History</h3>
        {isLoading ? (
          <p className="text-sm text-center py-8 text-(--earist-body-text)">Loading history...</p>
        ) : memos.length === 0 ? (
          <Card className="bg-(--earist-surface-gray) border-none">
            <CardContent className="flex flex-col items-center py-10">
              <Megaphone className="h-10 w-10 text-(--earist-body-text)/30 mb-3" />
              <p className="text-sm text-(--earist-body-text)">No memos have been published yet.</p>
            </CardContent>
          </Card>
        ) : (
          memos.map((memo: { id: string; title: string; content: string; targetAudience: string; createdAt: string }) => (
            <Card key={memo.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-0 flex flex-col sm:flex-row">
                <div className="bg-(--earist-surface-light-red) p-4 flex flex-col justify-center items-center w-full sm:w-32 sm:border-r border-(--earist-border-gray)">
                  <Clock className="h-5 w-5 text-(--earist-primary) mb-1" />
                  <span className="text-xs font-bold text-(--earist-primary)">
                    {new Date(memo.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="p-4 flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-(--earist-primary) text-lg">{memo.title}</h4>
                    <Badge variant="outline" className="text-[10px] bg-white">
                      <Users className="h-3 w-3 mr-1 inline" />
                      {memo.targetAudience}
                    </Badge>
                  </div>
                  <p className="text-sm text-(--earist-body-text) whitespace-pre-wrap">{memo.content}</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
