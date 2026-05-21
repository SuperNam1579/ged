const ALLOWED_PROTOCOLS = ["http:", "https:"];

export function safeUrl(url: string | null | undefined): string {
  if (!url) return "#";
  try {
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.includes(parsed.protocol) ? url : "#";
  } catch {
    return "#";
  }
}
