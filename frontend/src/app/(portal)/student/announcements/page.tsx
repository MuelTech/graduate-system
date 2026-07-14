"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Clock } from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";

export default function Announcements() {
  const { data: memos = [], isLoading } = useQuery({
    queryKey: ["student-memos"],
    queryFn: async () => await apiClientRequest("/memos"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-(--earist-primary)" style={{ fontFamily: '"Calibri", sans-serif' }}>
          Announcements & Memos
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          View official communications from the Graduate School Office.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-(--earist-body-text)">Loading announcements...</p>
      ) : memos.length === 0 ? (
        <Card className="bg-(--earist-surface-gray) border-none mt-8">
          <CardContent className="flex flex-col items-center py-12">
            <Megaphone className="h-12 w-12 text-(--earist-body-text)/30 mb-4" />
            <p className="text-sm font-bold text-(--earist-secondary)">No Announcements</p>
            <p className="text-xs text-(--earist-body-text)">You have no memos at this time.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {memos.map((memo: { id: string; title: string; content: string; targetAudience: string; createdAt: string; createdBy?: { firstName: string; lastName: string } }) => (
            <Card key={memo.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-0 flex flex-col sm:flex-row">
                <div className="bg-(--earist-surface-light-red) p-4 flex flex-col justify-center items-center w-full sm:w-32 sm:border-r border-(--earist-border-gray)">
                  <Clock className="h-5 w-5 text-(--earist-primary) mb-1" />
                  <span className="text-xs font-bold text-(--earist-primary)">
                    {new Date(memo.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="p-4 sm:p-6 flex-1">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-(--earist-primary) text-lg">{memo.title}</h4>
                    <Badge variant="outline" className="text-[10px] bg-white text-(--earist-accent) border-(--earist-accent)">
                      Official Memo
                    </Badge>
                  </div>
                  <p className="text-sm text-(--earist-body-text) whitespace-pre-wrap leading-relaxed">
                    {memo.content}
                  </p>
                  <div className="mt-4 pt-4 border-t border-(--earist-border-gray) flex justify-between items-center text-xs text-(--earist-secondary)">
                    <span>Sent by: {memo.createdBy?.firstName} {memo.createdBy?.lastName}</span>
                    <span>Target: {memo.targetAudience}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
