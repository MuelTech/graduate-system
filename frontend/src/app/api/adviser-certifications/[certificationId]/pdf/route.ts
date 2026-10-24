import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getServerBackendBaseUrl } from "@/lib/backend-origin.server";

/** Authenticated inline preview; the backend independently proves exact record access. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ certificationId: string }> }) {
  const token = (await auth())?.user?.accessToken;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { certificationId } = await params;
  try {
    const response = await fetch(`${getServerBackendBaseUrl()}/api/thesis/adviser-certifications/${encodeURIComponent(certificationId)}/pdf`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    if (!response.ok) return new Response(response.body, {
      status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
    });
    if (!(response.headers.get("Content-Type") ?? "").includes("application/pdf")) {
      return Response.json({ error: "The certification PDF is unavailable." }, { status: 502 });
    }
    return new Response(response.body, { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": "inline",
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch { return Response.json({ error: "The certification PDF could not be retrieved." }, { status: 502 }); }
}
