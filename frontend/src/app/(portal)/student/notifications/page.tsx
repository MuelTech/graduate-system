"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, CheckCircle2, AlertCircle, FileCheck, Calendar } from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";
import { NotificationItem } from "@/types/index";

export default function Notifications() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => await apiClientRequest("/notifications"),
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => apiClientRequest(`/notifications/${id}/read`, { method: "PUT" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const getIcon = (type: string) => {
    switch(type) {
      case 'MEMO': return <Bell className="h-5 w-5 text-blue-500" />;
      case 'DEFENSE_SCHEDULE': return <Calendar className="h-5 w-5 text-purple-500" />;
      case 'RESIDENCY_WARNING': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <FileCheck className="h-5 w-5 text-green-500" />;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-(--earist-primary)" style={{ fontFamily: '"Calibri", sans-serif' }}>
          Personal Notifications
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Track all your defense schedules, document statuses, and system alerts.
        </p>
      </div>

      <Card className="border-(--earist-border-gray) shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-(--earist-body-text)">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-bold text-(--earist-secondary)">You&apos;re all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-(--earist-border-gray)">
              {notifications.map((n: NotificationItem) => (
                <div key={n.id} className={`p-4 sm:p-6 flex gap-4 transition-colors ${n.isRead ? 'bg-white' : 'bg-(--earist-surface-light-red)'}`}>
                  <div className="mt-1">{getIcon("MEMO")}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`text-sm font-bold ${n.isRead ? 'text-(--earist-secondary)' : 'text-(--earist-primary)'}`}>
                        {n.title}
                      </h4>
                      <span className="text-[10px] text-(--earist-body-text)">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className={`text-sm mb-3 ${n.isRead ? 'text-(--earist-body-text)' : 'text-black'}`}>
                      {n.message}
                    </p>
                    {!n.isRead && (
                      <button 
                        onClick={() => markAsRead.mutate(n.id)}
                        className="text-xs font-bold text-(--earist-primary) hover:underline flex items-center gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Mark as Read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
