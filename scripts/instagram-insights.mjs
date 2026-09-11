/**
 * Instagram Reels insights for performance-history.json.
 *
 * Used by fetch-stats.mjs (non-blocking step). For every history entry it:
 *   1. Uses `video.instagram.mediaId` when record-upload.mjs stored it, or
 *   2. Restores the mediaId by matching the entry's JST date against
 *      GET /{ig-user-id}/media (REELS only). Unmatchable → `instagram: null`
 *      and the reason is logged.
 *   3. Fetches GET /{ig-media-id}/insights for recent entries (and any entry
 *      never fetched yet, which backfills the history once).
 *
 * Metrics: `views` replaced the deprecated `plays` /
 * `ig_reels_aggregated_all_plays_count` (removed for all API versions from
 * 2025-04-21), so `plays` must not be requested.
 *
 * Env: INSTAGRAM_ACCESS_TOKEN (FB user token), INSTAGRAM_USER_ID,
 *      FACEBOOK_PAGE_ID (same as upload-instagram.mjs).
 * Never logs token values.
 */

export const GRAPH_API_BASE = "https://graph.facebook.com/v22.0";

export const INSIGHT_METRICS = ["views", "reach", "likes", "comments", "shares", "saved"];

export const REQUIRED_SCOPES = [
  "instagram_basic",
  "instagram_manage_insights",
  "pages_read_engagement",
];

const REQUEST_TIMEOUT_MS = 20_000;

// Stop calling /insights once this many in a row were refused for
// permission reasons with nothing collected — the rest would fail the same.
const PERMISSION_FAILURE_LIMIT = 3;

const MEDIA_FIELDS ="id,media_product_type,timestamp,permalink,caption";

// Graph API error codes meaning "token lacks permission" rather than a
// transient/data problem: 10 = permission denied, 190 = invalid/expired
// token, 200-299 = permission errors.
const PERMISSION_ERROR_CODES = new Set([10, 190]);

export class GraphError extends Error {
  constructor(error) {
    super(`Graph API error: ${error.message} (code: ${error.code})`);
    this.code = error.code;
    this.subcode = error.error_subcode;
  }

  get isPermissionError() {
    return (
      PERMISSION_ERROR_CODES.has(this.code) || (this.code >= 200 && this.code < 300)
    );
  }
}

