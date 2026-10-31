const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;",
};

/** Escapes text for safe use in HTML content and attribute values. */
export const escapeHtml = (value: string): string => value.replace(/[&<>"'`]/g, (c) => ENTITIES[c] ?? c);

/** Allows only http(s) and mailto links; anything else (e.g. `javascript:`) becomes `#`. */
export const safeUrl = (value: string): string => {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? trimmed : "#";
  } catch {
    return "#";
  }
};

/** Removes CR/LF so a value can never inject extra e-mail headers. */
export const stripNewlines = (value: string): string => value.replace(/[\r\n]+/g, " ").trim();
