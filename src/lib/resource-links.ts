/**
 * Resource Link Utilities
 *
 * URL validation, domain whitelist, preview URL normalization,
 * and link status verification.
 */

export const WHITELISTED_DOMAINS = [
  "drive.google.com",
  "docs.google.com",
  "dropbox.com",
  "www.dropbox.com",
  "onedrive.live.com",
  "figma.com",
  "www.figma.com",
  "canva.com",
  "www.canva.com",
  "github.com",
  "gitlab.com",
  "notion.so",
  "www.notion.so",
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
] as const;

const BLOCKED_SCHEMES = ["javascript:", "data:", "file:", "vbscript:", "ftp:"];

export const LINK_STATUSES = ["ACTIVE", "INACCESSIBLE", "RESTRICTED", "UNKNOWN"] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];

export function validateResourceUrl(rawUrl: string): {
  valid: boolean;
  url?: string;
  domain?: string;
  error?: string;
} {
  const trimmed = rawUrl.trim();

  const lower = trimmed.toLowerCase();
  for (const scheme of BLOCKED_SCHEMES) {
    if (lower.startsWith(scheme)) {
      return { valid: false, error: `Esquema "${scheme}" no permitido.` };
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "URL inválida." };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, error: "Solo se permiten URLs HTTPS." };
  }

  return {
    valid: true,
    url: parsed.href,
    domain: parsed.hostname,
  };
}

export function isWhitelistedDomain(domain: string): boolean {
  return WHITELISTED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export function generatePreviewUrl(url: string, domain: string): string | null {
  try {
    const parsed = new URL(url);

    if (domain === "drive.google.com" && parsed.pathname.includes("/file/d/")) {
      const match = parsed.pathname.match(/\/file\/d\/([^/]+)/);
      if (match) {
        return `https://drive.google.com/file/d/${match[1]}/preview`;
      }
    }

    if (domain === "docs.google.com") {
      if (parsed.pathname.includes("/document/d/")) {
        const docId = parsed.pathname.match(/\/document\/d\/([^/]+)/)?.[1];
        if (docId) return `https://docs.google.com/document/d/${docId}/preview`;
      }
      if (parsed.pathname.includes("/spreadsheets/d/")) {
        const sheetId = parsed.pathname.match(/\/spreadsheets\/d\/([^/]+)/)?.[1];
        if (sheetId) return `https://docs.google.com/spreadsheets/d/${sheetId}/preview`;
      }
      if (parsed.pathname.includes("/presentation/d/")) {
        const slideId = parsed.pathname.match(/\/presentation\/d\/([^/]+)/)?.[1];
        if (slideId) return `https://docs.google.com/presentation/d/${slideId}/preview`;
      }
    }

    if (domain === "figma.com" || domain === "www.figma.com") {
      return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`;
    }

    if (domain === "youtube.com" || domain === "www.youtube.com") {
      const videoId = parsed.searchParams.get("v");
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }

    if (domain === "youtu.be") {
      const videoId = parsed.pathname.slice(1);
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }

    if (domain === "canva.com" || domain === "www.canva.com") {
      if (parsed.pathname.includes("/design/")) {
        return `${url}${url.includes("?") ? "&" : "?"}embed`;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function getDomainIcon(domain: string): string {
  if (domain.includes("google.com")) return "file-text";
  if (domain.includes("drive.google.com")) return "hard-drive";
  if (domain.includes("figma.com")) return "palette";
  if (domain.includes("github.com")) return "github";
  if (domain.includes("gitlab.com")) return "git-branch";
  if (domain.includes("youtube.com") || domain.includes("youtu.be")) return "video";
  if (domain.includes("dropbox.com")) return "cloud";
  if (domain.includes("notion.so")) return "book-open";
  if (domain.includes("canva.com")) return "image";
  return "link";
}

export async function checkLinkHealth(url: string): Promise<LinkStatus> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (response.ok) return "ACTIVE";
    if (response.status === 401 || response.status === 403) return "RESTRICTED";
    return "INACCESSIBLE";
  } catch {
    return "UNKNOWN";
  }
}
