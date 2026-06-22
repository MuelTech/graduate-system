import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Award, CheckCircle2, XCircle, Clock } from "lucide-react";

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
    return <div className="text-red-500 p-4">Failed to load journey data. Is the backend running?</div>;
  }

  // We extract the fields directly from the raw Prisma object
  const comprehensiveExamStatus = data.compExamRecords?.[0]?.status || 'NOT_TAKEN';
  const thesisPipeline = data.thesisRecords?.[0] ? {
    currentStage: data.thesisRecords[0].stage,
    status: data.thesisRecords[0].status
  } : null;
  const programName = data.programs?.programName || 'your';

  const getExamBadge = (status: string) => {
    switch (status) {
      case 'PASSED': return <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" /> Passed</Badge>;
      case 'FAILED': return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case 'PENDING': return <Badge className="bg-amber-100 text-amber-700"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-500">Not Taken</Badge>;
    }
  };

  const getThesisStageLabel = (stage: string) => {
    if (!stage) return "Not Started";
    const labels: Record<string, string> = { TITLE: 'Title Defense', PROPOSAL: 'Proposal Defense', FINAL: 'Final Defense' };
    return labels[stage] || stage;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--earist-primary)]" style={{ fontFamily: '"Calibri", sans-serif' }}>
          Academic Journey
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          Welcome back! Here is your current academic progress in the {programName} program.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Comprehensive Exam Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comprehensive Exam</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mt-2 mb-2">
              {comprehensiveExamStatus === 'NOT_TAKEN' ? 'Required' : 'Completed'}
            </div>
            {getExamBadge(comprehensiveExamStatus)}
            <p className="text-xs text-muted-foreground mt-2">
              Must be passed before proceeding to Thesis initialization.
            </p>
          </CardContent>
        </Card>

        {/* Thesis Pipeline Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Thesis Pipeline Stage</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mt-2 mb-2">
              {getThesisStageLabel(thesisPipeline?.currentStage)}
            </div>
            {thesisPipeline ? (
               <Badge className="bg-blue-100 text-blue-700">Status: {thesisPipeline.status}</Badge>
            ) : (
               <Badge className="bg-gray-100 text-gray-500">Awaiting Registration</Badge>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Manage your thesis applications in the Thesis tab.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
