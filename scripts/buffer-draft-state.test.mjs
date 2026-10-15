import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBufferDraftPlan, ensureBufferDraft, maybeCreateBufferDraft } from "./buffer-draft.mjs";
import { createGitHubReceiptStore, RECEIPT_PATH, RECEIPT_REPOSITORY } from "./buffer-draft-state.mjs";

const url = "https://github.com/nannantown/coffee-daily-video/releases/download/v20261015/coffee-20261015.mp4";
const channel = { id: "tiktok-1", name: "opengroundcoffee", service: "tiktok", organizationId: "org-1", isDisconnected: false, isLocked: false };
const caption = { date: { compact: "20261015" }, instagram: "今日のコーヒーのヒント" };
const sha = (bytes) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

/** In-memory GitHub Contents service with actual Git blob SHAs and conditional writes. */
function githubServer() {
  let bytes = Buffer.from('{"version":1,"entries":{}}\n');
  const api = `https://api.github.com/repos/${RECEIPT_REPOSITORY}/contents/${RECEIPT_PATH}`;
  const server = {
    calls: [], writes: [], beforePut: null, afterPut: null, beforeGet: null,
    state: () => JSON.parse(bytes.toString()),
    replace: (text) => { bytes = Buffer.from(text); },
    async fetch(requestUrl, options) {
      assert.equal(options.headers.Authorization, "Bearer mock-github-token");
      assert.equal(options.redirect, "error");
      assert.equal(options.cache, "no-store");
      assert.equal(options.headers["Cache-Control"], "no-cache");
      server.calls.push({ method: options.method, url: requestUrl });
      if (options.method === "GET") {
        assert.equal(requestUrl, `${api}?ref=main`);
        // Capture before yielding: two runners can read the very same old file.
        const file = { type: "file", path: RECEIPT_PATH, encoding: "base64", content: bytes.toString("base64"), sha: sha(bytes) };
        const override = await server.beforeGet?.(file);
        return override ?? json(file);
      }
      assert.equal(options.method, "PUT");
      assert.equal(requestUrl, api);
      const body = JSON.parse(options.body);
      assert.equal(body.branch, "main");
      assert.match(body.message, /\[skip ci\]/);
      assert.match(body.sha, /^[a-f0-9]{40}$/);
      const override = await server.beforePut?.(body);
      if (override) return override;
      if (body.sha !== sha(bytes)) return json({ message: "SHA conflict" }, 409);
      bytes = Buffer.from(body.content, "base64");
      server.writes.push(server.state());
      const result = { content: { sha: sha(bytes) }, commit: { sha: "c".repeat(40) } };
      const after = await server.afterPut?.(result);
      return after ?? json(result);
    },
    store: () => createGitHubReceiptStore({ token: "mock-github-token", repository: RECEIPT_REPOSITORY, fetchImpl: server.fetch }),
  };
  return server;
}

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "buffer-ci-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const videoPath = join(dir, "coffee-20261015.mp4");
  const captionsPath = join(dir, "captions.json");
  writeFileSync(videoPath, "mock-mp4");
  writeFileSync(captionsPath, JSON.stringify(caption));
  const plan = buildBufferDraftPlan({ videoPath, videoUrl: url, captions: caption, channelId: channel.id, organizationId: channel.organizationId });
  const post = { id: "buffer-draft-1", channelId: channel.id, text: caption.instagram, status: "draft", dueAt: null, assets: [{ source: url }] };
  const server = githubServer();
  const calls = { creates: 0 };
  const client = {
    getChannel: async () => channel,
    listPosts: async () => [],
    getPost: async () => post,
    createDraft: async (input) => {
      calls.creates++;
      assert.equal(input.saveToDraft, true);
      assert.equal(server.state().entries[plan.key].state, "creating");
      return { post };
    },
  };
  const media = async (requestUrl, options) => {
    assert.equal(requestUrl, url);
    assert.equal(options.headers, undefined);
    return { ok: true, headers: new Headers() };
  };
  // Each run constructs a fresh store, just as a different ephemeral runner would.
  const run = (overrides = {}) => ensureBufferDraft({ plan, client, receiptStore: server.store(), fetchImpl: media, ...overrides });
  return { dir, videoPath, captionsPath, plan, post, server, client, media, calls, run };
}

