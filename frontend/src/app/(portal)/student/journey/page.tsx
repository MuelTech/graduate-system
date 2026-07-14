import { auth } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Award, CheckCircle2, XCircle, Clock, GraduationCap, Users } from "lucide-react";

async function getJourneyData(token: string) {
  const res = await fetch("http://localhost:5000/api/student/journey", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store", // Always fetch fresh data
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function StudentJourneyPage() {
  const session = await auth();
  const data = await getJourneyData(session?.user?.accessToken || "");

  if (!data) {
    return (
      <div className="p-4 text-red-500">
        Failed to load journey data. Is the backend running?
      </div>
    );
  }

  // We extract the fields directly from the raw Prisma object
  const comprehensiveExamStatus =
    data.compExamRecords?.[0]?.status || "NOT_TAKEN";
  const thesisPipeline = data.thesisRecords?.[0]
    ? {
        currentStage: data.thesisRecords[0].stage,
        status: data.thesisRecords[0].status,
      }
    : null;
  const programName = data.programs?.programName || "your";

  const getExamBadge = (status: string) => {
    switch (status) {
      case "PASSED":
      case "APPROVED":
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Passed
          </Badge>
        );
      case "FAILED":
        return (
          <Badge className="bg-red-100 text-red-700">
            <XCircle className="mr-1 h-3 w-3" /> Failed
          </Badge>
        );
      case "PENDING":
        return (
          <Badge className="bg-amber-100 text-amber-700">
            <Clock className="mr-1 h-3 w-3" /> Pending
          </Badge>
        );
      case "SCHEDULED":
        return (
          <Badge className="bg-amber-100 text-amber-700">
            <Clock className="mr-1 h-3 w-3" /> Scheduled
          </Badge>
        );
      case "READY":
        return (
          <Badge className="bg-blue-100 text-blue-700">
            Action Required
          </Badge>
        );
      default:
        return <Badge className="bg-gray-100 text-gray-500">Not Taken</Badge>;
    }
  };


  const getThesisStepStatus = (targetStage: string) => {
    if (!thesisPipeline?.currentStage) return "NOT_TAKEN";

    const stageOrder = ["TITLE", "PROPOSAL", "FINAL"];
    const currentIndex = stageOrder.indexOf(thesisPipeline.currentStage);
    const targetIndex = stageOrder.indexOf(targetStage);

    if (targetIndex < currentIndex) return "PASSED"; // Past stages are implicitly passed
    
    if (targetIndex === currentIndex) {
      if (thesisPipeline.status === "PASSED" || thesisPipeline.status === "APPROVED") {
        return "PASSED";
      }
      return thesisPipeline.status || "PENDING";
    }

    // If we are looking at the immediate next stage, and the current stage is passed, it is READY
    if (targetIndex === currentIndex + 1) {
      if (thesisPipeline.status === "PASSED" || thesisPipeline.status === "APPROVED") {
        return "READY";
      }
    }

    return "NOT_TAKEN"; // Future stages
  };

  const steps = [
    {
      title: "Admissions & Enrollment",
      description: "Successfully admitted and enrolled in the program.",
      status: "PASSED",
      icon: GraduationCap,
    },
    {
      title: "Comprehensive Examination",
      description: "Must be passed to proceed to thesis initialization.",
      status: comprehensiveExamStatus,
      icon: BookOpen,
    },
    {
      title: "Thesis Adviser Assignment",
      description: "Request and get assigned an official thesis adviser.",
      status: data.adviserAssignments?.length > 0 
        ? "PASSED" 
        : (comprehensiveExamStatus === "PASSED" ? "NOT_TAKEN" : "NOT_TAKEN"),
      icon: Users,
    },
    {
      title: "Title Defense",
      description: "Submit proposed titles and defend your concept paper.",
      status: getThesisStepStatus("TITLE"),
      icon: CheckCircle2,
    },
    {
      title: "Proposal Defense",
      description: "Submit and defend Chapters 1-3 of your manuscript.",
      status: getThesisStepStatus("PROPOSAL"),
      icon: BookOpen,
    },
    {
      title: "Final Defense",
      description: "Defend your final, complete manuscript.",
      status: getThesisStepStatus("FINAL"),
      icon: Award,
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Academic Journey
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Welcome back! Here is your current academic progress in the{" "}
          {programName} program.
        </p>
      </div>

      <div className="relative ml-4 mt-8 border-l-2 border-(--earist-border-gray) pb-4 md:ml-6">
        <div className="space-y-8">
          {steps.map((step, i) => {
            const isPassed = step.status === "PASSED" || step.status === "APPROVED";
            const isActive = step.status === "PENDING" || step.status === "SCHEDULED";
            const isReady = step.status === "READY";
            const isFailed = step.status === "FAILED";
            const isFuture = step.status === "NOT_TAKEN";

            const Icon = step.icon;

            let iconBg = "bg-gray-100 border-gray-300 text-gray-400";
            let titleColor = "text-gray-500";

            if (isPassed) {
              iconBg = "bg-green-100 border-green-500 text-green-600";
              titleColor = "text-gray-900";
            } else if (isActive) {
              iconBg = "bg-amber-100 border-amber-500 text-amber-600";
              titleColor = "text-gray-900";
            } else if (isFailed) {
              iconBg = "bg-red-100 border-red-500 text-red-600";
              titleColor = "text-gray-900";
            } else if (isReady) {
              iconBg = "bg-blue-100 border-blue-500 text-blue-600";
              titleColor = "text-gray-900";
            }

            return (
              <div key={i} className="relative pl-8 md:pl-12">
                {/* Timeline Node */}
                <div
                  className={`absolute -left-4.25 top-2 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white ${iconBg}`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                {/* Content Card */}
                <Card className={`transition-all ${isFuture ? "opacity-60 grayscale" : "shadow-sm hover:shadow-md"}`}>
                  <CardContent className="flex flex-col justify-between gap-4 p-4 md:flex-row md:items-center">
                    <div>
                      <h3 className={`font-semibold ${titleColor}`}>
                        {step.title}
                      </h3>
                      <p className="mt-1 text-xs text-gray-500">
                        {step.description}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {getExamBadge(step.status)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
