"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PdfAnnotationPoc } from "@/components/poc/pdf-annotation-poc";

/**
 * CDW-0A route — isolated proof of concept. Deliberately outside the (portal)
 * layout so it does not touch the production Defense Workspace. The document
 * proxy route still enforces authentication.
 */
function PocInner() {
  const params = useSearchParams();
  const initialId = params.get("documentId") ?? "";
  const [documentId, setDocumentId] = useState(initialId);
  const [loadedId, setLoadedId] = useState(initialId);

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">CDW-0A — PDF annotation proof of concept</h1>
        <p className="max-w-3xl text-sm text-current/70">
          Isolated technical spike for the collaborative Defense Workspace. Not
          the production feature. The PDF is loaded only through the existing
          secure document route (<code>/api/documents/thesis-document/&lt;id&gt;/file</code>),
          so an authenticated, authorized session is required.
        </p>
      </header>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setLoadedId(documentId.trim());
        }}
      >
        <label className="text-sm">
          Thesis document id
          <input
            className="ml-2 w-80 rounded border px-2 py-1 font-mono text-sm"
            value={documentId}
            onChange={(event) => setDocumentId(event.target.value)}
            placeholder="document_id (uuid)"
          />
        </label>
        <button type="submit" className="rounded border px-3 py-1.5 text-sm">
          Load
        </button>
      </form>

      {loadedId ? (
        <PdfAnnotationPoc key={loadedId} documentId={loadedId} />
      ) : (
        <p className="text-sm text-current/60">
          Enter a thesis document id (or open this page with{" "}
          <code>?documentId=&lt;uuid&gt;</code>) to begin.
        </p>
      )}
    </main>
  );
}

export default function PdfAnnotationPocPage() {
  return (
    <Suspense fallback={<main className="p-6 text-sm">Loading…</main>}>
      <PocInner />
    </Suspense>
  );
}
