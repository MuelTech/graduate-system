"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CircleDot,
  Clock,
  Eye,
  FileText,
  Lock,
  Upload,
  UserCheck,
  X,
  ArrowRight,
  BookOpenCheck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  formatJourneyCopy,
  JOURNEY_STEP_ORDER,
  journeyLabelFor,
  journeyRouteFor,
} from "@/lib/student-thesis-journey";
import type {
  JourneyStepKey,
  JourneyStepState,
  JourneyStepView,
  StudentThesisJourney,
} from "@/types/student-thesis-journey";
import { cn } from "@/lib/utils";

function stepStateBadge(state: JourneyStepState | undefined) {
  switch (state) {
    case "COMPLETED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
          <CheckCircle2 className="h-3 w-3" /> Completed
        </span>
      );
    case "CURRENT":
    case "AVAILABLE":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-[#e02b20]">
          <CircleDot className="h-3 w-3" /> Active Step
        </span>
      );
    case "WAITING":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
          <Clock className="h-3 w-3" /> In Progress
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
          <Lock className="h-3 w-3" /> Locked
        </span>
      );
  }
}

export interface ThesisJourneyShellProps {
  activeStep: JourneyStepKey;
  title: string;
  description?: string;
  journey?: StudentThesisJourney | null;
  officialTitleOverride?: string | null;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function ThesisJourneyShell({
  activeStep,
  title,
  description,
  journey,
  officialTitleOverride,
  actions,
  children,
}: ThesisJourneyShellProps) {
  const stepByKey = new Map<JourneyStepKey, JourneyStepView>(
    (journey?.steps ?? []).map((s) => [s.key, s]),
  );

  const approvedTitle =
    officialTitleOverride ?? journey?.selectedTitle?.titleText ?? null;
  const activeAdviser = journey?.activeAdviser ?? null;

  return (
    <div className="w-full space-y-6">
      <PageHeader title={title} description={description} actions={actions} />

      {/* 5-Step Horizontal Thesis Journey Stepper */}
      {journey ? (
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            {JOURNEY_STEP_ORDER.map((key, idx) => {
              const step = stepByKey.get(key);
              const isSelected = key === activeStep;
              const isNavigable =
                Boolean(step) &&
                (step!.state === "COMPLETED" ||
                  step!.state === "CURRENT" ||
                  step!.state === "AVAILABLE" ||
                  step!.state === "WAITING");
              const label = journeyLabelFor(key, step?.label);
              const href = journeyRouteFor(key);

              const content = (
                <div
                  className={cn(
                    "flex h-full flex-col justify-between gap-2 rounded-xl border p-3 transition-all",
                    isSelected
                      ? "border-[#e02b20] bg-red-50/40 ring-1 ring-[#e02b20]/20"
                      : step?.state === "COMPLETED"
                        ? "border-emerald-100 bg-emerald-50/20 hover:border-emerald-200 hover:bg-emerald-50/40"
                        : isNavigable
                          ? "border-gray-200/80 bg-white hover:border-gray-300 hover:bg-gray-50/60"
                          : "border-gray-100 bg-gray-50/60 opacity-65",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
                      Step {idx + 1}
                    </span>
                    {stepStateBadge(step?.state)}
                  </div>
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      isSelected ? "text-[#e02b20]" : "text-[#333333]",
                    )}
                  >
                    {label}
                  </p>
                </div>
              );

              if (!isNavigable) {
                return (
                  <div
                    key={key}
                    title={formatJourneyCopy(step?.lockReason) || `${label} is locked`}
                    className="cursor-not-allowed"
                  >
                    {content}
                  </div>
                );
              }

              return (
                <Link key={key} href={href} className="block focus:outline-none">
                  {content}
                </Link>
              );
            })}
          </div>

          {/* Approved Thesis Title & Active Adviser Context Banner */}
          {(approvedTitle || activeAdviser) && (
            <div className="mt-3 flex flex-col gap-3 rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              {approvedTitle ? (
                <div className="flex min-w-0 items-start gap-2.5">
                  <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#e02b20]" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Approved Thesis Title
                    </p>
                    <p className="text-sm font-semibold text-[#333333]">
                      {approvedTitle}
                    </p>
                  </div>
                </div>
              ) : <div />}
              {activeAdviser ? (
                <div className="flex shrink-0 items-center gap-2 rounded-lg border border-emerald-200/70 bg-emerald-50/70 px-3 py-1.5 text-xs">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-gray-600">Official Adviser:</span>
                  <span className="font-semibold text-emerald-900">
                    {activeAdviser.name}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {children}
    </div>
  );
}

export interface JourneyStepStatusCardProps {
  variant: "locked" | "completed" | "waiting";
  title: string;
  description?: React.ReactNode;
  badgeText?: string;
  nextStepHref?: string;
  nextStepLabel?: string;
  children?: React.ReactNode;
}

export function JourneyStepStatusCard({
  variant,
  title,
  description,
  badgeText,
  nextStepHref,
  nextStepLabel,
  children,
}: JourneyStepStatusCardProps) {
  return (
    <Card>
      <CardHeader className="border-b border-gray-100 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2.5 text-base font-bold text-[#333333]">
            {variant === "completed" ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            ) : variant === "waiting" ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Clock className="h-4 w-4" />
              </div>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                <Lock className="h-4 w-4" />
              </div>
            )}
            <span>{title}</span>
          </CardTitle>
          {badgeText ? (
            <Badge
              variant={
                variant === "completed"
                  ? "outline"
                  : variant === "waiting"
                    ? "secondary"
                    : "outline"
              }
              className={
                variant === "completed"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : variant === "waiting"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-gray-200 bg-gray-100 text-gray-600"
              }
            >
              {badgeText}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4 text-sm text-[#333333]">
        {description ? (
          <div className="text-sm text-gray-600">
            {typeof description === "string"
              ? formatJourneyCopy(description)
              : description}
          </div>
        ) : null}
        {children}
        {nextStepHref && nextStepLabel ? (
          <div className="pt-1">
            <Link
              href={nextStepHref}
              className={buttonVariants({
                variant: variant === "completed" ? "default" : "outline",
              })}
            >
              <span>{nextStepLabel}</span>
              {variant === "completed" && (
                <ArrowRight className="ml-1.5 h-4 w-4" />
              )}
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export interface DocumentUploadSlotProps {
  label: string;
  helper?: string[];
  accept: string;
  formatNote?: string;
  guidance?: React.ReactNode;
  file: File | null;
  disabled?: boolean;
  onTriggerPick: () => void;
  registerInput: (el: HTMLInputElement | null) => void;
  onPick: (f: File) => void;
  onRemove: () => void;
  onView?: () => void;
}

export function DocumentUploadSlot({
  label,
  helper,
  accept,
  formatNote,
  guidance,
  file,
  disabled,
  onTriggerPick,
  registerInput,
  onPick,
  onRemove,
  onView,
}: DocumentUploadSlotProps) {
  return (
    <Card className="h-full justify-between">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold text-[#333333]">
          <FileText className="h-4 w-4 shrink-0 text-[#e02b20]" />
          {label}
        </CardTitle>
        {helper?.map((line) => (
          <p key={line} className="text-xs text-gray-500">
            {line}
          </p>
        ))}
        {guidance}
      </CardHeader>
      <CardContent>
        {formatNote && (
          <p className="mb-2.5 text-xs font-medium text-gray-500">
            {formatNote}
          </p>
        )}
        {!file ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={onTriggerPick}
              disabled={disabled}
              aria-label={`Select ${label}`}
              className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-6 transition-all hover:border-[#e02b20] hover:bg-red-50/20 focus-visible:ring-2 focus-visible:ring-[#e02b20] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#e02b20]">
                <Upload className="h-5 w-5" />
              </div>
              <span className="text-center text-sm font-semibold text-[#333333]">
                Select file
              </span>
              <span className="mt-0.5 text-xs text-gray-500">
                {accept.replace(/\./g, "").toUpperCase()} · No file selected
              </span>
            </button>
            <input
              ref={registerInput}
              type="file"
              accept={accept}
              disabled={disabled}
              aria-label={label}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
              }}
              className="hidden"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-[#e02b20]">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#333333]">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatSize(file.size)}
                  {file.type ? ` · ${file.type}` : ""}
                </p>
              </div>
              <Badge variant="default">Selected · Ready to upload</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {onView && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onView}
                  disabled={disabled}
                  aria-label={`View ${label}`}
                >
                  <Eye className="mr-1 h-4 w-4" /> View
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onTriggerPick}
                disabled={disabled}
                aria-label={`Replace ${label}`}
              >
                <Upload className="mr-1 h-4 w-4" /> Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemove}
                disabled={disabled}
                aria-label={`Remove ${label}`}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <X className="mr-1 h-4 w-4" /> Remove
              </Button>
              <input
                ref={registerInput}
                type="file"
                accept={accept}
                disabled={disabled}
                aria-label={label}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPick(f);
                }}
                className="hidden"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
