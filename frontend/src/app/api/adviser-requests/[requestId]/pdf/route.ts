import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getServerBackendBaseUrl } from "@/lib/backend-origin.server";

/** Authenticated inline preview; exact ownership is independently enforced by the backend. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  const token = (await auth())?.user?.accessToken;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  const { requestId } = await params;
  try {
    const response = await fetch(`${getServerBackendBaseUrl()}/api/thesis/adviser/requests/${encodeURIComponent(requestId)}/pdf`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    if (!response.ok) return new Response(response.body, {
      status: response.status, headers: { ...headers, "Content-Type": "application/json" },
    });
    if (!(response.headers.get("Content-Type") ?? "").includes("application/pdf")) {
      return Response.json({ error: "The Adviser Request PDF is unavailable." }, { status: 502, headers });
    }
    return new Response(response.body, { headers: {
      ...headers, "Content-Type": "application/pdf", "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff",
    } });
  } catch { return Response.json({ error: "The Adviser Request could not be retrieved." }, { status: 502, headers }); }
}
