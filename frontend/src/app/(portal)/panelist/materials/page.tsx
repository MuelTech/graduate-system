import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Download,
  Calendar,
  FolderOpen,
} from "lucide-react";

export default function PanelistMaterialsPage() {
  const defenseMaterials = [
    {
      defenseId: 1,
      stage: "Final Defense",
      researcher: "Maria Santos",
      program: "MSCS",
      date: "June 10, 2026",
      status: "upcoming",
      material: {
        name: "Complete Manuscript (Chapters 1–5)",
        type: "pdf",
        size: "2.4 MB",
        uploadDate: "June 1, 2026",
      },
    },
    {
      defenseId: 2,
      stage: "Proposal Defense",
      researcher: "Juan Dela Cruz",
      program: "MSCS",
      date: "June 12, 2026",
      status: "upcoming",
      material: {
        name: "Manuscript (Chapters 1–3)",
        type: "pdf",
        size: "1.8 MB",
        uploadDate: "June 5, 2026",
      },
    },
    {
      defenseId: 3,
      stage: "Title Defense",
      researcher: "Ana Garcia",
      program: "MIT",
      date: "June 15, 2026",
      status: "upcoming",
      material: {
        name: "Proposed Research Titles",
        type: "pdf",
        size: "156 KB",
        uploadDate: "June 8, 2026",
      },
    },
    {
      defenseId: 4,
      stage: "Final Defense",
      researcher: "Carlos Luna",
      program: "MAED",
      date: "May 28, 2026",
      status: "completed",
      material: {
        name: "Complete Manuscript (Chapters 1–5)",
        type: "pdf",
        size: "3.1 MB",
        uploadDate: "May 20, 2026",
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-[var(--earist-primary)]"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Defense Materials
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          Access research documents for your assigned defenses
        </p>
      </div>

      {/* Materials by Defense */}
      <div className="space-y-4">
        {defenseMaterials.map((defense) => (
          <Card key={defense.defenseId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      defense.status === "upcoming"
                        ? "bg-blue-50"
                        : "bg-green-50"
                    }`}
                  >
                    <FileText
                      className={`h-4 w-4 ${
                        defense.status === "upcoming"
                          ? "text-blue-600"
                          : "text-green-600"
                      }`}
                    />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                      {defense.stage}
                    </CardTitle>
                    <p className="text-xs text-[var(--earist-body-text)]">
                      {defense.researcher} &middot; {defense.program}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    className={
                      defense.status === "upcoming"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }
                  >
                    {defense.status === "upcoming" ? "Upcoming" : "Completed"}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-[var(--earist-body-text)]">
                    <Calendar className="h-3 w-3" />
                    {defense.date}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 rounded-lg border border-[var(--earist-border-gray)] p-3 transition-colors hover:bg-[var(--earist-surface-gray)]">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-red-50">
                  <FileText className="h-4 w-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--earist-primary)] truncate">
                    {defense.material.name}
                  </p>
                  <p className="text-xs text-[var(--earist-body-text)]">
                    {defense.material.size} &middot; Uploaded{" "}
                    {defense.material.uploadDate}
                  </p>
                </div>
                <a
                  href="#"
                  className="flex items-center gap-1 rounded-lg border border-[var(--earist-border-gray)] px-3 py-1.5 text-xs font-semibold text-[var(--earist-body-text)] transition-colors hover:bg-white hover:text-[var(--earist-primary)]"
                >
                  <Download className="h-3 w-3" />
                  View
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {defenseMaterials.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--earist-surface-gray)]">
                <FolderOpen className="h-8 w-8 text-[var(--earist-body-text)]/40" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-[var(--earist-primary)]">
                No Materials Available
              </h3>
              <p className="text-sm text-[var(--earist-body-text)]">
                Defense materials will appear here once uploaded by the
                researcher.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
