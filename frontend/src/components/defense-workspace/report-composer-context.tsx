"use client";

/**
 * CDW-5 — report composer bridge.
 *
 * The Rapporteur editor lives in the CENTER pane (Committee Report tab) while the
 * Shared Comments rail lives in the RIGHT pane, so "Insert into Report" needs a
 * small, explicit bridge. The authoring panel registers an insert handler; the
 * comments rail (for the Rapporteur only) calls it. Nothing else is shared, and
 * no second report state store is created — React Query + the server stay
 * canonical.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type InsertHandler = (text: string) => boolean;

interface ReportComposerValue {
  /** True while the Rapporteur report editor is mounted and can accept inserts. */
  canInsert: boolean;
  /** Copy the given full comment text into the report editor at the caret. */
  insertComment: (text: string) => boolean;
  /** Registered by the authoring panel; pass null on unmount. */
  registerInsert: (handler: InsertHandler | null) => void;
}

const NOOP_COMPOSER: ReportComposerValue = {
  canInsert: false,
  insertComment: () => false,
  registerInsert: () => {},
};

const ReportComposerContext = createContext<ReportComposerValue>(NOOP_COMPOSER);

export function useReportComposer(): ReportComposerValue {
  return useContext(ReportComposerContext);
}

export function ReportComposerProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<InsertHandler | null>(null);
  const [canInsert, setCanInsert] = useState(false);

  const registerInsert = useCallback((handler: InsertHandler | null) => {
    handlerRef.current = handler;
    setCanInsert(Boolean(handler));
  }, []);

  const insertComment = useCallback((text: string) => {
    const handler = handlerRef.current;
    if (!handler) return false;
    return handler(text);
  }, []);

  const value = useMemo(
    () => ({ canInsert, insertComment, registerInsert }),
    [canInsert, insertComment, registerInsert],
  );

  return (
    <ReportComposerContext.Provider value={value}>
      {children}
    </ReportComposerContext.Provider>
  );
}