export function createGraphClient(fetchImpl = fetch, base = GRAPH_API_BASE) {
  return async function graphGet(path, params = {}) {
    const url = path.startsWith("http") ? new URL(path) : new URL(`${base}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    // Bounded wait: this runs before rendering in the 15-min daily job.
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const data = await res.json();
    if (data.error) throw new GraphError(data.error);
    return data;
  };
}

/** IG timestamps look like "2026-06-13T23:30:00+0000"; normalise the offset. */
export function parseIgTimestamp(timestamp) {
  return new Date(String(timestamp).replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
}

/** IG timestamp → YYYY-MM-DD in Asia/Tokyo (history entries are keyed by JST date). */
export function toJstDate(timestamp) {
  const ms = parseIgTimestamp(timestamp).getTime() + 9 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** @returns {string[]} required scopes not granted in a /me/permissions payload */
export function missingScopes(permissionsPayload, required = REQUIRED_SCOPES) {
  const granted = new Set(
    (permissionsPayload?.data ?? [])
      .filter((p) => p.status === "granted")
      .map((p) => p.permission)
  );
  return required.filter((s) => !granted.has(s));
}

/** Flatten an /insights payload → { metric: number }. Empty data → metric absent. */
export function parseInsights(payload) {
  const out = {};
  for (const item of payload?.data ?? []) {
    const value = item.values?.[0]?.value ?? item.total_value?.value;
    if (typeof value === "number") out[item.name] = value;
  }
  return out;
}

/** Page through /{ig-user-id}/media (newest first) until older than `sinceDate`. */
export async function listReels(graphGet, igUserId, token, sinceDate) {
  const reels = [];
  let page = await graphGet(`/${igUserId}/media`, {
    fields: MEDIA_FIELDS,
    limit: "50",
    access_token: token,
  });
  for (;;) {
    const items = page.data ?? [];
    reels.push(...items.filter((m) => m.media_product_type === "REELS"));
    const oldest = items.at(-1);
    const next = page.paging?.next;
    if (!next || !oldest || toJstDate(oldest.timestamp) < sinceDate) break;
    // `next` already embeds the access token; do not re-add it.
    page = await graphGet(next);
  }
  return reels;
}

/**
 * Decide the IG media for each history entry.
 * @returns {{ assignments: Map<object, object>, unmatched: {date: string, reason: string}[] }}
 */
export function matchReelsToVideos(videos, reels) {
  const assignments = new Map();
  const unmatched = [];
  const byId = new Map(reels.map((r) => [r.id, r]));
  const claimed = new Set();

  // Entries that already know their mediaId (recorded at upload time).
  // A stored id missing from the listing means the post was deleted
  // (delete-instagram-post.yml → retry-today-instagram.yml): drop it and
  // fall through to date matching so the replacement Reel is picked up.
  const stale = new Map();
  for (const video of videos) {
    const id = video.instagram?.mediaId;
    if (!id) continue;
    const reel = byId.get(id);
    if (!reel) {
      stale.set(video, id);
      continue;
    }
    claimed.add(id);
    assignments.set(video, reel);
  }

  const reelsByDate = new Map();
  for (const reel of reels) {
    if (claimed.has(reel.id)) continue;
    const date = toJstDate(reel.timestamp);
    if (!reelsByDate.has(date)) reelsByDate.set(date, []);
    reelsByDate.get(date).push(reel);
  }

  for (const video of videos) {
    if (assignments.has(video)) continue;
    const candidates = reelsByDate.get(video.date) ?? [];
    const staleNote = stale.has(video)
      ? `stored mediaId ${stale.get(video)} no longer listed (deleted?); `
      : "";
    if (candidates.length === 1) {
      assignments.set(video, candidates[0]);
    } else if (candidates.length === 0) {
      unmatched.push({
        date: video.date,
        reason: `${staleNote}no REELS published on this JST date`,
      });
    } else {
      unmatched.push({
        date: video.date,
        reason: `${staleNote}ambiguous: ${candidates.length} REELS on this JST date (${candidates
          .map((c) => c.id)
          .join(", ")})`,
      });
    }
  }
  return { assignments, unmatched };
}

/** Whether insights should be (re)fetched for this entry. */
export function needsRefresh(video, cutoffDate) {
  return video.date >= cutoffDate || !video.instagram?.updatedAt;
}

async function fetchInsights(graphGet, mediaId, tokens) {
  let lastError;
  // The insights reference names the user token for Facebook Login; the
  // Page token is what publishing uses. Try both so either setup works.
  for (const token of tokens) {
    try {
      const payload = await graphGet(`/${mediaId}/insights`, {
        metric: INSIGHT_METRICS.join(","),
        access_token: token,
      });
      return parseInsights(payload);
    } catch (err) {
      if (!(err instanceof GraphError)) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Mutates `history.videos[*].instagram`. Throws only on setup failures
 * (permissions lookup / page token / media list); per-video insight
 * failures are logged and counted.
 */
export async function updateInstagramStats(history, env, opts = {}) {
  const { fetchImpl = fetch, now = new Date(), refreshDays = 14, log = console.log } = opts;
  const { INSTAGRAM_ACCESS_TOKEN: userToken, INSTAGRAM_USER_ID, FACEBOOK_PAGE_ID } = env;
  const graphGet = createGraphClient(fetchImpl);

  const permissions = await graphGet("/me/permissions", { access_token: userToken });
  const missing = missingScopes(permissions);
  if (missing.length > 0) log(`  IG: token is missing scopes: ${missing.join(", ")}`);

  const page = await graphGet(`/${FACEBOOK_PAGE_ID}`, {
    fields: "access_token",
    access_token: userToken,
  });
  if (!page.access_token) {
    throw new Error(`Could not derive Page Access Token for page ${FACEBOOK_PAGE_ID}`);
  }
  const pageToken = page.access_token;

  const videos = history.videos ?? [];
  const sinceDate = videos.reduce((min, v) => (v.date < min ? v.date : min), "9999-12-31");
  const reels = await listReels(graphGet, INSTAGRAM_USER_ID, pageToken, sinceDate);
  log(`  IG: ${reels.length} REELS listed since ${sinceDate}`);

  const { assignments, unmatched } = matchReelsToVideos(videos, reels);
  for (const u of unmatched) log(`  IG: ${u.date} unmatched → instagram: null (${u.reason})`);

  const cutoffDate = new Date(now.getTime() - refreshDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  let updated = 0;
  let failed = 0;
  let permissionFailures = 0;
  let skipped = 0;
  for (const video of videos) {
    const reel = assignments.get(video);
    if (!reel) {
      video.instagram = null;
      continue;
    }
    const previous = video.instagram?.mediaId === reel.id ? video.instagram : null;
    video.instagram = { mediaId: reel.id, permalink: reel.permalink ?? previous?.permalink ?? null };
    for (const name of INSIGHT_METRICS) video.instagram[name] = previous?.[name] ?? null;
    video.instagram.updatedAt = previous?.updatedAt ?? null;
    if (!needsRefresh(video, cutoffDate)) continue;
    if (updated === 0 && permissionFailures >= PERMISSION_FAILURE_LIMIT) {
      skipped++;
      continue;
    }

    try {
      const metrics = await fetchInsights(graphGet, reel.id, [pageToken, userToken]);
      for (const name of INSIGHT_METRICS) video.instagram[name] = metrics[name] ?? null;
      video.instagram.updatedAt = now.toISOString();
      updated++;
    } catch (err) {
      failed++;
      if (err.isPermissionError) permissionFailures++;
      log(`  IG: insights failed for ${video.date} (${reel.id}): ${err.message}`);
    }
  }

  if (skipped > 0) {
    log(`  IG: skipped ${skipped} insights calls after ${permissionFailures} permission refusals`);
  }

  return {
    matched: assignments.size,
    updated,
    failed,
    skipped,
    permissionDenied: failed > 0 && updated === 0 && permissionFailures === failed,
    missingScopes: missing,
    unmatched,
  };
}
