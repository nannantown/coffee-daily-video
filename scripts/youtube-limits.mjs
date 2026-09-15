/**
 * YouTube Data API v3 `videos` resource limits
 * (https://developers.google.com/youtube/v3/docs/videos, checked 2026-09-15):
 * snippet.title ≤ 100 characters, snippet.description ≤ 5000 bytes, and
 * neither may contain "<" or ">". A title over the limit fails the whole
 * upload ("invalid or empty video title" — the 2026-09-15 scheduled run).
 */

export const YT_TITLE_MAX = 100;
export const YT_DESCRIPTION_MAX_BYTES = 5000;

const chars = (s) => Array.from(String(s ?? ""));

/** Replace the characters YouTube rejects with their full-width forms. */
export function youtubeSafe(text) {
  return String(text ?? "").replace(/</g, "＜").replace(/>/g, "＞");
}

/**
 * Title = fixed head + variable middle + fixed tail. Only the middle is
 * shortened (ending in "…"), so the title fits 100 characters and the
 * date / #Shorts tail survives.
 */
export function youtubeTitle(head, middle, tail) {
  const h = youtubeSafe(head);
  const t = youtubeSafe(tail);
  const room = Math.max(1, YT_TITLE_MAX - chars(h).length - chars(t).length);
  const m = chars(youtubeSafe(middle));
  const fitted = m.length <= room ? m.join("") : `${m.slice(0, room - 1).join("")}…`;
  return `${h}${fitted}${t}`;
}
