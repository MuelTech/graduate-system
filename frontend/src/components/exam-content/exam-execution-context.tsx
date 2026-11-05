"use client";

import { createContext } from "react";

/** Exact execution context for confidential images; Admin previews use null. */
export const ExamExecutionContext = createContext<string | null>(null);
