"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  FileWarning,
  HardDrive,
  RefreshCw,
  Server,
  ShieldAlert,
} from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";
import type {
  IntegrityScanResult,
  StorageHealth,
} from "@/types/storage-health";

/**
 * DL-11: read-only Admin storage health + integrity diagnostics.
 *
 * Detect / report / diagnose only. There is deliberately no delete, repair,
 * move, rename, checksum-rewrite, or backfill control.
 */

function formatBytes(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(1)} ${units[unit]}`;
}

function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function AdminStorageHealthPage() {
  const queryClient = useQueryClient();
  const [scanResult, setScanResult] = useState<IntegrityScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["storage-health"],
    queryFn: async () =>
      (await apiClientRequest("/admin/storage/health")) as StorageHealth,
  });

  const scanMutation = useMutation({
    mutationFn: async () =>
      (await apiClientRequest("/admin/storage/integrity-scan", {
        method: "POST",
      })) as IntegrityScanResult,
    onSuccess: (result) => {
      setScanError(null);
      setScanResult(result);
      queryClient.invalidateQueries({ queryKey: ["storage-health"] });
    },
    onError: (error: Error) => {
      setScanError(error.message || "Integrity scan could not be completed.");
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading storage health…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8 text-center text-sm text-red-600">
        Unable to load storage health. Please try again.
      </div>
    );
  }

  const { capacity, temp, references, uploadTelemetry, backup } = data;
  const lastScan = scanResult ?? data.lastIntegrityScan;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            className="text-2xl font-bold text-(--earist-primary)"
            style={{ fontFamily: '"Calibri", sans-serif' }}
          >
            Storage Health
          </h2>
          <p className="text-sm text-(--earist-body-text)">
            Read-only operational visibility into private document storage.
            Diagnostics never delete, repair, or move files.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${scanMutation.isPending ? "animate-spin" : ""}`}
            />
            {scanMutation.isPending ? "Scanning…" : "Run Integrity Scan"}
          </Button>
          <p className="max-w-xs text-right text-[11px] text-(--earist-body-text)">
            This operation reads storage and metadata only. It does not delete or
            repair files.
          </p>
        </div>
      </div>

      {scanError && (
        <Card>
          <CardContent className="flex items-center gap-2 py-3 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" />
            {scanError}
          </CardContent>
        </Card>
      )}

      {/* Capacity + managed objects */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-(--earist-body-text)">
              <Database className="h-4 w-4" /> Managed objects
            </div>
            <p className="mt-1 text-lg font-bold text-(--earist-primary)">
              {data.managedObjects.count}
            </p>
            <p className="text-xs text-(--earist-body-text)">
              {formatBytes(data.managedObjects.totalBytes)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-(--earist-body-text)">
              <HardDrive className="h-4 w-4" /> Free disk space
            </div>
            <p className="mt-1 text-lg font-bold text-(--earist-primary)">
              {capacity.available ? formatBytes(capacity.freeBytes) : "Unavailable"}
            </p>
            <p className="text-xs text-(--earist-body-text)">
              {capacity.available
                ? `${formatPercent(capacity.freePercent)} free`
                : "Capacity API unavailable on this platform"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-(--earist-body-text)">
              <Server className="h-4 w-4" /> Capacity threshold
            </div>
            <p className="mt-1 text-sm font-semibold text-(--earist-body-text)">
              {capacity.minimumFreePercent === null
                ? "Not configured"
                : `Min ${capacity.minimumFreePercent}% free`}
            </p>
            <div className="mt-1">
              {capacity.pressure === null ? (
                <Badge className="bg-gray-100 text-gray-600">Unclassified</Badge>
              ) : capacity.pressure ? (
                <Badge className="bg-amber-100 text-amber-700">
                  <AlertTriangle className="mr-1 h-3 w-3" /> Under pressure
                </Badge>
              ) : (
                <Badge className="bg-green-100 text-green-700">Within threshold</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-(--earist-body-text)">
              <Activity className="h-4 w-4" /> Provider
            </div>
            <p className="mt-1 text-lg font-bold text-(--earist-primary)">
              {data.provider}
            </p>
            <p className="text-xs text-(--earist-body-text)">
              Unclassified legacy files: {data.legacyOrUnclassified.count} (
              {formatBytes(data.legacyOrUnclassified.totalBytes)})
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Temporary uploads */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-(--earist-secondary)">
              <Clock className="h-4 w-4" /> Temporary uploads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-(--earist-body-text)">Request dirs</span>
              <span className="text-right font-medium">{temp.requestDirectories}</span>
              <span className="text-(--earist-body-text)">Files</span>
              <span className="text-right font-medium">{temp.fileCount}</span>
              <span className="text-(--earist-body-text)">Bytes</span>
              <span className="text-right font-medium">{formatBytes(temp.totalBytes)}</span>
              <span className="text-(--earist-body-text)">Stale files</span>
              <span className="text-right font-medium">{temp.staleFiles}</span>
              <span className="text-(--earist-body-text)">Stale request dirs</span>
              <span className="text-right font-medium">
                {temp.staleRequestDirectories}
              </span>
              <span className="text-(--earist-body-text)">Oldest</span>
              <span className="text-right font-medium">
                {formatDate(temp.oldestModifiedAt)}
              </span>
            </div>
            {temp.unsafeRootDetected && (
              <p className="flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                The temporary storage root is a symlink or failed containment
                and was not traversed. No paths are shown.
              </p>
            )}
            <p className="rounded-lg bg-(--earist-surface-gray) p-2 text-xs text-(--earist-body-text)">
              “Stale” means older than {temp.thresholdHours}h by diagnostic
              threshold only — it is not deletion authority.
            </p>
          </CardContent>
        </Card>

        {/* References */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-(--earist-secondary)">
              <Database className="h-4 w-4" /> Managed references
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-(--earist-body-text)">COR (managed)</span>
              <span className="text-right font-medium">{references.managedCorUploads}</span>
              <span className="text-(--earist-body-text)">Thesis documents (managed)</span>
              <span className="text-right font-medium">
                {references.managedThesisDocuments}
              </span>
              <span className="text-(--earist-body-text)">COR (legacy path)</span>
              <span className="text-right font-medium">{references.legacyCorUploads}</span>
              <span className="text-(--earist-body-text)">Thesis docs (legacy path)</span>
              <span className="text-right font-medium">
                {references.legacyThesisDocuments}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Upload telemetry */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-(--earist-secondary)">
              <Activity className="h-4 w-4" /> Upload pipeline failures since
              process start
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-xs text-(--earist-body-text)">
              Scope: process-local pipeline telemetry. Resets when the backend
              restarts. This is not historical business audit data.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-(--earist-body-text)">Attempts</span>
              <span className="text-right font-medium">{uploadTelemetry.attempts}</span>
              <span className="text-(--earist-body-text)">Successes</span>
              <span className="text-right font-medium">{uploadTelemetry.successes}</span>
              <span className="text-(--earist-body-text)">Failures</span>
              <span className="text-right font-medium">{uploadTelemetry.failures}</span>
            </div>
            {uploadTelemetry.recentFailures.length === 0 ? (
              <p className="text-xs text-(--earist-body-text)">
                No pipeline failures since process start.
              </p>
            ) : (
              <ul className="space-y-1 text-xs">
                {uploadTelemetry.recentFailures
                  .slice()
                  .reverse()
                  .map((event, index) => (
                    <li
                      key={`${event.timestamp}-${index}`}
                      className="flex items-center justify-between rounded bg-(--earist-surface-gray) px-2 py-1"
                    >
                      <span className="font-medium">{event.stage}</span>
                      <span className="text-(--earist-body-text)">
                        {event.statusClass ?? "—"} · {formatDate(event.timestamp)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
            <p className="text-[11px] text-(--earist-body-text)">
              Started {formatDate(uploadTelemetry.startedAt)}
            </p>
          </CardContent>
        </Card>

        {/* Backup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-(--earist-secondary)">
              <ShieldAlert className="h-4 w-4" /> Backup status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge className="bg-gray-100 text-gray-600">{backup.status}</Badge>
            </div>
            <p className="text-xs text-(--earist-body-text)">
              No trustworthy backup-status integration is configured. This
              surface does not claim a backup ran or failed.
            </p>
            <p className="text-xs text-(--earist-body-text)">
              Operations procedure:{" "}
              <span className="font-medium">
                docs/operations/storage-backup-restore.md
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Integrity scan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-(--earist-secondary)">
            <FileWarning className="h-4 w-4" /> Integrity scan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!lastScan ? (
            <p className="flex items-center gap-2 text-(--earist-body-text)">
              <AlertTriangle className="h-4 w-4" />
              No integrity scan run in this process.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 text-xs text-(--earist-body-text)">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Started{" "}
                  {formatDate(lastScan.startedAt)}
                </span>
                <span>Completed {formatDate(lastScan.completedAt)}</span>
                <span>Duration {lastScan.durationMs} ms</span>
                <span>Total issues {lastScan.totalIssues}</span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(lastScan.summary).map(([type, count]) => (
                  <div
                    key={type}
                    className="flex items-center justify-between rounded border border-(--earist-border-gray) px-3 py-2"
                  >
                    <span className="text-xs text-(--earist-body-text)">
                      {type}
                    </span>
                    <span
                      className={`text-sm font-semibold ${count > 0 ? "text-amber-600" : "text-green-600"}`}
                    >
                      {count}
                    </span>
                  </div>
                ))}
              </div>

              {scanResult && scanResult.issues.length > 0 && (
                <div className="space-y-2">
                  <div className="overflow-x-auto rounded-lg border border-(--earist-border-gray)">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-(--earist-surface-gray) text-(--earist-secondary)">
                        <tr>
                          <th className="px-3 py-2">Issue</th>
                          <th className="px-3 py-2">Source</th>
                          <th className="px-3 py-2">Record</th>
                          <th className="px-3 py-2">Context</th>
                          <th className="px-3 py-2">Sizes</th>
                          <th className="px-3 py-2">Fingerprint</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scanResult.issues.map((issue, index) => (
                          <tr
                            key={`${issue.issueType}-${issue.recordId ?? index}`}
                            className="border-t border-(--earist-border-gray)"
                          >
                            <td className="px-3 py-2 font-medium">
                              {issue.issueType}
                            </td>
                            <td className="px-3 py-2">{issue.source}</td>
                            <td className="px-3 py-2">
                              {issue.recordId ?? "—"}
                            </td>
                            <td className="px-3 py-2">
                              {[issue.docType, issue.defenseStage, issue.namespace]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </td>
                            <td className="px-3 py-2">
                              {issue.expectedSize ?? issue.actualSize
                                ? `${formatBytes(issue.expectedSize)} / ${formatBytes(issue.actualSize)}`
                                : "—"}
                            </td>
                            <td className="px-3 py-2 font-mono">
                              {issue.objectFingerprint ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {scanResult.issuesTruncated && (
                    <p className="text-xs text-amber-700">
                      Showing {scanResult.issuesReturned} of{" "}
                      {scanResult.totalIssues} issues. Additional issues are not
                      displayed; totals above are complete.
                    </p>
                  )}
                </div>
              )}

              {scanResult && scanResult.issues.length === 0 && (
                <p className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-4 w-4" /> No issues detected in this
                  scan.
                </p>
              )}
            </>
          )}
          <p className="rounded-lg bg-(--earist-surface-gray) p-2 text-xs text-(--earist-body-text)">
            Detected conditions (orphans, stale temp, checksum mismatches) require
            review. None of them is automatically safe to delete, and this screen
            cannot repair or delete anything.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
