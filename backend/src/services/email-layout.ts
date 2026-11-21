/**
 * Unified EARIST Graduate School Branded Email Layout & URL Resolver.
 *
 * Produces table-based, inline-CSS HTML compatible with Gmail, Outlook,
 * Apple Mail, and testmail.app without relying on external localhost images.
 */

export interface EaristEmailLayoutInput {
  categoryLabel: string;
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

/**
 * Resolves a single canonical public web URL for email links and buttons.
 *
 * Uses APP_PUBLIC_URL when explicitly set; otherwise safely takes the FIRST
 * comma-separated origin from FRONTEND_URL (preventing broken multi-origin CORS
 * strings in links).
 */
export function resolveAppPublicUrl(): string {
  const explicit = process.env.APP_PUBLIC_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const rawFrontend = process.env.FRONTEND_URL?.trim();
  if (rawFrontend) {
    const firstOrigin = rawFrontend
      .split(",")
      .map((part) => part.trim())
      .find((part) => part.length > 0);
    if (firstOrigin) {
      return firstOrigin.replace(/\/+$/, "");
    }
  }

  return "http://localhost:3000";
}

/** Joins the canonical public portal URL with a pathname cleanly. */
export function buildPortalUrl(pathname: string = "/login"): string {
  const base = resolveAppPublicUrl();
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${normalizedPath}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeHref(url: string | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Wraps compiled body HTML in the institutional EARIST Graduate School frame.
 */
export function wrapEaristEmailHtml(input: EaristEmailLayoutInput): string {
  const safeCategory = escapeHtml(input.categoryLabel.toUpperCase());
  const safeTitle = escapeHtml(input.title);
  const safeCtaUrl = sanitizeHref(input.ctaUrl);
  const safeCtaLabel = input.ctaLabel ? escapeHtml(input.ctaLabel) : null;

  const ctaBlock =
    safeCtaUrl && safeCtaLabel
      ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px 0;">
        <tr>
          <td align="center" bgcolor="#8b1e1e" style="border-radius:6px;">
            <a href="${escapeHtml(safeCtaUrl)}" target="_blank" rel="noopener noreferrer"
               style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;">
              ${safeCtaLabel}
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:8px 0 0 0;font-size:12px;line-height:1.5;color:#6b6b6b;word-break:break-all;">
        If the button does not work, open this link in your browser:<br/>
        <a href="${escapeHtml(safeCtaUrl)}" style="color:#8b1e1e;text-decoration:underline;">${escapeHtml(safeCtaUrl)}</a>
      </p>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#222222;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f3ee;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e6e0d6;border-radius:8px;overflow:hidden;">
          <!-- Institutional Header -->
          <tr>
            <td style="background-color:#8b1e1e;padding:22px 28px;border-bottom:4px solid #d4af37;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.2px;color:#f5e6c8;text-transform:uppercase;">
                Eulogio &quot;Amang&quot; Rodriguez Institute of Science and Technology
              </div>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:#ffffff;margin-top:4px;line-height:1.25;">
                Office of the Graduate School
              </div>
            </td>
          </tr>
          <!-- Main Paper Body -->
          <tr>
            <td style="padding:28px 28px 24px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:#2b2b2b;">
              <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#8b1e1e;text-transform:uppercase;margin-bottom:6px;">
                ${safeCategory}
              </div>
              <h1 style="margin:0 0 18px 0;font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.3;font-weight:700;color:#1f1f1f;">
                ${safeTitle}
              </h1>
              <div style="font-size:14px;line-height:1.65;color:#2b2b2b;">
                ${input.bodyHtml}
              </div>
              ${ctaBlock}
              <p style="margin:24px 0 0 0;font-size:14px;line-height:1.6;color:#2b2b2b;">
                Respectfully,<br/>
                <strong>Office of the Graduate School</strong>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#faf8f5;border-top:1px solid #e6e0d6;padding:18px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55;color:#666666;">
              <p style="margin:0 0 6px 0;">
                This is an automated institutional notice from the EARIST Graduate School Information System. Please do not reply directly to this email.
              </p>
              <p style="margin:0;color:#888888;">
                Office of the Graduate School, Nagtahan, Sampaloc, Manila
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Converts rendered HTML into a clean plain-text MIME fallback. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|h4|tr|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&middot;/g, "·")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
