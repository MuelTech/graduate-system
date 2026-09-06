import { NextRequest } from "next/server";
import { auth } from "@/auth";

const ALLOWED_MODEL_TYPES = [
  "cor-upload",
  "thesis-document",
  "rap-report",
  "student-requirement",
  "plagiarism-result",
] as const;

const DOCUMENT_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Disposition": "inline",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  const token = session?.user?.accessToken;

  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;

  // Validate path: must be exactly [modelType, id, "file"]
  if (path.length !== 3 || path[2] !== "file") {
    return Response.json({ error: "Invalid document path" }, { status: 400 });
  }

  const [modelType, id, file] = path;

  if (!ALLOWED_MODEL_TYPES.includes(modelType as (typeof ALLOWED_MODEL_TYPES)[number])) {
    return Response.json({ error: "Unknown document type" }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_API_URL || "http://localhost:5000";
  const targetUrl = `${backendUrl}/api/documents/${modelType}/${id}/${file}`;

  try {
    const response = await fetch(targetUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Stream non-2xx responses as-is so JSON errors from the backend are preserved
    if (!response.ok) {
      return new Response(response.body, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // For successful responses, stream the body and apply safe document headers
    const contentType = response.headers.get("Content-Type") || "application/octet-stream";

    return new Response(response.body, {
      status: response.status,
      headers: {
        ...DOCUMENT_HEADERS,
        "Content-Type": contentType,
      },
    });
  } catch {
    return Response.json(
      { error: "Failed to fetch document from backend" },
      { status: 502 }
    );
  }
}
