"use client";

/**
 * CDW-4 FIX — immersive Defense Workspace shell.
 *
 * LEFT  = what I need to do     (role-aware rail, wide enough for the matrix)
 * CENTER= what we are reviewing (Committee Report | Student Document)
 * RIGHT = what the committee is discussing (Shared Comments)
 *
 * CDW-4 FIX: the evaluation rail is materially wider (xl 26rem / 2xl 30rem) so the
 * institutional matrix fits without tiny text; the center pane FILLS the remaining
 * viewport height (the PDF scrolls inside the viewer); collapse controls are
 * icon-first and local to the rail they affect; rail motion is restrained and
 * respects prefers-reduced-motion.
 *
 * Collapsing is presentation-only: it never changes evaluation/collaboration state.
 * The collaboration query is owned by the StudentDocumentCollaboration provider
 * that wraps this shell.
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  BookOpen,
  FileText,
  MessageSquare,
  PanelLeft,
  PanelLeftOpen,
  PanelRightOpen,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconTooltipButton } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DefenseWorkspace } from "@/types/defense-workspace";

import { CompactWorkspaceHeader } from "./compact-workspace-header";
import { CommitteeReportPanel } from "./committee-report-panel";
import { DefenseHistoryControl } from "./defense-history-panel";
import { RoleRail } from "./role-rail";
import { CollaborationRailPane, CollaborationViewerPane } from "./student-document-collaboration";

type CenterTab = "report" | "doc";

export function WorkspaceShell({
  workspace,
  scheduleId,
  hasDocument = false,
}: {
  workspace: DefenseWorkspace;
  scheduleId: string;
  hasDocument?: boolean;
}) {
  const [tab, setTab] = useState<CenterTab>("doc");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [openDrawer, setOpenDrawer] = useState<"left" | "right" | null>(null);
  const [drawerReturnFocus, setDrawerReturnFocus] = useState<HTMLElement | null>(
    null,
  );
  const activeDrawer =
    openDrawer === "right" && !hasDocument ? null : openDrawer;
  const drawerOpen = activeDrawer !== null;
  const actionsTriggerRef = useRef<HTMLButtonElement>(null);
  const commentsTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (hasDocument || openDrawer !== "right") return;
    // The derived active drawer already prevents an inert orphan immediately.
    // Also clear the stored state so it cannot reappear if a document returns.
    const id = window.setTimeout(() => setOpenDrawer(null), 0);
    return () => window.clearTimeout(id);
  }, [hasDocument, openDrawer]);

  const selectTab = (next: CenterTab, focus = false) => {
    setTab(next);
    if (focus) {
      requestAnimationFrame(() => {
        document.getElementById(`workspace-tab-${next}`)?.focus();
      });
    }
  };

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const next =
      event.key === "Home"
        ? "report"
        : event.key === "End"
          ? "doc"
          : tab === "report"
            ? "doc"
            : "report";
    selectTab(next, true);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-(--earist-surface-gray)">
      <div
        className="flex min-h-0 flex-1 flex-col"
        inert={drawerOpen ? true : undefined}
        aria-hidden={drawerOpen ? true : undefined}
      >
        <CompactWorkspaceHeader workspace={workspace}>
          {/* Mobile: open the role rail / comments as drawers. */}
          <Button
            ref={actionsTriggerRef}
            type="button"
            variant="outline"
            size="sm"
            className="xl:hidden"
            onClick={() => {
              setDrawerReturnFocus(actionsTriggerRef.current);
              setOpenDrawer("left");
            }}
          >
            <PanelLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Actions
          </Button>
          {hasDocument && (
            <Button
              ref={commentsTriggerRef}
              type="button"
              variant="outline"
              size="sm"
              className="lg:hidden"
              onClick={() => {
                setDrawerReturnFocus(commentsTriggerRef.current);
                setOpenDrawer("right");
              }}
            >
              <MessageSquare className="mr-1 h-4 w-4" aria-hidden="true" /> Comments
            </Button>
          )}
        </CompactWorkspaceHeader>

        <div className="flex min-h-0 flex-1">
        {/* Left role/evaluation rail (wide). Collapse is presentation-only. */}
        <aside
          className={cn(
            "hidden shrink-0 overflow-hidden border-r border-(--earist-border-gray) bg-white transition-[width] duration-200 ease-out motion-reduce:transition-none xl:block",
            leftCollapsed
              ? "w-0 border-r-0"
              : "xl:w-[28rem] 2xl:w-[32rem]",
          )}
        >
          <RoleRail
            workspace={workspace}
            scheduleId={scheduleId}
            onCollapse={() => setLeftCollapsed(true)}
          />
        </aside>
        {leftCollapsed && (
          <div className="hidden w-10 shrink-0 flex-col items-center border-r border-(--earist-border-gray) bg-white py-2 transition-all duration-200 ease-out motion-reduce:transition-none xl:flex">
            <IconTooltipButton
              label="Expand actions panel"
              onClick={() => setLeftCollapsed(false)}
            >
              <PanelLeftOpen className="h-5 w-5" />
            </IconTooltipButton>
          </div>
        )}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            role="tablist"
            aria-label="Workspace view"
            onKeyDown={handleTabKeyDown}
            className="flex shrink-0 items-center gap-1 border-b border-(--earist-border-gray) bg-white px-2"
          >
            <TabButton
              id="workspace-tab-report"
              controls="workspace-center-panel"
              selected={tab === "report"}
              onClick={() => selectTab("report")}
              icon={<FileText className="h-4 w-4" aria-hidden="true" />}
            >
              Committee Report
            </TabButton>
            <TabButton
              id="workspace-tab-doc"
              controls="workspace-center-panel"
              selected={tab === "doc"}
              onClick={() => selectTab("doc")}
              icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
            >
              Student Document
            </TabButton>
          </div>

          <div
            id="workspace-center-panel"
            role="tabpanel"
            aria-labelledby={`workspace-tab-${tab}`}
            tabIndex={0}
            className="min-h-0 flex-1 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--earist-primary)/40"
          >
            {tab === "report" ? (
              <CommitteeReportPanel workspace={workspace} scheduleId={scheduleId} />
            ) : hasDocument ? (
              <div className="flex h-full min-h-0 min-w-0 flex-col p-3">
                <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-(--earist-secondary)">
                    Current Manuscript
                  </span>
                  <DefenseHistoryControl scheduleId={scheduleId} hasCurrentDocument />
                </div>
                <CollaborationViewerPane className="h-full" />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <p className="text-sm text-(--earist-body-text)">
                  No stage document is available for this defense yet.
                </p>
                <DefenseHistoryControl scheduleId={scheduleId} hasCurrentDocument={false} />
              </div>
            )}
          </div>
        </main>

        {/* Right Shared Comments rail. */}
        <aside
          className={cn(
            "hidden shrink-0 overflow-hidden border-l border-(--earist-border-gray) bg-white transition-[width] duration-200 ease-out motion-reduce:transition-none lg:block",
            rightCollapsed || !hasDocument
              ? "w-0 border-l-0"
              : "lg:w-80 2xl:w-[22rem]",
          )}
        >
          {hasDocument && (
            <CollaborationRailPane
              className="h-full"
              onCollapse={() => setRightCollapsed(true)}
            />
          )}
        </aside>
        {rightCollapsed && hasDocument && (
          <div className="hidden w-10 shrink-0 flex-col items-center border-l border-(--earist-border-gray) bg-white py-2 transition-all duration-200 ease-out motion-reduce:transition-none lg:flex">
            <IconTooltipButton
              label="Expand comments panel"
              onClick={() => setRightCollapsed(false)}
            >
              <PanelRightOpen className="h-5 w-5" />
            </IconTooltipButton>
          </div>
        )}
        </div>
      </div>

      {/* Mobile overlay drawers (presentation only). */}
      {activeDrawer === "left" && (
        <WorkspaceDrawer
          side="left"
          title="Actions"
          returnFocusTo={drawerReturnFocus}
          onClose={() => setOpenDrawer(null)}
        >
          <RoleRail workspace={workspace} scheduleId={scheduleId} />
        </WorkspaceDrawer>
      )}

      {activeDrawer === "right" && hasDocument && (
        <WorkspaceDrawer
          side="right"
          title="Shared Comments"
          returnFocusTo={drawerReturnFocus}
          onClose={() => setOpenDrawer(null)}
        >
          <CollaborationRailPane className="h-full" />
        </WorkspaceDrawer>
      )}
    </div>
  );
}

