"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { apiClientRequest } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:5000";

const getLobbyTitle = (role: string) => {
  switch (role) {
    case "CHAIRMAN": return "Chairman";
    case "PANELIST": return "Panelist";
    case "ADVISER": return "Thesis Adviser";
    case "RAPPORTEUR": return "Rapporteur";
    case "FACILITATOR": return "Facilitator";
    default: return "Panelist";
  }
};

interface PanelStatus {
  panelId: string;
  userId: string;
  panelistName: string;
  role: string;
  status: string;
}

interface LobbyData {
  studentName: string;
  defenseType: string;
  proposedTitles?: Array<{ id: string; titleText: string; isSelected?: boolean }>;
  rapporteurNotes: string;
  isConcluded: boolean;
  panelStatuses: PanelStatus[];
}

export default function DefenseLobbyPage() {
  const params = useParams();
  const scheduleId = params.scheduleId as string;

  useEffect(() => {
    // Frontend guard
    const role = localStorage.getItem("role") || "";

    if (role !== "PANELIST") {
      window.location.href = "/";
    }
  }, []);

  const [status, setStatus] = useState("Waiting for Panel...");
  const [liveNotes, setLiveNotes] = useState("");
  const [lobbyTitle, setLobbyTitle] = useState("Defense Lobby");
  const [lobby, setLobby] = useState<LobbyData | null>(null); // Store the full lobby data

  // 1. The Polling Mechanism (Every 3 seconds)
  useEffect(() => {
    const fetchLobbyData = async () => {
      try {
        const data = await apiClientRequest(`/thesis/defense/${scheduleId}/lobby`);
        if (data) {
          setLobby(data);

          // Dynamically set the Lobby Title based on the fetched data!
          setLobbyTitle(
            `${data.studentName}'s ${data.defenseType.replace("_", " ")} Lobby`,
          );

          // Update the UI with fresh data from the database
          // Note: If you are actively typing, we don't want to overwrite your cursor,
          // so we would normally add a check here to only update if it's NOT the Rapporteur typing.
          setLiveNotes(data.rapporteurNotes || "");

          if (data.isConcluded) {
            setStatus("Concluded - Generating RAP...");
          }
        }
      } catch (error) {
        console.error("Failed to fetch lobby data:", error);
      }
    };

    // Fetch immediately on load
    fetchLobbyData();

    // Then fetch every 3 seconds
    const intervalId = setInterval(fetchLobbyData, 3000);

    // Cleanup the timer when the user leaves the page
    return () => clearInterval(intervalId);
  }, [scheduleId]);

  // 2. Saving the Notes
  const handleNotesChange = async (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const newText = e.target.value;
    setLiveNotes(newText);

    // We will build this backend API route next!
    // In a production app, you would "debounce" this so it doesn't fire on every single keystroke.
    try {
      await fetch(`${API_URL}/api/defense/${scheduleId}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: newText }),
      });
    } catch (error) {
      console.error("Failed to save notes", error);
    }
  };

  const [defenseOutcome, setDefenseOutcome] = useState<
    "PASSED" | "REVISION" | "FAILED"
  >("PASSED");
  const [selectedTitleId, setSelectedTitleId] = useState("");
  const isTitleDefense =
    lobby?.defenseType === "TITLE_DEFENSE" ||
    lobbyTitle?.toLowerCase().includes("title");
  const proposedTitles = lobby?.proposedTitles ?? [];

  const handleConcludeDefense = async () => {
    if (isTitleDefense && !selectedTitleId) {
      setStatus("Select approved research title first");
      return;
    }
    setStatus("Concluding Defense...");
    try {
      const res = await fetch(`${API_URL}/api/thesis/defense/${scheduleId}/conclude`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({
          outcome: defenseOutcome,
          selectedTitleId: selectedTitleId || null,
        }),
      });

      if (res.ok) {
        setStatus("Concluded - Draft Rapporteur Report opened");
        return;
      }
      const err = await res.json().catch(() => ({}));
      setStatus(err?.error || "Error Concluding");
    } catch (error) {
      console.error("Failed to conclude defense!", error);
      setStatus("Error Concluding");
    }
  };

  const currentUserId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
  
  // Find the logged in user's specific panelist record
  const myPanelistRecord = lobby?.panelStatuses?.find((p: PanelStatus) => p.userId === currentUserId);
  
  // Only the assigned Rapporteur takes and edits live notes
  const canEditNotes = myPanelistRecord?.role === "RAPPORTEUR";

  const rapporteur = lobby?.panelStatuses?.find(
    (p: PanelStatus) => p.role === "RAPPORTEUR",
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* 1. TOP HEADER: Match Info */}
      <header className="bg-card border-b border-border p-4 flex justify-between items-center shadow-sm z-10">
        <div>
          <h1 className="text-2xl font-bold text-primary">{lobbyTitle}</h1>
          <p className="text-sm text-muted-foreground">
            Schedule ID: {scheduleId}
          </p>
        </div>

        <div className="text-center">
          <div className="text-3xl font-mono text-accent">45:12</div>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Live Timer
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm py-1 px-3">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            {status}
          </Badge>
        </div>
      </header>

      {/* LOBBY BATTLEGROUND */}
      <div className="flex-1 flex overflow-hidden">
        {/* 2. LEFT SIDEBAR: Panelist Roster */}
        <aside className="w-72 bg-card border-r border-border p-4 overflow-y-auto">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-4 font-bold">
            The Panel
          </h2>

          <div className="space-y-3">
            {lobby?.panelStatuses?.map((panel: PanelStatus) => (
              <Card key={panel.panelId} className="shadow-sm">
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{panel.panelistName}</p>
                    <p className={`text-xs ${panel.role === "CHAIRMAN" ? "text-primary" : "text-muted-foreground"}`}>
                      {getLobbyTitle(panel.role)}
                    </p>
                  </div>
                  <div
                    className={`h-3 w-3 rounded-full ${panel.status === "Ready" ? "bg-green-500" : "bg-yellow-500"}`}
                    title={panel.status}
                  ></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </aside>

        {/* 3. CENTER CANVAS: The Interactive Zone */}
        <main className="flex-1 p-6 flex flex-col bg-muted/30">
          <Card className="flex-1 flex flex-col overflow-hidden shadow-lg border-primary/20">
            <CardHeader className="border-b border-border p-4 flex flex-col gap-3 bg-card space-y-0">
              <div className="flex flex-row justify-between items-center">
                <CardTitle className="text-lg">Rapporteur Live Notes</CardTitle>
                <Button
                  onClick={handleConcludeDefense}
                  className="bg-primary hover:bg-secondary text-primary-foreground"
                >
                  Conclude Defense
                </Button>
              </div>

              {/* Title Defense conclusion: select approved research title + outcome */}
              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-sm font-semibold">Defense Conclusion</p>
                {isTitleDefense && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Select Approved Research Title
                    </p>
                    <div className="space-y-1">
                      {proposedTitles.map((t) => (
                        <label
                          key={t.id}
                          className="flex items-start gap-2 text-sm"
                        >
                          <input
                            type="radio"
                            name="approvedTitle"
                            value={t.id}
                            checked={selectedTitleId === t.id}
                            onChange={() => setSelectedTitleId(t.id)}
                          />
                          <span>{t.titleText}</span>
                        </label>
                      ))}
                      {proposedTitles.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No proposed titles loaded.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Defense Outcome
                  </p>
                  <select
                    value={defenseOutcome}
                    onChange={(e) =>
                      setDefenseOutcome(
                        e.target.value as "PASSED" | "REVISION" | "FAILED",
                      )
                    }
                    className="w-full rounded-md border border-border px-2 py-1 text-sm"
                  >
                    <option value="PASSED">Passed</option>
                    <option value="REVISION">Revision</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Only PASSED unlocks the next defense stage. RAP opens after
                  formal conclusion. Recording the official outcome requires an
                  authorized concluder (Graduate School Admin until policy is
                  confirmed) — scores alone never pass a defense.
                </p>
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-0">
              <Textarea
                className="w-full h-full min-h-full border-0 focus-visible:ring-0 resize-none font-mono text-sm leading-relaxed p-6 rounded-none bg-background"
                placeholder={canEditNotes ? "Live notes will appear here. Everything typed here will be broadcasted to the panel in real-time..." : "Live notes will appear here..."}
                value={liveNotes}
                onChange={handleNotesChange}
                disabled={!canEditNotes}
              />
            </CardContent>
          </Card>
        </main>

        {/* 4. RIGHT SIDEBAR: Rapporteur/Extra Info */}
        <aside className="w-72 bg-card border-l border-border p-4">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-4 font-bold">
            Rapporteur
          </h2>

          <Card className="shadow-sm">
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">
                  {rapporteur?.panelistName || "Unassigned"}
                </p>
                <p className="text-xs text-secondary">Rapporteur</p>
              </div>
              <div
                className={`h-3 w-3 rounded-full ${
                  rapporteur ? "bg-green-500" : "bg-yellow-500"
                }`}
                title={rapporteur ? "On panel" : "Not assigned"}
              ></div>
            </CardContent>
          </Card>

          <Separator className="my-6" />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              Action Log
            </h3>
            <div className="text-xs text-muted-foreground space-y-2 font-mono">
              <p>[14:02] Defense Started</p>
              <p>[14:15] Prof. Doe began scoring.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
