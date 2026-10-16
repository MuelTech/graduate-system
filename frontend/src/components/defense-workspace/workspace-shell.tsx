"use client";

/**
 * CDW-4 — immersive Defense Workspace shell.
 *
 * LEFT  = what I need to do     (role-aware rail)
 * CENTER= what we are reviewing (Committee Report | Student Document)
 * RIGHT = what the committee is discussing (Shared Comments)
 *
 * Both side rails are independently collapsible on desktop and become overlay
 * drawers on narrow screens. Collapsing is presentation-only: it never changes
 * evaluation/collaboration state. The collaboration query is owned by the
 * StudentDocumentCollaboration provider that wraps this shell — the viewer and
 * the Shared Comments rail read the SAME source.
 */

import { useState, type ReactNode } from "react";
import { BookOpen, FileText, MessageSquare, PanelLeft, PanelRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
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
          className="lg:hidden"
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
        {/* Desktop: collapse/expand each rail. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden lg:inline-flex"
          aria-pressed={!leftCollapsed}
          onClick={() => setLeftCollapsed((v) => !v)}
        >
          <PanelLeft className="mr-1 h-4 w-4" />
          {leftCollapsed ? "Show actions" : "Hide actions"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden lg:inline-flex"
          aria-pressed={!rightCollapsed}
          onClick={() => setRightCollapsed((v) => !v)}
        >
          <PanelRight className="mr-1 h-4 w-4" />
          {rightCollapsed ? "Show comments" : "Hide comments"}
        </Button>
      </CompactWorkspaceHeader>

      <div className="flex min-h-0 flex-1">
        {!leftCollapsed && (
          <aside className="hidden w-72 shrink-0 border-r border-(--earist-border-gray) bg-white lg:block xl:w-80">
            <RoleRail workspace={workspace} scheduleId={scheduleId} />
          </aside>
        )}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-1 border-b border-(--earist-border-gray) bg-white px-2">
            <TabButton
              active={tab === "report"}
              onClick={() => setTab("report")}
              icon={<FileText className="h-3.5 w-3.5" />}
            >
              Committee Report
            </TabButton>
            <TabButton
              active={tab === "doc"}
              onClick={() => setTab("doc")}
              icon={<BookOpen className="h-3.5 w-3.5" />}
            >
              Student Document
            </TabButton>
            {showProposalContext && (
              <TabButton
                active={tab === "proposal"}
                onClick={() => setTab("proposal")}
                icon={<FileText className="h-3.5 w-3.5" />}
              >
                Proposal Context
              </TabButton>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {tab === "proposal" && proposalManuscript ? (
              <div className="h-full space-y-3 overflow-auto p-3">
                <CollaborativeManuscriptViewer
                  documentId={proposalManuscript.id}
                  documentLabel="Previous Proposal Manuscript"
                  annotations={[]}
                />
                <ProposalHistoryPanel manuscript={proposalManuscript} rap={proposalRap} />
              </div>
            ) : tab === "report" ? (
              <CommitteeReportPanel workspace={workspace} scheduleId={scheduleId} />
            ) : hasDocument ? (
              <div className="h-full overflow-auto p-3">
                <CollaborationViewerPane />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center text-sm text-(--earist-body-text)">
                No stage document is available for this defense yet.
              </div>
            )}
          </div>
        </main>

        {!rightCollapsed && hasDocument && (
          <aside className="hidden w-80 shrink-0 border-l border-(--earist-border-gray) bg-white lg:block xl:w-[22rem]">
            <CollaborationRailPane className="h-full" />
          </aside>
        )}
      </div>

      {/* Mobile overlay drawers (presentation only). */}
      {leftDrawer && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-80 max-w-[85vw] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-(--earist-border-gray) px-3 py-2">
              <span className="text-sm font-semibold text-(--earist-primary)">Actions</span>
              <button type="button" onClick={() => setLeftDrawer(false)} aria-label="Close actions">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="h-[calc(100%-3rem)]">
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
          <div className="w-80 max-w-[85vw] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-(--earist-border-gray) px-3 py-2">
              <span className="text-sm font-semibold text-(--earist-primary)">Shared Comments</span>
              <button type="button" onClick={() => setRightDrawer(false)} aria-label="Close comments">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="h-[calc(100%-3rem)]">
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
        "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
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