const DRAWER_FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function WorkspaceDrawer({
  side,
  title,
  onClose,
  returnFocusTo,
  children,
}: {
  side: "left" | "right";
  title: string;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  const returnFocusRef = useRef(returnFocusTo);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    returnFocusRef.current = returnFocusTo;
  }, [returnFocusTo]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const previouslyFocused =
      returnFocusRef.current ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);

    const focusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(DRAWER_FOCUSABLE)).filter(
        (element) =>
          !element.hasAttribute("disabled") &&
          element.getAttribute("aria-hidden") !== "true" &&
          element.tabIndex !== -1,
      );

    const initial = focusable()[0] ?? panel;
    initial.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && panel.contains(active);

      if (!inside) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={cn(
        "flex h-full min-w-0 flex-col bg-white shadow-xl outline-none duration-200 ease-out animate-in motion-reduce:animate-none",
        side === "left"
          ? "w-[28rem] max-w-[88vw] slide-in-from-left"
          : "w-80 max-w-[88vw] slide-in-from-right",
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-(--earist-border-gray) px-3 py-2">
        <h2
          id={titleId}
          className="min-w-0 truncate text-base font-semibold text-(--earist-primary)"
        >
          {title}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          onClick={onClose}
          aria-label={`Close ${title.toLowerCase()}`}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden">
        {children}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex bg-black/40",
        side === "right" ? "justify-end lg:hidden" : "xl:hidden",
      )}
    >
      {side === "left" && panel}
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Close ${title.toLowerCase()}`}
        className="flex-1 bg-transparent"
        onClick={onClose}
      />
      {side === "right" && panel}
    </div>
  );
}

function TabButton({
  id,
  controls,
  selected,
  onClick,
  icon,
  children,
}: {
  id: string;
  controls: string;
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-controls={controls}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onClick}
      className={
        "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[15px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-(--earist-primary)/40 " +
        (selected
          ? "border-(--earist-primary) text-(--earist-primary)"
          : "border-transparent text-(--earist-body-text) hover:text-(--earist-primary)")
      }
    >
      {icon}
      {children}
      {selected && <span className="sr-only"> (selected)</span>}
    </button>
  );
}
