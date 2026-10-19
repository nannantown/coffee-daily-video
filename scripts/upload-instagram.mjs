/** Instagram publication: fixed target, safe transport, durable receipts. */
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TARGET, assertContext, createGitHubReceiptStore, fail, isId, isToken, jstDate, safeCode, sha256, validDate } from "./instagram-publish-state.mjs";
const outputDir = join(dirname(fileURLToPath(import.meta.url)), "..", "output");
const GRAPH = "https://graph.facebook.com/v22.0";

function uploadDestination(container) {
  if (!isId(container?.id) || typeof container.uri !== "string") fail("untrusted_upload_destination");
  let uri;
  try { uri = new URL(container.uri); } catch { fail("untrusted_upload_destination"); }
  if (uri.protocol !== "https:" || uri.hostname !== "rupload.facebook.com" || uri.port || uri.username || uri.password || uri.search || uri.hash ||
      !/^\/ig-api-upload\/(?:v[0-9]+\.[0-9]+\/)?[0-9]+\/?$/u.test(uri.pathname) || uri.pathname.split("/").filter(Boolean).at(-1) !== container.id) fail("untrusted_upload_destination");
  return uri.href;
}

export function createInstagramClient({ userToken, fetchImpl = fetch, delay = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  if (!isToken(userToken)) fail("missing_credentials");
  async function json(url, token, init = {}, timeout = 15_000) {
    try {
      const response = await fetchImpl(url, { ...init, redirect: "error", signal: AbortSignal.timeout(timeout),
        headers: { ...init.headers, Authorization: `Bearer ${token}`, Accept: "application/json" } });
      if (!response.ok) fail("api_rejected");
      const data = await response.json();
      if (!data || typeof data !== "object" || Array.isArray(data) || Object.hasOwn(data, "error")) fail("api_rejected");
      return data;
    } catch (error) {
      if (["api_rejected", "invalid_api_response"].includes(safeCode(error))) throw error;
      fail("request_failed");
    }
  }
  let pageToken;
  return {
    async verifyTarget() {
      const params = new URLSearchParams({ fields: "id,instagram_business_account{id,username},access_token" });
      const data = await json(`${GRAPH}/${TARGET.pageId}?${params}`, userToken, { method: "GET" });
      if (data.id !== TARGET.pageId || data.instagram_business_account?.id !== TARGET.instagramId ||
          data.instagram_business_account?.username !== TARGET.username) fail("wrong_account");
      if (!isToken(data.access_token)) fail("invalid_api_response");
      pageToken = data.access_token;
    },
    async createContainer(payload) {
      if (!pageToken) fail("missing_credentials");
      const form = new URLSearchParams({ media_type: "REELS", upload_type: "resumable", caption: payload.caption, thumb_offset: String(payload.thumbOffset) });
      const data = await json(`${GRAPH}/${TARGET.instagramId}/media`, pageToken, { method: "POST", body: form });
      if (!isId(data.id) || typeof data.uri !== "string") fail("invalid_api_response");
      return { id: data.id, uri: uploadDestination({ id: data.id, uri: data.uri }) };
    },
    async upload(container, payload) {
      if (!pageToken) fail("missing_credentials");
      const uri = uploadDestination(container);
      try {
        const response = await fetchImpl(uri, { method: "POST", redirect: "error", signal: AbortSignal.timeout(120_000),
          headers: { Authorization: `OAuth ${pageToken}`, offset: "0", file_size: String(payload.videoBytes.length) }, body: payload.videoBytes });
        if (!response.ok) fail("api_rejected");
        const data = await response.json();
        if (data?.success !== true) fail("invalid_api_response");
      } catch (error) {
        if (["api_rejected", "invalid_api_response"].includes(safeCode(error))) throw error;
        fail("request_failed");
      }
    },
    async waitReady(container) {
      if (!pageToken || !isId(container?.id)) fail("invalid_input");
      for (let i = 0; i < 60; i++) {
        const data = await json(`${GRAPH}/${container.id}?fields=status_code`, pageToken, { method: "GET" });
        if (data.status_code === "FINISHED") return;
        if (["ERROR", "EXPIRED", "PUBLISHED"].includes(data.status_code)) fail("processing_failed");
        if (data.status_code !== "IN_PROGRESS") fail("invalid_api_response");
        if (i < 59) await delay(5000);
      }
      fail("processing_timeout");
    },
    async publish(container) {
      if (!pageToken || !isId(container?.id)) fail("invalid_input");
      const data = await json(`${GRAPH}/${TARGET.instagramId}/media_publish`, pageToken, {
        method: "POST", body: new URLSearchParams({ creation_id: container.id }) });
      if (!isId(data.id)) fail("invalid_api_response");
      return data.id;
    },
    async verifyPublishedMedia(mediaId, date, caption) {
      if (!pageToken || !isId(mediaId) || !validDate(date)) fail("invalid_input");
      const cursors = new Set();
      let after;
      for (let i = 0; i < 10; i++) {
        const params = new URLSearchParams({ fields: "id,timestamp,caption,media_product_type", limit: "100", ...(after ? { after } : {}) });
        const page = await json(`${GRAPH}/${TARGET.instagramId}/media?${params}`, pageToken, { method: "GET" });
        if (!Array.isArray(page.data)) fail("invalid_api_response");
        const found = page.data.find((m) => m?.id === mediaId);
        if (found) {
          const time = new Date(found.timestamp);
          if (found.media_product_type !== "REELS" || !Number.isFinite(time.getTime()) || jstDate(time) !== date || found.caption !== caption) fail("media_not_verified");
          return;
        }
        if (!page.paging?.next) break;
        after = page.paging?.cursors?.after;
        if (typeof after !== "string" || !/^[A-Za-z0-9_+/=-]{1,4096}$/u.test(after) || cursors.has(after)) fail("invalid_api_response");
        cursors.add(after);
      }
      fail("media_not_verified");
    },
  };
}

export async function publishOnce({ env, date, now, store, makeClient, readPayload, inspect = false, recovery }) {
  let reserved = false;
  let publishing = false;
  let mediaId;
  try {
    assertContext(env, inspect, Boolean(recovery));
    if (!validDate(date)) fail("invalid_input");
    const observed = await store.inspect(date);
    if (observed.state === "published") {
      if (!isId(observed.mediaId)) fail("invalid_receipt");
      return { status: "already_published", date, mediaId: observed.mediaId };
    }
    const resuming = recovery?.action === "resume_before_publish" || (recovery?.automatic && observed.state === "started");
    if (recovery?.action === "reconcile_published" && observed.state === "started") fail("resume_requires_started");
    if (recovery?.action !== "reconcile_published") {
      if (recovery && observed.state === "publishing") fail("publication_requires_reconciliation");
      if (!recovery && observed.state !== "absent") fail("prior_attempt_unresolved");
      if (recovery && observed.state === "started" && !resuming) fail("resume_requires_started");
      if (recovery && observed.state === "unresolved" && !recovery.confirmedUnpublished) fail("confirmation_required");
      if (date !== jstDate(now) && (!recovery || !recovery.confirmedUnpublished)) fail("historical_date_requires_review");
    }
    if (inspect || env.INSTAGRAM_RECEIPT_WRITE_ENABLED !== "true") fail("receipt_write_approval_required");
    if (env.INSTAGRAM_USER_ID !== TARGET.instagramId || env.FACEBOOK_PAGE_ID !== TARGET.pageId) fail("wrong_account");
    const payload = readPayload();
    if (recovery) await recovery.verifySource(payload);
    else await store.verifySource(date, payload, env, now);
    const client = makeClient();
    await client.verifyTarget();
    const fingerprint = sha256(JSON.stringify({ video: payload.videoSha256, captions: payload.captionSha256 }));
    if (recovery?.action === "reconcile_published") {
      await client.verifyPublishedMedia(recovery.mediaId, observed.publicationDate ?? date, payload.caption);
      await store.reconcilePublished(date, fingerprint, env.GITHUB_RUN_ID, recovery.mediaId);
      return { status: "reconciled", date, mediaId: recovery.mediaId };
    }
    const handle = recovery ? await store.claimRecovery(date, fingerprint, env.GITHUB_RUN_ID,
      { resume: resuming, confirmedUnpublished: recovery.confirmedUnpublished, publicationDate: jstDate(now) }) : await store.reserve(date, fingerprint, env.GITHUB_RUN_ID);
    reserved = true;
    const container = await client.createContainer(payload);
    await client.upload(container, payload);
    await client.waitReady(container);
    await store.markPublishing(handle, container.id);
    publishing = true;
    const publishedId = await client.publish(container);
    if (!isId(publishedId)) fail("invalid_api_response");
    mediaId = publishedId;
    try { await store.markPublished(handle, mediaId); } catch { fail("published_receipt_unconfirmed"); }
    return { status: "published", date, mediaId };
  } catch (error) {
    const reason = mediaId ? "published_receipt_unconfirmed" : publishing ? "publish_outcome_unknown" : safeCode(error);
    const uncertainReceipt = ["receipt_write_uncertain", "receipt_unconfirmed"].includes(reason);
    return { status: reserved || publishing || uncertainReceipt ? "needs_review" : "blocked", reason, ...(mediaId ? { mediaId, date } : {}) };
  }
}

export async function runUpload({ env, argv = [], fetchImpl = fetch, now = new Date(), readFile = readFileSync, writeFile = writeFileSync, directory = outputDir }) {
  try {
    const inspect = argv.includes("--inspect");
    assertContext(env, inspect);
    if (argv.some((a) => a !== "--inspect" && !/^--file=[^\r\n]+$/u.test(a))) fail("invalid_input");
    const fileArgs = argv.filter((a) => a.startsWith("--file="));
    let date = env.INSTAGRAM_POST_DATE || jstDate(now);
    let path;
    if (!inspect) {
      if (fileArgs.length !== 1) fail("invalid_input");
      path = resolve(fileArgs[0].slice(7));
      const match = /^coffee-(20[0-9]{6})\.mp4$/u.exec(basename(path));
      if (!match || path !== resolve(directory, basename(path))) fail("invalid_input");
      date = `${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)}`;
    } else if (fileArgs.length) fail("invalid_input");
    const store = createGitHubReceiptStore({ token: env.GITHUB_TOKEN, fetchImpl });
    const result = await publishOnce({ env, date, now, store, inspect,
      makeClient: () => createInstagramClient({ userToken: env.INSTAGRAM_ACCESS_TOKEN, fetchImpl }),
      readPayload: () => {
        const videoBytes = readFile(path);
        const captionBytes = readFile(join(directory, "captions.json"));
        let captions;
        try { captions = JSON.parse(captionBytes.toString("utf8")); } catch { fail("invalid_input"); }
        if (!Buffer.isBuffer(videoBytes) || !videoBytes.length || typeof captions?.instagram !== "string" || !captions.instagram.length || captions.instagram.length > 2200) fail("invalid_input");
        return { videoBytes, captionBytes, caption: captions.instagram, thumbOffset: captions.format ? 1500 : 7000,
          videoSha256: sha256(videoBytes), captionSha256: sha256(captionBytes) };
      } });
    if (!inspect && result.mediaId && ["published", "already_published", "needs_review"].includes(result.status)) {
      try { writeFile(join(directory, "instagram-result.json"), JSON.stringify({ mediaId: result.mediaId, date, publishedAt: now.toISOString() })); }
      catch { return { status: "needs_review", reason: "local_result_write_failed", date, mediaId: result.mediaId }; }
    }
    return result;
  } catch (error) { return { status: "blocked", reason: safeCode(error) }; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runUpload({ env: process.env, argv: process.argv.slice(2) });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = ["published", "already_published"].includes(result.status) ? 0 : 1;
}
