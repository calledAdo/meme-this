/** Prompt and pitch URIs are small JSON documents stored as data: URIs (or https links to the same JSON). */
export type PromptMeta = { title: string; kind?: "news" | "theme" | "freestyle" | "second-chance" | "event"; sources?: string[] };
export type PitchMeta = { image?: string; lore?: string };

const PREFIX = "data:application/json,";

export const encodeMeta = (value: object) => PREFIX + encodeURIComponent(JSON.stringify(value));

export function decodeMeta<T extends object>(uri: string, fallback: T): T {
  try {
    if (uri.startsWith(PREFIX)) return { ...fallback, ...JSON.parse(decodeURIComponent(uri.slice(PREFIX.length))) };
  } catch {}
  return fallback;
}

/** Only allow http(s) images in pitch cards; anything else is dropped. */
export const safeImage = (url?: string) => (url && /^https:\/\//.test(url) ? url : undefined);
