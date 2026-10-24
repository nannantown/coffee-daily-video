import { createHash } from "node:crypto";

export const TARGET = Object.freeze({
  repository: "nannantown/coffee-daily-video",
  instagramId: "17841464767833513",
  username: "open_ground_coffee_roasters",
  pageId: "1149844638201593",
});
export const RECEIPT_PATH = "data/instagram-post-receipts.json";
export const DAILY_WORKFLOW = "Daily Coffee Video";
export const RECOVERY_WORKFLOWS = Object.freeze({ manual: "Test Instagram Upload (manual)", push: "Retry Today's Instagram (push-triggered)" });
const READ_WORKFLOWS = new Set(["Inspect Instagram Recovery (manual)", "Inspect Today's Instagram Recovery (push-triggered)"]);
const CODES = new Set([
  "invalid_input", "wrong_context", "runtime_debugging_enabled", "wrong_account", "missing_credentials",
  "receipt_unavailable", "receipt_conflict", "receipt_unconfirmed", "receipt_write_uncertain", "invalid_receipt", "invalid_history",
  "prior_attempt_unresolved", "historical_date_requires_review", "receipt_write_approval_required",
  "rerun_requires_review", "source_unverified", "api_rejected", "request_failed", "invalid_api_response",
  "untrusted_upload_destination", "processing_failed", "processing_timeout", "publish_outcome_unknown",
  "published_receipt_unconfirmed", "local_result_write_failed", "unexpected_failure",
  "confirmation_required", "source_changed", "resume_requires_started", "publication_requires_reconciliation", "media_not_verified",
]);
export class InstagramPostError extends Error {
  constructor(code) { super(CODES.has(code) ? code : "unexpected_failure"); this.code = this.message; }
}
export const fail = (code) => { throw new InstagramPostError(code); };
export const safeCode = (error) => error instanceof InstagramPostError && CODES.has(error.code) ? error.code : "unexpected_failure";
export const isId = (value) => typeof value === "string" && /^[0-9]{5,25}$/u.test(value);
export const isToken = (value) => typeof value === "string" && value.length > 0 && value.length <= 8192 && !/[\u0000-\u0020\u007f]/u.test(value);
const isHash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const isSha = (value) => typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const gitBlobSha = (bytes) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
export const jstDate = (now = new Date()) => new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
export function validDate(value) {
  return typeof value === "string" && /^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/u.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function assertContext(env, inspect, recovery = false) {
  const recoveryContext = env && ((env.GITHUB_WORKFLOW === RECOVERY_WORKFLOWS.manual && env.GITHUB_EVENT_NAME === "workflow_dispatch") ||
    (env.GITHUB_WORKFLOW === RECOVERY_WORKFLOWS.push && env.GITHUB_EVENT_NAME === "push"));
  if (env?.GITHUB_ACTIONS !== "true" || env.GITHUB_REPOSITORY !== TARGET.repository || env.GITHUB_REF !== "refs/heads/main" ||
      (recovery ? !recoveryContext : inspect ? !READ_WORKFLOWS.has(env.GITHUB_WORKFLOW) : env.GITHUB_WORKFLOW !== DAILY_WORKFLOW)) fail("wrong_context");
  if (env.NODE_OPTIONS || env.NODE_DEBUG || env.NODE_DEBUG_NATIVE || env.DEBUG) fail("runtime_debugging_enabled");
  if (!inspect && !recovery && (!new Set(["schedule", "workflow_dispatch", "push"]).has(env.GITHUB_EVENT_NAME) ||
      env.SNS_POST_ENABLED !== "true" || env.DRY_RUN === "true")) fail("wrong_context");
  if (!inspect && env.GITHUB_RUN_ATTEMPT !== "1") fail("rerun_requires_review");
}

export function validateReceipt(state) {
  if (state?.version !== 1 || state.instagramId !== TARGET.instagramId || !state.entries ||
      typeof state.entries !== "object" || Array.isArray(state.entries) ||
      Object.keys(state).some((k) => !["version", "instagramId", "entries"].includes(k))) fail("invalid_receipt");
  for (const [date, e] of Object.entries(state.entries)) {
    if (!validDate(date) || !e || typeof e !== "object" || Array.isArray(e) ||
        Object.keys(e).some((k) => !["state", "fingerprint", "runId", "containerId", "mediaId", "publicationDate"].includes(k)) ||
        !["started", "publishing", "published"].includes(e.state) ||
        !(isHash(e.fingerprint) || (e.state === "published" && e.fingerprint === null)) ||
        !(isId(e.runId) || (e.state === "published" && e.runId === null)) ||
        (e.containerId !== undefined && !isId(e.containerId)) ||
        (e.publicationDate !== undefined && !validDate(e.publicationDate)) ||
        (e.state === "publishing" && !isId(e.containerId)) ||
        (e.state === "published" ? !isId(e.mediaId) : e.mediaId !== undefined)) fail("invalid_receipt");
  }
  return state;
}

export function createGitHubReceiptStore({ token, fetchImpl = fetch }) {
  if (!isToken(token)) fail("missing_credentials");
  const base = `https://api.github.com/repos/${TARGET.repository}`;
  async function request(path, method = "GET", body) {
    try {
      const res = await fetchImpl(`${base}${path}`, {
        method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "Cache-Control": "no-cache" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if ([409, 422].includes(res.status)) fail("receipt_conflict");
      if (!res.ok) fail(method === "PUT" ? "receipt_write_uncertain" : "receipt_unavailable");
      return await res.json();
    } catch (error) {
      if (error instanceof InstagramPostError) throw error;
      fail(method === "PUT" ? "receipt_write_uncertain" : "receipt_unavailable");
    }
  }
  async function file(path) {
    const response = await request(`/contents/${path}?ref=main`);
    if (response.encoding !== "base64" || typeof response.content !== "string" || response.content.length > 1_400_000 || !isSha(response.sha)) fail("receipt_unavailable");
    const bytes = Buffer.from(response.content, "base64");
    if (gitBlobSha(bytes) !== response.sha) fail("receipt_unavailable");
    try { return { value: JSON.parse(bytes.toString("utf8")), sha: response.sha }; }
    catch { fail("receipt_unavailable"); }
  }
  async function load() {
    const result = await file(RECEIPT_PATH);
    return { state: validateReceipt(result.value), sha: result.sha };
  }
  async function history(date) {
    const { value } = await file("data/performance-history.json");
    if (!Array.isArray(value?.videos)) fail("invalid_history");
    const records = value.videos.filter((v) => v?.date === date);
    if (records.length > 1) fail("invalid_history");
    if (!records.length) return null;
    const id = records[0].instagram?.mediaId;
    if (id !== undefined && id !== null && !isId(id)) fail("invalid_history");
    return isId(id) ? { state: "published", mediaId: id } : { state: "unresolved" };
  }
  async function inspect(date) {
    if (!validDate(date)) fail("invalid_input");
    const loaded = await load();
    const entry = loaded.state.entries[date];
    if (entry?.state === "published") return structuredClone(entry);
    const prior = await history(date);
    if (prior?.state === "published") return prior;
    return entry ? structuredClone(entry) : prior ?? { state: "absent" };
  }
  async function write(loaded, date, entry) {
    const next = structuredClone(loaded.state);
    next.entries[date] = entry;
    const bytes = Buffer.from(`${JSON.stringify(validateReceipt(next), null, 2)}\n`);
    const response = await request(`/contents/${RECEIPT_PATH}`, "PUT", {
      branch: "main", sha: loaded.sha, content: bytes.toString("base64"),
      message: `Record Instagram ${entry.state} ${date} [skip ci]`,
    });
    if (response.content?.sha !== gitBlobSha(bytes) || !isSha(response.commit?.sha)) fail("receipt_unconfirmed");
    let verified;
    try { verified = await load(); } catch { fail("receipt_unconfirmed"); }
    if (JSON.stringify(verified.state.entries[date]) !== JSON.stringify(entry)) fail("receipt_unconfirmed");
  }
  return {
    inspect,
    async sourcePlan(date) {
      if (!validDate(date)) fail("invalid_input");
      const tag = `v${date.replaceAll("-", "")}`;
      const release = await request(`/releases/tags/${tag}`);
      if (!isId(String(release?.id)) || release.tag_name !== tag || release.draft || !Number.isFinite(Date.parse(release.published_at)) || !Array.isArray(release.assets)) fail("source_unverified");
      const asset = (name, maxSize) => {
        const matches = release.assets.filter((a) => a?.name === name);
        const a = matches[0];
        if (matches.length !== 1 || !isId(String(a.id)) || !Number.isSafeInteger(a.size) || a.size < 1 || a.size > maxSize ||
            typeof a.digest !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(a.digest)) fail("source_unverified");
        return { id: String(a.id), name, sha256: a.digest.slice(7), size: a.size };
      };
      return { version: 1, date, releaseId: String(release.id), tag,
        video: asset(`coffee-${tag.slice(1)}.mp4`, 250_000_000), captions: asset(`coffee-${tag.slice(1)}-captions.json`, 500_000) };
    },
    async claimRecovery(date, fingerprint, runId, { resume = false, confirmedUnpublished = false, publicationDate = date } = {}) {
      if (!validDate(date) || !validDate(publicationDate) || !isHash(fingerprint) || !isId(runId)) fail("invalid_input");
      const loaded = await load();
      const old = loaded.state.entries[date];
      const prior = await history(date);
      if (prior?.state === "published") fail("prior_attempt_unresolved");
      if (old) {
        if (old.state !== "started") fail("publication_requires_reconciliation");
        if (!resume) fail("resume_requires_started");
        if (old.fingerprint !== fingerprint) fail("source_changed");
        if (old.runId === runId) fail("prior_attempt_unresolved");
      } else {
        if (resume) fail("resume_requires_started");
        if (prior && !confirmedUnpublished) fail("confirmation_required");
      }
      // Ownership is fenced with the blob SHA; an older runner cannot cross
      // markPublishing after this transfer. Never transfer a publishing entry.
      await write(loaded, date, { state: "started", fingerprint, runId, publicationDate });
      return { date, fingerprint, runId };
    },
    async reconcilePublished(date, fingerprint, runId, mediaId) {
      if (!validDate(date) || !isHash(fingerprint) || !isId(runId) || !isId(mediaId)) fail("invalid_input");
      const loaded = await load();
      const old = loaded.state.entries[date];
      if (old?.state === "published") fail("prior_attempt_unresolved");
      // Do not race an owner that is still allowed to publish from started.
      if (old?.state === "started") fail("resume_requires_started");
      if (old && old.fingerprint !== fingerprint) fail("source_changed");
      const prior = await history(date);
      if (prior?.state === "published" && prior.mediaId !== mediaId) fail("prior_attempt_unresolved");
      await write(loaded, date, { ...(old ?? {}), state: "published", fingerprint,
        runId: old?.runId ?? runId, mediaId });
    },
    async verifySource(date, payload, env, now = new Date()) {
      if (!validDate(date) || !isId(env.GITHUB_RUN_ID) || !isSha(env.GITHUB_SHA)) fail("source_unverified");
      const tag = `v${date.replaceAll("-", "")}`;
      const release = await request(`/releases/tags/${tag}`);
      // Set by the reviewed daily workflow before pipeline.mjs; no extra actions permission.
      const started = Date.parse(env.INSTAGRAM_PUBLICATION_STARTED_AT);
      const released = Date.parse(release.published_at);
      if (!/^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/u.test(env.INSTAGRAM_PUBLICATION_STARTED_AT ?? "") ||
          !Number.isFinite(started) || !Number.isFinite(released) || released < started || started > now.getTime() ||
          jstDate(new Date(started)) !== date || jstDate(new Date(released)) !== date ||
          release.tag_name !== tag || release.draft || !Array.isArray(release.assets)) fail("source_unverified");
      for (const [name, digest, size] of [
        [`coffee-${tag.slice(1)}.mp4`, payload.videoSha256, payload.videoBytes.length],
        [`coffee-${tag.slice(1)}-captions.json`, payload.captionSha256, payload.captionBytes.length],
      ]) {
        const assets = release.assets.filter((a) => a.name === name);
        if (assets.length !== 1 || assets[0].digest !== `sha256:${digest}` || assets[0].size !== size) fail("source_unverified");
      }
    },
    async reserve(date, fingerprint, runId) {
      if (!validDate(date) || !isHash(fingerprint) || !isId(runId)) fail("invalid_input");
      const loaded = await load();
      if (loaded.state.entries[date]) fail("prior_attempt_unresolved");
      if (await history(date)) fail("prior_attempt_unresolved");
      const entry = { state: "started", fingerprint, runId, publicationDate: date };
      await write(loaded, date, entry);
      return { date, fingerprint, runId };
    },
    async markPublishing(handle, containerId) {
      const loaded = await load();
      const old = loaded.state.entries[handle.date];
      if (!isId(containerId) || old?.state !== "started" || old.runId !== handle.runId || old.fingerprint !== handle.fingerprint) fail("prior_attempt_unresolved");
      await write(loaded, handle.date, { ...old, state: "publishing", containerId });
    },
    async markPublished(handle, mediaId) {
      const loaded = await load();
      const old = loaded.state.entries[handle.date];
      if (!isId(mediaId) || old?.state !== "publishing" || old.runId !== handle.runId || old.fingerprint !== handle.fingerprint) fail("prior_attempt_unresolved");
      await write(loaded, handle.date, { ...old, state: "published", mediaId });
    },
  };
}
