import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { TARGET, RECEIPT_PATH, DAILY_WORKFLOW, gitBlobSha, sha256, createGitHubReceiptStore } from "./instagram-publish-state.mjs";
import { createInstagramClient, publishOnce, runUpload } from "./upload-instagram.mjs";
// No process.env, network, real credentials, release assets, or production history.
export const DATE = "2026-10-20";
export const NOW = new Date(`${DATE}T01:05:00Z`);
export const CONTAINER = "18000000000000001";
export const MEDIA = "18000000000000002";
export const KNOWN = "18137947933725162";
export const video = Buffer.from("mock MP4 bytes");
export const captionBytes = Buffer.from(JSON.stringify({ instagram: "Mock caption", format: "brew-lesson", date: { compact: "20261020" } }));
export const payload = { videoBytes: video, captionBytes, caption: "Mock caption", thumbOffset: 1500,
  videoSha256: sha256(video), captionSha256: sha256(captionBytes) };
export const cleanEnv = () => ({ GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: TARGET.repository,
  GITHUB_REF: "refs/heads/main", GITHUB_WORKFLOW: DAILY_WORKFLOW, GITHUB_EVENT_NAME: "schedule",
  GITHUB_RUN_ATTEMPT: "1", GITHUB_RUN_ID: "39185391718", GITHUB_SHA: "a".repeat(40),
  SNS_POST_ENABLED: "true", DRY_RUN: "false", INSTAGRAM_RECEIPT_WRITE_ENABLED: "true",
  INSTAGRAM_PUBLICATION_STARTED_AT: `${DATE}T01:00:00Z`,
  INSTAGRAM_USER_ID: TARGET.instagramId, FACEBOOK_PAGE_ID: TARGET.pageId });
export const empty = () => ({ version: 1, instagramId: TARGET.instagramId, entries: {} });
export const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => structuredClone(data) });

