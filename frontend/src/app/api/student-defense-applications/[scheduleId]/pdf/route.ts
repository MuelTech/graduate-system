import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getServerBackendBaseUrl } from "@/lib/backend-origin.server";

/** The backend independently proves Student ownership of the exact schedule. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  const session = await auth();
  const token = session?.user?.accessToken;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "student")
    return Response.json(
      { error: "Student access is required." },
      { status: 403 },
    );
  const { scheduleId } = await params;
  try {
    const response = await fetch(
      `${getServerBackendBaseUrl()}/api/thesis/student/defense/${encodeURIComponent(scheduleId)}/application/pdf`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
    if (!response.ok)
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, no-store",
        },
      });
    if (
      !(response.headers.get("Content-Type") ?? "").includes("application/pdf")
    ) {
      return Response.json(
        { error: "The application PDF is unavailable." },
        { status: 502 },
      );
    }
    return new Response(response.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: "The application PDF could not be retrieved." },
      { status: 502 },
    );
  }
}
