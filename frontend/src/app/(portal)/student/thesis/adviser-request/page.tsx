"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  UserPlus,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronDown,
  Search,
} from "lucide-react";

export default function AdviserRequestPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [facultyId, setFacultyId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [hasPendingRequest, setHasPendingRequest] = useState<boolean | null>(
    null,
  );

  // Fetch the current journey to see if there is already a pending request
  useEffect(() => {
    if (!session?.user?.accessToken) return;

    const fetchJourney = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/student/journey", {
          headers: { Authorization: `Bearer ${session.user.accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          const pending = data?.adviserRequests?.some(
            (req: { status: string }) => req.status === "PENDING",
          );
          setHasPendingRequest(pending || false);
        } else {
          setHasPendingRequest(false);
        }
      } catch (err) {
        setHasPendingRequest(false);
        console.error("Error:", err);
      }
    };

    fetchJourney();
  }, [session]);

  const [facultyList, setFacultyList] = useState<
    { id: string; firstName: string; lastName: string; title: string | null }[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch available faculty members for the dropdown
  useEffect(() => {
    if (!session?.user?.accessToken) return;
    const fetchFaculty = async () => {
      try {
        const res = await fetch(
          "http://localhost:5000/api/thesis/adviser/available",
          {
            headers: { Authorization: `Bearer ${session.user.accessToken}` },
          },
        );
        if (res.ok) {
          const data = await res.json();
          setFacultyList(data);
        }
      } catch (err) {
        console.error("Failed to fetch faculty list", err);
      }
    };
    fetchFaculty();
  }, [session]);

  // Click-away listener for closing the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredFaculty = facultyList.filter((f) =>
    `${f.firstName} ${f.lastName}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase()),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facultyId) return;

    setStatus("loading");
    try {
      const res = await fetch(
        "http://localhost:5000/api/thesis/adviser/request",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.user?.accessToken}`,
          },
          body: JSON.stringify({
            requestedAdviserId: facultyId.trim(),
            reason: remarks.trim(),
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request");

      setStatus("success");
      // Redirect back to the pipeline after 2 seconds
      setTimeout(() => router.push("/student/thesis"), 2000);
    } catch (err) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unexpected error occurred");
      }
      setStatus("error");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Request Thesis Adviser
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          You must secure an approved faculty adviser before you can apply for
          your Title Defense.
        </p>
      </div>

      {hasPendingRequest === null && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Checking your request status...
          </CardContent>
        </Card>
      )}

      {hasPendingRequest === true && (
        <Card className="border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-amber-900">
              Request Pending Admin Approval
            </h3>
            <p className="text-sm text-amber-700">
              You have already successfully submitted an adviser request. We are
              currently waiting for the admin to approve and formally assign
              your requested faculty member.
            </p>
            <Button
              className="mt-6 bg-amber-600 text-white hover:bg-amber-700"
              onClick={() => router.push("/student/thesis")}
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      )}

      {hasPendingRequest === false && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-(--earist-secondary)">
              <UserPlus className="h-5 w-5" />
              Adviser Selection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {status === "error" && (
                <Alert
                  variant="destructive"
                  className="border-red-200 bg-red-50 text-red-600"
                >
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}

              {status === "success" && (
                <Alert className="border-green-200 bg-green-50 text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Request submitted successfully! The admin must now approve
                    it. Redirecting...
                  </AlertDescription>
                </Alert>
              )}

                            <div className="relative" ref={dropdownRef}>
                <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                  Select Faculty Adviser <span className="text-red-500">*</span>
                </label>
                
                <div
                  className={`flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                    isDropdownOpen ? "border-(--earist-primary) ring-2 ring-(--earist-primary)/20" : "border-(--earist-border-gray)"
                  } ${(status === "loading" || status === "success") ? "opacity-50 pointer-events-none bg-gray-50" : "bg-white"}`}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <span className={facultyId ? "text-gray-900" : "text-gray-400"}>
                    {facultyId 
                      ? (() => {
                          const selected = facultyList.find(f => f.id === facultyId);
                          return selected 
                            ? `${selected.title ? selected.title + ' ' : ''}${selected.firstName} ${selected.lastName}`
                            : "Unknown Adviser";
                        })()
                      : "Search and select a faculty member..."}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                </div>

                {isDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                    <div className="border-b p-2">
                      <div className="flex items-center rounded-md border border-gray-200 bg-gray-50 px-2">
                        <Search className="h-4 w-4 text-gray-400 shrink-0" />
                        <input
                          type="text"
                          autoFocus
                          className="w-full bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-gray-400"
                          placeholder="Search by name..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>
                    <ul className="max-h-60 overflow-y-auto py-1 text-sm scrollbar-thin">
                      {filteredFaculty.length > 0 ? (
                        filteredFaculty.map((faculty) => (
                          <li
                            key={faculty.id}
                            className={`cursor-pointer px-3 py-2 transition-colors hover:bg-(--earist-primary)/10 ${
                              facultyId === faculty.id ? 'bg-(--earist-primary)/5 font-medium text-(--earist-primary)' : 'text-gray-700'
                            }`}
                            onClick={() => {
                              setFacultyId(faculty.id);
                              setIsDropdownOpen(false);
                              setSearchQuery("");
                            }}
                          >
                            {faculty.title ? `${faculty.title} ` : ''}{faculty.firstName} {faculty.lastName}
                          </li>
                        ))
                      ) : (
                        <li className="px-3 py-4 text-center text-gray-500">No faculty members found.</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                  Request Remarks/Research Interest (Optional)
                </label>
                <textarea
                  rows={3}
                  disabled={status === "loading" || status === "success"}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Briefly explain your research interest..."
                  className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                />
              </div>

              <Button
                type="submit"
                disabled={
                  status === "loading" || status === "success" || !facultyId
                }
                className="w-full bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                <Send className="mr-2 h-4 w-4" />
                {status === "loading" ? "Submitting..." : "Send Request"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
