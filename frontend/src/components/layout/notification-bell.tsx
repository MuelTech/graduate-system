"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiClientRequest } from "@/lib/api.client";
import { NotificationItem } from "@/types/index";

export function NotificationBell({
  role = "STUDENT",
}: {
  role?: "STUDENT" | "ADMIN" | "PANELIST" | "FACULTY" | "APPLICANT";
}) {
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

  const isFaculty = role === "PANELIST" || role === "FACULTY";

  const basePath =
    role === "ADMIN"
      ? "/admin/notifications"
      : isFaculty
      ? "/faculty/notifications"
      : role === "APPLICANT"
      ? "/applicant/notifications"
      : "/student/notifications";

  const announcementsPath =
    role === "ADMIN"
      ? "/admin/memos"
      : isFaculty
      ? "/faculty/announcements"
      : "/student/announcements";

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        className="relative rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-[#333333]"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#e02b20] text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-4 py-3">
              <span className="text-sm font-bold text-[#333333]">Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="default">
                  {unreadCount} New
                </Badge>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {recentNotifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">
                  You&apos;re all caught up!
                </div>
              ) : (
                recentNotifications.map((n: NotificationItem) => (
                  <div
                    key={n.id}
                    className={`border-b border-gray-100 p-4 text-sm transition-colors ${
                      n.isRead ? "bg-white opacity-75" : "bg-red-50/30"
                    }`}
                  >
                    {/* Deep-link MEMO notifications to announcements feed */}
                    {n.type === "MEMO" ? (
                      <Link
                        href={announcementsPath}
                        onClick={() => {
                          setIsOpen(false);
                          if (!n.isRead) markAsRead.mutate(n.id);
                        }}
                        className="group block"
                      >
                        <p className="mb-1 font-semibold text-[#333333] group-hover:text-[#e02b20] group-hover:underline">
                          {n.title}
                        </p>
                        <p className="mb-2 line-clamp-2 text-xs text-gray-500">
                          {n.message}
                        </p>
                      </Link>
                    ) : (
                      <>
                        <p className="mb-1 font-semibold text-[#333333]">{n.title}</p>
                        <p className="mb-2 line-clamp-2 text-xs text-gray-500">
                          {n.message}
                        </p>
                      </>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-400">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                      {!n.isRead && (
                        <button
                          onClick={() => markAsRead.mutate(n.id)}
                          className="flex items-center gap-1 text-[11px] font-medium text-[#e02b20] hover:underline"
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
              className="block border-t border-gray-100 bg-gray-50/80 py-3 text-center text-xs font-semibold text-[#e02b20] transition-colors hover:bg-red-50/60"
            >
              View All Notifications
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