export function harness(options = {}) {
  const secret = `mock-only-${randomBytes(24).toString("hex")}`;
  const tokens = { user: `${secret}-user`, page: `${secret}-page`, github: `${secret}-github` };
  let state = structuredClone(options.state ?? empty());
  const history = options.history ?? { videos: [] };
  const calls = [];
  const writes = [];
  const metaCount = (suffix, method = "POST") => calls.filter((c) => c.host !== "api.github.com" && c.path.endsWith(suffix) && c.method === method).length;
  let triggered = false;
  let lastWritten;
  const bytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  const contents = (value) => { const b = bytes(value); return response({ encoding: "base64", content: b.toString("base64"), sha: gitBlobSha(b) }); };
  const release = { id: 300000001, tag_name: "v20261020", draft: false, published_at: `${DATE}T01:02:00Z`, assets: [
    { id: 400000001, name: "coffee-20261020.mp4", size: video.length, digest: `sha256:${payload.videoSha256}` },
    { id: 400000002, name: "coffee-20261020-captions.json", size: captionBytes.length, digest: `sha256:${payload.captionSha256}` },
  ], ...options.release };
  async function fetchImpl(input, init = {}) {
    const url = new URL(input);
    const method = init.method ?? "GET";
    assert.equal(init.redirect, url.pathname.includes("/releases/assets/") ? "manual" : "error");
    assert.ok(!url.href.includes(secret), "credential absent from request URL");
    assert.ok(!String(init.body ?? "").includes(secret), "credential absent from request body");
    assert.ok(init.signal instanceof AbortSignal);
    const call = { host: url.hostname, path: url.pathname, method };
    calls.push(call);
    if (url.hostname === "release-assets.githubusercontent.com") {
      assert.equal(init.headers, undefined, "no credentials sent to asset CDN");
      return new Response(video, { headers: { "content-length": String(video.length) } });
    }
    if (url.hostname === "api.github.com") {
      assert.equal(init.cache, "no-store");
      assert.equal(init.headers["Cache-Control"], "no-cache");
      assert.equal(init.headers.Authorization, `Bearer ${tokens.github}`);
      assert.ok(url.pathname.startsWith(`/repos/${TARGET.repository}/`));
      if (url.pathname.includes("/releases/assets/")) {
        if (options.assetFault === "network") throw new Error(secret);
        if (options.assetRedirect && url.pathname.endsWith("400000001")) return new Response(null, { status: 302, headers: { location: options.assetRedirect } });
        const content = url.pathname.endsWith("400000001") ? video : options.captionsBytes ?? captionBytes;
        const data = options.assetFault === "digest" ? Buffer.from("changed") : content;
        return new Response(data, { headers: { "content-length": String(content.length) } });
      }
      if (url.pathname.endsWith(`/contents/${RECEIPT_PATH}`)) {
        if (method === "GET") {
          if (options.badReceipt === "missing") return response({}, 404);
          if (options.badReceipt === "corrupt") return response({ encoding: "base64", sha: "a".repeat(40), content: "invalid" });
          if (options.readbackFail !== undefined && options.readbackFail === lastWritten && !triggered) { triggered = true; return response({}, 503); }
          return contents(state);
        }
        assert.equal(method, "PUT");
        const body = JSON.parse(init.body);
        if (body.sha !== gitBlobSha(bytes(state))) return response({}, 409);
        const nextBytes = Buffer.from(body.content, "base64");
        const next = JSON.parse(nextBytes);
        const phase = next.entries[DATE]?.state;
        writes.push(nextBytes.toString());
        if (options.putFault?.phase === phase && !triggered) {
          triggered = true;
          if (options.putFault.kind === "before") return response({}, 503);
          if (options.putFault.kind === "conflict") return response({}, 409);
          state = next;
          lastWritten = phase;
          if (options.putFault.kind === "after") throw new TypeError(secret);
          if (options.putFault.kind === "malformed_ack") return response({ content: { sha: "b".repeat(40) }, commit: { sha: "c".repeat(40) } });
        }
        state = next; lastWritten = phase;
        return response({ content: { sha: gitBlobSha(nextBytes) }, commit: { sha: "c".repeat(40) } });
      }
      if (url.pathname.endsWith("/contents/data/performance-history.json")) return contents(history);
      if (url.pathname.endsWith("/releases/tags/v20261020")) return response(release);
      assert.fail("unexpected GitHub endpoint");
    }
    assert.ok(["graph.facebook.com", "rupload.facebook.com"].includes(url.hostname));
    if (url.hostname === "rupload.facebook.com") {
      assert.equal(init.headers.Authorization, `OAuth ${tokens.page}`);
      if (options.metaFault === "upload") throw new Error(secret);
      return response({ success: true });
    }
    if (method === "GET" && url.pathname.endsWith(`/${TARGET.pageId}`)) {
      assert.equal(init.headers.Authorization, `Bearer ${tokens.user}`);
      if (options.metaFault === "target_transport") throw new TypeError(secret);
      if (options.metaFault === "target_json") return { ok: true, status: 200, json: async () => { throw new SyntaxError(secret); } };
      if (options.metaFault === "target_error") return response({ error: { message: secret, code: secret } }, 400);
      return response({ id: TARGET.pageId, access_token: tokens.page,
        instagram_business_account: { id: TARGET.instagramId, username: options.wrongAccount ? "other-account" : TARGET.username } });
    }
    assert.equal(init.headers.Authorization, `Bearer ${tokens.page}`);
    if (url.pathname.endsWith(`/${TARGET.instagramId}/media`) && method === "GET") {
      return response({ data: options.ownedMedia ?? [{ id: MEDIA, timestamp: `${DATE}T01:03:00Z`, caption: payload.caption, media_product_type: "REELS" }] });
    }
    if (url.pathname.endsWith(`/${TARGET.instagramId}/media`) && method === "POST") {
      assert.equal(state.entries[DATE]?.state, "started", "remote receipt precedes container creation");
      if (options.metaFault === "create") throw new Error(secret);
      return response({ id: CONTAINER, uri: options.uri ?? `https://rupload.facebook.com/ig-api-upload/v22.0/${CONTAINER}` });
    }
    if (method === "GET" && url.pathname.endsWith(`/${CONTAINER}`)) {
      return response({ status_code: options.metaFault === "processing" ? "ERROR" : "FINISHED", status: secret });
    }
    if (url.pathname.endsWith("/media_publish") && method === "POST") {
      assert.equal(state.entries[DATE]?.state, "publishing", "confirmed remote barrier precedes media_publish");
      if (options.metaFault === "publish") throw new TypeError(secret); // server may have posted
      if (options.metaFault === "publish_json") return { ok: true, status: 200, json: async () => { throw new SyntaxError(secret); } };
      return response({ id: MEDIA });
    }
    assert.fail("unexpected Meta endpoint");
  }
  const env = { ...cleanEnv(), GITHUB_TOKEN: tokens.github, INSTAGRAM_ACCESS_TOKEN: tokens.user };
  const store = createGitHubReceiptStore({ token: tokens.github, fetchImpl });
  const publish = (overrides = {}) => publishOnce({ env, date: DATE, now: NOW, store,
    makeClient: () => createInstagramClient({ userToken: tokens.user, fetchImpl, delay: async () => {} }), readPayload: () => payload, ...overrides });
  const run = (overrides = {}) => runUpload({ env, now: NOW, argv: ["--file=/mock-output/coffee-20261020.mp4"], directory: "/mock-output", fetchImpl,
    readFile: (p) => p.endsWith(".mp4") ? video : captionBytes,
    writeFile: (_path, data) => writes.push(data), ...overrides });
  function safe(result) {
    assert.ok(!JSON.stringify({ result, writes }).includes(secret), "no raw secret in result or saved artifacts");
    assert.ok(Object.keys(result).every((key) => ["status", "reason", "date", "mediaId", "state", "plan", "containerId", "runId"].includes(key)));
  }
  return { publish, run, env, store, fetchImpl, calls, writes, tokens, secret, safe, metaCount,
    release, faultTriggered: () => triggered, state: () => structuredClone(state) };
}