test("separate CI runs reuse the durable post ID and ignore their stale checkout copy", async (t) => {
  const f = fixture(t);
  const stalePath = join(f.dir, "stale-checkout-receipts.json");
  writeFileSync(stalePath, '{"version":1,"entries":{}}');
  assert.equal((await f.run()).reused, false);
  assert.deepEqual(f.server.writes.map((s) => s.entries[f.plan.key].state), ["creating", "draft"]);
  assert.equal((await f.run()).reused, true);
  assert.equal(f.calls.creates, 1);
  assert.deepEqual(JSON.parse(readFileSync(stalePath)), { version: 1, entries: {} });
});

test("another runner never resends an unknown or interrupted send without remote proof", async (t) => {
  const f = fixture(t);
  f.client.createDraft = async () => { f.calls.creates++; throw new Error("timeout"); };
  await assert.rejects(f.run(), { code: "creation_outcome_unknown" });
  assert.equal(f.server.state().entries[f.plan.key].state, "unknown");
  await assert.rejects(f.run(), { code: "creation_outcome_unknown" });
  assert.equal(f.calls.creates, 1);
  f.client.listPosts = async () => [f.post];
  assert.equal((await f.run()).reused, true);
  assert.equal(f.calls.creates, 1);
});

test("a rerender with different bytes on the same day stops against the remote receipt", async (t) => {
  const f = fixture(t);
  await f.run();
  await assert.rejects(f.run({ plan: { ...f.plan, fingerprint: "b".repeat(64) } }), { code: "receipt_conflict" });
  assert.equal(f.calls.creates, 1);
});

test("competing runners reading the same empty state cannot both obtain permission to create", async (t) => {
  const f = fixture(t);
  let reads = 0;
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  f.server.beforeGet = async () => { if (++reads === 2) release(); await barrier; };
  const results = await Promise.allSettled([f.run(), f.run()]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.find((r) => r.status === "rejected").reason.code, "receipt_store_conflict");
  assert.equal(f.calls.creates, 1);
  assert.equal(f.server.state().entries[f.plan.key].state, "draft");
});

test("a failed pre-send commit prevents Buffer calls and does not fall back to local state", async (t) => {
  const f = fixture(t);
  f.server.beforePut = async () => json({ message: "branch protection" }, 403);
  await assert.rejects(f.run(), { code: "receipt_store_write_failed" });
  assert.equal(f.calls.creates, 0);
  assert.deepEqual(f.server.state().entries, {});
  assert.equal(existsSync(join(f.dir, ".buffer-state")), false);
});

test("uncertain pre-send commit never calls Buffer and conservatively blocks a subsequent runner", async (t) => {
  const f = fixture(t);
  f.server.afterPut = async () => { throw new Error("mock-github-token lost acknowledgement"); };
  await assert.rejects(f.run(), { code: "receipt_store_write_uncertain" });
  assert.equal(f.calls.creates, 0);
  assert.equal(f.server.state().entries[f.plan.key].state, "creating");
  f.server.afterPut = null;
  await assert.rejects(f.run(), { code: "creation_outcome_unknown" });
  assert.equal(f.calls.creates, 0);
});

test("final save failure after Buffer success retains creating on GitHub and cannot create again", async (t) => {
  const f = fixture(t);
  let puts = 0;
  f.server.beforePut = async () => ++puts === 2 ? json({}, 500) : null;
  await assert.rejects(f.run(), { code: "receipt_store_write_failed" });
  assert.equal(f.calls.creates, 1);
  assert.equal(f.server.state().entries[f.plan.key].state, "creating");
  await assert.rejects(f.run(), { code: "creation_outcome_unknown" });
  assert.equal(f.calls.creates, 1);
  f.client.listPosts = async () => [f.post];
  assert.equal((await f.run()).reused, true);
});

test("failure to save unknown also leaves the earlier durable creating barrier", async (t) => {
  const f = fixture(t);
  let puts = 0;
  f.server.beforePut = async () => ++puts === 2 ? json({}, 409) : null;
  f.client.createDraft = async () => { f.calls.creates++; throw new Error("timeout"); };
  await assert.rejects(f.run(), { code: "receipt_store_conflict" });
  assert.equal(f.server.state().entries[f.plan.key].state, "creating");
  await assert.rejects(f.run(), { code: "creation_outcome_unknown" });
  assert.equal(f.calls.creates, 1);
});

