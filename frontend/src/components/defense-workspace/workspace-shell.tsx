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

import { useState, type ReactNode } from "react";
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
import { CollaborativeManuscriptViewer } from "./collaborative-manuscript-viewer";
import { ProposalHistoryPanel } from "./proposal-history-panel";
import { RoleRail } from "./role-rail";
import { CollaborationRailPane, CollaborationViewerPane } from "./student-document-collaboration";

type CenterTab = "report" | "doc" | "proposal";

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
  const [leftDrawer, setLeftDrawer] = useState(false);
  const [rightDrawer, setRightDrawer] = useState(false);

  const proposalManuscript = workspace.proposalHistory?.manuscript ?? null;
  const proposalRap = workspace.proposalHistory?.rap ?? null;
  const showProposalContext = Boolean(proposalManuscript);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-(--earist-surface-gray)">
      <CompactWorkspaceHeader workspace={workspace}>
        {/* Mobile: open the role rail / comments as drawers. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="xl:hidden"
          onClick={() => setLeftDrawer(true)}
        >
          <PanelLeft className="mr-1 h-4 w-4" /> Actions
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="lg:hidden"
          onClick={() => setRightDrawer(true)}
        >
          <MessageSquare className="mr-1 h-4 w-4" /> Comments
        </Button>
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
          <div className="flex shrink-0 items-center gap-1 border-b border-(--earist-border-gray) bg-white px-2">
            <TabButton
              active={tab === "report"}
              onClick={() => setTab("report")}
              icon={<FileText className="h-4 w-4" />}
            >
              Committee Report
            </TabButton>
            <TabButton
              active={tab === "doc"}
              onClick={() => setTab("doc")}
              icon={<BookOpen className="h-4 w-4" />}
            >
              Student Document
            </TabButton>
            {showProposalContext && (
              <TabButton
                active={tab === "proposal"}
                onClick={() => setTab("proposal")}
                icon={<FileText className="h-4 w-4" />}
              >
                Proposal Context
              </TabButton>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {tab === "proposal" && proposalManuscript ? (
              <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3">
                <div className="min-h-[22rem] flex-1">
                  <CollaborativeManuscriptViewer
                    documentId={proposalManuscript.id}
                    documentLabel="Previous Proposal Manuscript"
                    annotations={[]}
                  />
                </div>
                <ProposalHistoryPanel manuscript={proposalManuscript} rap={proposalRap} />
              </div>
            ) : tab === "report" ? (
              <CommitteeReportPanel workspace={workspace} scheduleId={scheduleId} />
            ) : hasDocument ? (
              <div className="flex h-full min-h-0 flex-col p-3">
                <CollaborationViewerPane className="h-full" />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center text-sm text-(--earist-body-text)">
                No stage document is available for this defense yet.
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

      {/* Mobile overlay drawers (presentation only). */}
      {leftDrawer && (
        <div className="fixed inset-0 z-50 flex xl:hidden">
          <div className="flex h-full w-[28rem] max-w-[88vw] flex-col bg-white shadow-xl duration-200 ease-out animate-in slide-in-from-left motion-reduce:animate-none">
            <div className="flex shrink-0 items-center justify-between border-b border-(--earist-border-gray) px-3 py-2">
              <span className="text-base font-semibold text-(--earist-primary)">
                Actions
              </span>
              <button
                type="button"
                onClick={() => setLeftDrawer(false)}
                aria-label="Close actions"
                className="inline-flex size-9 items-center justify-center rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <RoleRail workspace={workspace} scheduleId={scheduleId} />
            </div>
          </div>
          <button
            type="button"
            aria-label="Close actions"
            className="flex-1 bg-black/40"
            onClick={() => setLeftDrawer(false)}
          />
        </div>
      )}

      {rightDrawer && hasDocument && (
        <div className="fixed inset-0 z-50 flex justify-end lg:hidden">
          <button
            type="button"
            aria-label="Close comments"
            className="flex-1 bg-black/40"
            onClick={() => setRightDrawer(false)}
          />
          <div className="flex h-full w-80 max-w-[88vw] flex-col bg-white shadow-xl duration-200 ease-out animate-in slide-in-from-right motion-reduce:animate-none">
            <div className="flex shrink-0 items-center justify-between border-b border-(--earist-border-gray) px-3 py-2">
              <span className="text-base font-semibold text-(--earist-primary)">
                Shared Comments
              </span>
              <button
                type="button"
                onClick={() => setRightDrawer(false)}
                aria-label="Close comments"
                className="inline-flex size-9 items-center justify-center rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <CollaborationRailPane className="h-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[15px] font-medium transition-colors " +
        (active
          ? "border-(--earist-primary) text-(--earist-primary)"
          : "border-transparent text-(--earist-body-text) hover:text-(--earist-primary)")
      }
    >
      {icon}
      {children}
    </button>
  );
}
