"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiClientRequest } from "@/lib/api.client";
import { NotificationItem } from "@/types/index";

export function NotificationBell({ role = "STUDENT" }: { role?: "STUDENT" | "ADMIN" }) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await apiClientRequest("/notifications");
      return res || [];
    },
    refetchInterval: 30000, // Poll every 30s
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      return apiClientRequest(`/notifications/${id}/read`, { method: "PUT" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unreadCount = notifications.filter((n: NotificationItem) => !n.isRead).length;
  const recentNotifications = notifications.slice(0, 5); // Show top 5 in dropdown
  const basePath = role === "ADMIN" ? "/admin/notifications" : "/student/notifications";

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full p-2 text-(--earist-body-text) transition-colors hover:bg-(--earist-surface-light-red) hover:text-(--earist-primary)"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-(--earist-accent) text-[10px] font-bold text-(--earist-primary)">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 z-50 rounded-lg border border-(--earist-border-gray) bg-white shadow-lg overflow-hidden">
            <div className="bg-(--earist-surface-gray) px-4 py-3 flex justify-between items-center border-b border-(--earist-border-gray)">
              <span className="font-bold text-sm text-(--earist-primary)">Notifications</span>
              {unreadCount > 0 && <Badge className="bg-(--earist-accent) text-(--earist-primary)">{unreadCount} New</Badge>}
            </div>
            
            <div className="max-h-80 overflow-y-auto">
              {recentNotifications.length === 0 ? (
                <div className="p-4 text-center text-xs text-(--earist-body-text)">
                  You&apos;re all caught up!
                </div>
              ) : (
                recentNotifications.map((n: NotificationItem) => (
                  <div key={n.id} className={`p-4 border-b border-(--earist-border-gray) text-sm transition-colors ${n.isRead ? 'opacity-70 bg-white' : 'bg-red-50/30'}`}>
                    <p className="font-semibold text-(--earist-primary) mb-1">{n.title}</p>
                    <p className="text-xs text-(--earist-body-text) line-clamp-2 mb-2">{n.message}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-(--earist-secondary)">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                      {!n.isRead && (
                        <button 
                          onClick={() => markAsRead.mutate(n.id)}
                          className="text-[10px] flex items-center gap-1 text-(--earist-primary) hover:underline"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Mark read
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <Link 
              href={basePath}
              onClick={() => setIsOpen(false)}
              className="block bg-(--earist-surface-gray) text-center py-3 text-xs font-semibold text-(--earist-primary) hover:bg-(--earist-surface-light-red) transition-colors"
            >
              View All Notifications
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