test("an unrelated receipt update during Buffer creation is never overwritten by a stale runner", async (t) => {
  const f = fixture(t);
  const create = f.client.createDraft;
  f.client.createDraft = async (input) => {
    const result = await create(input);
    const updated = f.server.state();
    updated.entries["another-channel:20261015"] = { fingerprint: "a".repeat(64), state: "creating" };
    f.server.replace(JSON.stringify(updated));
    return result;
  };
  await assert.rejects(f.run(), { code: "receipt_store_conflict" });
  assert.equal(f.server.state().entries[f.plan.key].state, "creating");
  assert.equal(f.server.state().entries["another-channel:20261015"].state, "creating");
  await assert.rejects(f.run(), { code: "creation_outcome_unknown" });
  assert.equal(f.calls.creates, 1);
});

test("lost final acknowledgement recovers the committed draft ID in a new runner", async (t) => {
  const f = fixture(t);
  let puts = 0;
  f.server.afterPut = async () => { if (++puts === 2) throw new Error("ack lost"); };
  await assert.rejects(f.run(), { code: "receipt_store_write_uncertain" });
  assert.equal(f.server.state().entries[f.plan.key].state, "draft");
  assert.equal((await f.run()).reused, true);
  assert.equal(f.calls.creates, 1);
});

test("confirmed rejection is durably recorded before a different runner may retry", async (t) => {
  const f = fixture(t);
  const create = f.client.createDraft;
  f.client.createDraft = async () => { f.calls.creates++; return { rejected: "InvalidInputError" }; };
  await assert.rejects(f.run(), { code: "creation_rejected" });
  assert.equal(f.server.state().entries[f.plan.key].state, "rejected");
  f.client.createDraft = create;
  assert.equal((await f.run()).state, "draft");
  assert.equal(f.calls.creates, 2);
});

test("missing, cached, corrupt, or unreadable remote state never initializes a new empty ledger", async (t) => {
  const f = fixture(t);
  for (const status of [403, 404, 304, 500]) {
    f.server.beforeGet = async () => new Response(null, { status });
    await assert.rejects(f.run(), { code: "receipt_store_read_failed" });
  }
  f.server.beforeGet = async (file) => json({ ...file, content: "e30=" });
  await assert.rejects(f.run(), { code: "invalid_remote_receipt" });
  f.server.beforeGet = null;
  f.server.replace("invalid-json");
  await assert.rejects(f.run(), { code: "invalid_receipt_file" });
  for (const entry of [null, {}, { state: "draft", fingerprint: f.plan.fingerprint }, { state: "unknown", fingerprint: "broken-hash" }]) {
    f.server.replace(JSON.stringify({ version: 1, entries: { [f.plan.key]: entry } }));
    await assert.rejects(f.run(), { code: "invalid_receipt_file" });
  }
  assert.equal(f.calls.creates, 0);
  assert.equal(f.server.writes.length, 0);
});

test("missing/wrong write acknowledgement cannot authorize Buffer creation", async (t) => {
  const f = fixture(t);
  f.server.afterPut = async () => json({ content: { sha: "0".repeat(40) } });
  await assert.rejects(f.run(), { code: "receipt_store_write_uncertain" });
  assert.equal(f.calls.creates, 0);
});

test("wrong repository and absent write version are rejected without requests", async () => {
  const fetchImpl = async () => assert.fail("network call");
  assert.throws(() => createGitHubReceiptStore({ token: "mock", repository: "other/repo", fetchImpl }), { code: "unexpected_receipt_repository" });
  const store = createGitHubReceiptStore({ token: "mock", repository: RECEIPT_REPOSITORY, fetchImpl });
  await assert.rejects(store.save({ version: 1, entries: {} }, null), { code: "receipt_version_missing" });
});

test("enabled pipeline wrapper uses the shared GitHub store and keeps GitHub authorization off media requests", async (t) => {
  const f = fixture(t);
  const env = {
    GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: RECEIPT_REPOSITORY,
    GITHUB_TOKEN: "mock-github-token", BUFFER_DRAFTS_ENABLED: "true", BUFFER_DRAFT_STATE_BACKEND: "github",
    BUFFER_CHANNEL_ID: channel.id, BUFFER_ORGANIZATION_ID: channel.organizationId,
  };
  const fetchImpl = (requestUrl, options) => requestUrl.startsWith("https://api.github.com/") ? f.server.fetch(requestUrl, options) : f.media(requestUrl, options);
  const run = () => maybeCreateBufferDraft({ env, videoPath: f.videoPath, videoUrl: url, captionsPath: f.captionsPath, fetchImpl, client: f.client });
  assert.equal((await run()).reused, false);
  assert.equal((await run()).reused, true);
  assert.equal(f.calls.creates, 1);
  env.BUFFER_DRAFT_STATE_BACKEND = "file";
  await assert.rejects(run(), { code: "persistent_state_not_configured" });
});
