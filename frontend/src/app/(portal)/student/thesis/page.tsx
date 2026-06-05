import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Lock,
  Clock,
  ArrowRight,
  FileText,
  Users,
  ExternalLink,
  Download,
  AlertCircle,
} from "lucide-react";

export default function ThesisPipelinePage() {
  const stages = [
    {
      key: "title_defense",
      label: "Title Defense",
      href: "/student/thesis/title-defense",
      status: "completed" as
        | "locked"
        | "ready"
        | "pending"
        | "approved"
        | "completed"
        | "rap_signed",
      lastAction: "May 28, 2026",
      requirements: [
        { name: "Certificate of Comprehensive Exam", met: true },
        { name: "COR (Current Semester)", met: true },
        { name: "Application for Defense", met: true },
        { name: "Three Proposed Titles", met: true },
      ],
      appliedTitles: [
        "Machine Learning Approaches for Early Detection of Student Academic Risk",
        "Deep Learning Framework for Automated Thesis Document Analysis",
        "NLP-Based Chatbot System for Graduate School Student Support",
      ],
      selectedTitle:
        "Machine Learning Approaches for Early Detection of Student Academic Risk",
      panel: [
        { name: "Dr. Roberto Reyes", role: "Chairperson" },
        { name: "Dr. Maria Santos", role: "Member" },
        { name: "Dr. Juan Dela Cruz", role: "Member" },
      ],
      rapStatus: "signed" as "pending" | "distributed" | "signed",
    },
    {
      key: "proposal_defense",
      label: "Proposal Defense",
      href: "/student/thesis/proposal-defense",
      status: "pending" as
        | "locked"
        | "ready"
        | "pending"
        | "approved"
        | "completed"
        | "rap_signed",
      lastAction: "May 30, 2026",
      requirements: [
        { name: "COR (Current Semester)", met: true },
        { name: "Application + Payment", met: true },
        { name: "Adviser Certification", met: true },
        { name: "Approved RAP from Title Defense", met: true },
        { name: "Approved Research Variables", met: true },
      ],
      appliedTitles: null,
      selectedTitle: null,
      panel: null,
      teamsLink: null,
      rapStatus: null,
    },
    {
      key: "final_defense",
      label: "Final Defense",
      href: "/student/thesis/final-defense",
      status: "locked" as
        | "locked"
        | "ready"
        | "pending"
        | "approved"
        | "completed"
        | "rap_signed",
      lastAction: null,
      requirements: [
        { name: "COR (Current Semester)", met: false },
        { name: "Application + Payment", met: false },
        { name: "Adviser Certification", met: false },
        { name: "Approved Proposal RAP", met: false },
        { name: "Research Instruments", met: false },
        { name: "Statistician Certification", met: false },
        { name: "7 Manuscript Copies", met: false },
        { name: "STRIKE Report (< 20%)", met: false },
      ],
      appliedTitles: null,
      selectedTitle: null,
      panel: null,
      teamsLink: null,
      rapStatus: null,
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "locked":
        return (
          <Badge className="bg-gray-100 text-gray-500">
            <Lock className="mr-1 h-3 w-3" />
            Locked
          </Badge>
        );
      case "ready":
        return (
          <Badge className="bg-blue-100 text-blue-700">
            Ready to Apply
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-700">
            <Clock className="mr-1 h-3 w-3" />
            Application Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-blue-100 text-blue-700">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Approved / Scheduled
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Defense Completed
          </Badge>
        );
      case "rap_signed":
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            RAP Signed
          </Badge>
        );
      default:
        return null;
    }
  };

  const getRapBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-700">
            <Clock className="mr-1 h-3 w-3" />
            RAP Pending
          </Badge>
        );
      case "distributed":
        return (
          <Badge className="bg-blue-100 text-blue-700">
            RAP Distributed
          </Badge>
        );
      case "signed":
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            RAP Signed
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-[var(--earist-primary)]"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Thesis Pipeline
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          Overview of your defense stages — Title, Proposal, and Final Defense
        </p>
      </div>

      {/* Pipeline Stage Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {stages.map((stage) => {
          const isLocked = stage.status === "locked";
          const requirementsMet = stage.requirements.every((r) => r.met);

          return (
            <Card
              key={stage.key}
              className={isLocked ? "opacity-60" : ""}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                    {stage.label}
                  </CardTitle>
                  {getStatusBadge(stage.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Last Action */}
                  {stage.lastAction && (
                    <p className="text-xs text-[var(--earist-body-text)]">
                      Last action: {stage.lastAction}
                    </p>
                  )}

                  {/* Requirements Gate */}
                  <div>
                    <p className="mb-2 text-xs font-semibold text-[var(--earist-secondary)]">
                      Requirements
                    </p>
                    <div className="space-y-1.5">
                      {stage.requirements.map((req, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2"
                        >
                          {req.met ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                          ) : (
                            <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          )}
                          <span
                            className={`text-xs ${
                              req.met
                                ? "text-[var(--earist-body-text)]"
                                : "text-gray-400"
                            }`}
                          >
                            {req.name}
                          </span>
                        </div>
                      ))}
                    </div>
                    {!isLocked && !requirementsMet && (
                      <div className="mt-2 flex items-start gap-1.5 rounded bg-amber-50 p-2">
                        <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                        <p className="text-[11px] text-amber-700">
                          Complete all requirements to proceed.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Applied Titles Display */}
                  {stage.appliedTitles && (
                    <div>
                      <p className="mb-2 text-xs font-semibold text-[var(--earist-secondary)]">
                        Proposed Titles
                      </p>
                      <div className="space-y-1">
                        {stage.appliedTitles.map((title, i) => (
                          <p
                            key={i}
                            className={`text-xs ${
                              title === stage.selectedTitle
                                ? "font-semibold text-[var(--earist-primary)]"
                                : "text-[var(--earist-body-text)]"
                            }`}
                          >
                            {title === stage.selectedTitle && "→ "}
                            {i + 1}. {title}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Panel Display */}
                  {stage.panel && (
                    <div>
                      <p className="mb-2 text-xs font-semibold text-[var(--earist-secondary)]">
                        Panel Members
                      </p>
                      <div className="space-y-1">
                        {stage.panel.map((member, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2"
                          >
                            <Users className="h-3 w-3 text-[var(--earist-body-text)]" />
                            <span className="text-xs text-[var(--earist-body-text)]">
                              {member.name}{" "}
                              <span className="text-[11px] text-gray-400">
                                ({member.role})
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* MS Teams Link */}
                  {stage.teamsLink && (
                    <a
                      href={stage.teamsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--earist-secondary)] transition-colors hover:text-[var(--earist-primary)]"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Join Defense Meeting
                    </a>
                  )}

                  {/* RAP Report Status */}
                  {stage.rapStatus && (
                    <div className="flex items-center justify-between">
                      {getRapBadge(stage.rapStatus)}
                      {stage.rapStatus === "signed" && (
                        <button className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--earist-secondary)] transition-colors hover:text-[var(--earist-primary)]">
                          <Download className="h-3 w-3" />
                          Student Copy
                        </button>
                      )}
                    </div>
                  )}

                  {/* Action Link */}
                  <div className="border-t border-[var(--earist-border-gray)] pt-3">
                    <Link
                      href={stage.href}
                      className={`inline-flex items-center gap-1 text-sm font-semibold transition-colors ${
                        isLocked
                          ? "cursor-not-allowed text-gray-400"
                          : "text-[var(--earist-secondary)] hover:text-[var(--earist-primary)]"
                      }`}
                    >
                      {isLocked ? (
                        <>
                          <Lock className="h-3 w-3" />
                          Locked
                        </>
                      ) : stage.status === "completed" ||
                        stage.status === "rap_signed" ? (
                        <>
                          View Details <ArrowRight className="h-3 w-3" />
                        </>
                      ) : (
                        <>
                          Apply / View Details{" "}
                          <ArrowRight className="h-3 w-3" />
                        </>
                      )}
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
