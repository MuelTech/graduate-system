"use client";

/**
 * CDW-5 — read-only Committee Report renderer.
 *
 * Renders the canonical structured JSON document as semantic elements. There is
 * NO raw-HTML injection and no HTML anywhere: the body is data, so this is
 * XSS-safe by construction and identical for the Rapporteur preview and the
 * Chairman/Panelist read-only view.
 *
 * `ReportDocumentCanvas` is the shared document presentation wrapper (neutral
 * work surface + centered, A4-inspired white page). The Rapporteur editor,
 * Preview Report, and the read-only view all reuse it so the authored content
 * reads the same in every mode. It is presentation only — no pagination.
 */

import type { ReactNode } from "react";

import type {
  ReportBlockNode,
  ReportDocument,
  ReportInlineNode,
} from "@/lib/report/report-document";

import "./report-body.css";

function InlineRun({ node }: { node: ReportInlineNode }) {
  if (node.type === "hardBreak") return <br />;
  let content: ReactNode = node.text;
  const marks = node.marks ?? [];
  if (marks.includes("underline")) content = <u>{content}</u>;
  if (marks.includes("italic")) content = <em>{content}</em>;
  if (marks.includes("bold")) content = <strong>{content}</strong>;
  return <>{content}</>;
}

function InlineList({ nodes }: { nodes: ReportInlineNode[] }) {
  return (
    <>
      {nodes.map((node, index) => (
        <InlineRun key={index} node={node} />
      ))}
    </>
  );
}

function Block({ node }: { node: ReportBlockNode }) {
  if (node.type === "heading") {
    const align = node.attrs.textAlign;
    const style = align ? { textAlign: align } : undefined;
    const children = <InlineList nodes={node.content ?? []} />;
    if (node.attrs.level === 1) return <h1 style={style}>{children}</h1>;
    if (node.attrs.level === 2) return <h2 style={style}>{children}</h2>;
    return <h3 style={style}>{children}</h3>;
  }

  if (node.type === "paragraph") {
    const align = node.attrs?.textAlign;
    const indent = node.attrs?.indentLevel;
    const fontSizePt = node.attrs?.fontSizePt;
    const lineSpacing = node.attrs?.lineSpacing;
    return (
      <p
        style={align ? { textAlign: align } : undefined}
        data-indent-level={indent ? String(indent) : undefined}
        data-font-size-pt={fontSizePt ? String(fontSizePt) : undefined}
        data-line-spacing={lineSpacing ? String(lineSpacing) : undefined}
      >
        <InlineList nodes={node.content ?? []} />
      </p>
    );
  }

  const items = (node.content ?? []).map((item, index) => (
    <li key={index}>
      {(item.content ?? []).map((child, childIndex) => (
        <Block key={childIndex} node={child} />
      ))}
    </li>
  ));

  return node.type === "bulletList" ? <ul>{items}</ul> : <ol>{items}</ol>;
}

export function ReportDocumentView({
  doc,
  className,
  emptyLabel = "No report content.",
}: {
  doc: ReportDocument | null;
  className?: string;
  emptyLabel?: string;
}) {
  const blocks = doc && doc.type === "doc" ? (doc.content ?? []) : [];
  if (blocks.length === 0) {
    return <p className="text-[15px] text-(--earist-body-text)">{emptyLabel}</p>;
  }
  return (
    <div className={"cdwReportBody " + (className ?? "")}>
      {blocks.map((node, index) => (
        <Block key={index} node={node} />
      ))}
    </div>
  );
}

/**
 * Shared document presentation wrappers. The neutral workspace scrolls around a
 * centered white document canvas. Pure CSS classes (report-body.css) — reused by
 * the editor, Preview Report, and the read-only view so their body presentation
 * matches. No page boundaries or pagination are implied.
 */
export function ReportDocumentCanvas({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={"cdwReportWorkspace min-h-0 flex-1 overflow-auto " + (className ?? "")}>
      <div className="cdwReportCanvas">{children}</div>
    </div>
  );
}
