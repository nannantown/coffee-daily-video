import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCheck, resolveTarget, draftObservation, downloadRelease } from "./check-buffer-draft.mjs";
import { createBufferClient } from "./buffer-draft.mjs";
import { createLocalReceiptStore, RECEIPT_REPOSITORY } from "./buffer-draft-state.mjs";

const target = { id: "channel-1", organizationId: "org-1", name: "@opengroundcoffee", service: "tiktok", isLocked: false, isDisconnected: false };
const url = `https://github.com/${RECEIPT_REPOSITORY}/releases/download/v20261015/coffee-20261015.mp4`;
const env = {
  GITHUB_ACTIONS: "true", GITHUB_WORKFLOW: "Buffer TikTok Draft Check",
  GITHUB_REPOSITORY: RECEIPT_REPOSITORY, GITHUB_REF: "refs/heads/main", BUFFER_CHECK_OPERATION: "create-draft",
  EXPECTED_CHANNEL_ID: target.id, EXPECTED_ORGANIZATION_ID: target.organizationId, RELEASE_DATE: "20261015", DRAFT_CONFIRMATION: "CREATE_ONE_DRAFT",
};

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "buffer-single-check-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const videoPath = join(directory, "coffee-20261015.mp4");
  const bytes = Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);
  writeFileSync(videoPath, bytes);
  const captions = { date: { compact: "20261015" }, instagram: "動画のヒント" };
  const post = {
    id: "draft-1", channelId: target.id, text: captions.instagram, status: "draft", dueAt: null, sentAt: null, externalLink: null,
    assets: [{ type: "video", source: url, mimeType: "video/mp4", thumbnail: "private-thumbnail-not-logged", video: { durationMs: 40000, width: 1080, height: 1920, isVideoProcessing: false, isTranscodingRequired: false } }],
  };
  const calls = { creates: 0, downloads: 0, inspections: 0, delays: 0 };
  const client = {
    listOrganizations: async () => [{ id: "org-1" }], listChannels: async () => [target], getChannel: async () => target,
    listPosts: async () => [], getPost: async () => post,
    createDraft: async (input) => { calls.creates++; assert.equal(input.saveToDraft, true); assert.equal(Object.hasOwn(input, "dueAt"), false); return { post }; },
    inspectPost: async () => { calls.inspections++; return post; },
  };
  const download = async () => { calls.downloads++; return { videoPath, videoUrl: url, captions }; };
  const fetchImpl = async () => ({ ok: true, headers: new Headers() });
  const receiptStore = createLocalReceiptStore({ statePath: join(directory, "receipts.json") });
  const run = (overrides = {}) => runCheck({ env, client, receiptStore, download, fetchImpl, directory, delay: async () => { calls.delays++; }, ...overrides });
  return { run, client, calls, post, bytes, captions, directory };
}

test("inspect is read-only and does not request a GitHub token or media", async (t) => {
  const f = fixture(t);
  const inspectEnv = { ...env, BUFFER_CHECK_OPERATION: "inspect" };
  Object.defineProperty(inspectEnv, "GITHUB_TOKEN", { get() { throw new Error("secret accessed"); } });
  const result = await f.run({ env: inspectEnv });
  assert.equal(result.ok, true);
  assert.equal(result.target.channelId, target.id);
  assert.equal(f.calls.creates, 0);
  assert.equal(f.calls.downloads, 0);
});

test("target must be a unique connected TikTok in the matching organization", async (t) => {
  const f = fixture(t);
  for (const channels of [[], [target, { ...target, id: "another" }], [{ ...target, isLocked: true }], [{ ...target, organizationId: "other" }], [{ ...target, service: "instagram" }]]) {
    f.client.listChannels = async () => channels;
    await assert.rejects(resolveTarget(f.client));
  }
});

test("create requires exact target IDs, confirmation, and a valid date before media or mutation", async (t) => {
  const f = fixture(t);
  for (const change of [{ EXPECTED_CHANNEL_ID: "other" }, { EXPECTED_ORGANIZATION_ID: "other" }, { DRAFT_CONFIRMATION: "" }, { RELEASE_DATE: "../file" }, { RELEASE_DATE: "20261301" }, { RELEASE_DATE: "20260230" }]) {
    const result = await f.run({ env: { ...env, ...change } });
    assert.equal(result.ok, false);
  }
  assert.equal(f.calls.creates, 0);
  assert.equal(f.calls.downloads, 0);
});

test("one draft is created and verified as unscheduled/unpublished with decoded video metadata", async (t) => {
  const f = fixture(t);
  const result = await f.run();
  assert.equal(result.ok, true);
  assert.equal(result.postId, "draft-1");
  assert.equal(result.createRequests, 1);
  assert.equal(result.observation.status, "draft");
  assert.equal(result.observation.sentAt, null);
  assert.equal(result.observation.dueAt, null);
  assert.equal(result.observation.externalLink, null);
  assert.equal(result.observation.ingestion, "metadata_ready");
  assert.equal((await f.run()).reused, true);
  assert.equal(f.calls.creates, 1);
  assert.doesNotMatch(JSON.stringify(result), /private-thumbnail/);
});

test("uncertain create is not resent and raw transport details never reach report", async (t) => {
  const f = fixture(t);
  f.client.createDraft = async () => { f.calls.creates++; throw new Error("secret-buffer-token in transport"); };
  const first = await f.run();
  assert.equal(first.errorCode, "creation_outcome_unknown");
  assert.equal(first.createRequests, 1);
  assert.doesNotMatch(JSON.stringify(first), /secret-buffer-token/);
  const second = await f.run();
  assert.equal(second.errorCode, "creation_outcome_unknown");
  assert.equal(second.createRequests, 0);
  assert.equal(f.calls.creates, 1);
});

test("processing polling is bounded and status operation only reads the existing post", async (t) => {
  const f = fixture(t);
  f.post.assets[0].video.isVideoProcessing = true;
  const pending = await f.run({ attempts: 2 });
  assert.equal(pending.errorCode, "video_processing_pending");
  assert.equal(pending.postId, "draft-1");
  assert.equal(f.calls.inspections, 2);
  assert.equal(f.calls.delays, 1);
  f.post.assets[0].video.isVideoProcessing = false;
  const result = await f.run({ env: { ...env, BUFFER_CHECK_OPERATION: "status", BUFFER_POST_ID: "draft-1" } });
  assert.equal(result.ok, true);
  assert.equal(result.createRequests, 0);
  assert.equal(f.calls.creates, 1);
});

test("ready metadata cannot hide scheduled/sent/wrong posts or a missing video", async (t) => {
  const f = fixture(t);
  for (const changed of [{ id: "other" }, { channelId: "other" }, { status: "scheduled" }, { dueAt: "2026-10-16" }, { sentAt: "2026-10-15" }, { externalLink: "https://tiktok.com/example" }, { assets: [] }]) {
    assert.throws(() => draftObservation({ ...f.post, ...changed }, "draft-1", target.id));
  }
});

test("wrong ref/repository never reads the Buffer secret", async () => {
  for (const change of [{ GITHUB_ACTIONS: "false" }, { GITHUB_WORKFLOW: "Daily Coffee Video" }, { GITHUB_REF: "refs/heads/feature" }, { GITHUB_REPOSITORY: "other/repo" }]) {
    const configured = { ...env, ...change };
    Object.defineProperty(configured, "BUFFER_ACCESS_TOKEN", { get() { throw new Error("secret access"); } });
    assert.equal((await runCheck({ env: configured })).errorCode, "main_repository_required");
  }
});

test("release downloads use anonymous URLs and require matching date/MP4 bytes", async (t) => {
  const f = fixture(t);
  const fetchImpl = async (requestUrl, options) => {
    assert.equal(options.headers, undefined);
    assert.equal(options.credentials, "omit");
    assert.ok(requestUrl.startsWith(`https://github.com/${RECEIPT_REPOSITORY}/releases/download/v20261015/coffee-20261015`));
    return requestUrl.endsWith(".json") ? { ok: true, json: async () => f.captions } : { ok: true, arrayBuffer: async () => f.bytes };
  };
  assert.equal((await downloadRelease("20261015", f.directory, fetchImpl)).videoUrl, url);
});

test("discovery and inspection GraphQL queries only request needed non-secret fields", async (t) => {
  const f = fixture(t);
  const client = createBufferClient({ token: "mock-token", fetchImpl: async (_, options) => {
    const body = JSON.parse(options.body);
    assert.match(body.query, /^query /);
    assert.doesNotMatch(body.query, /email|connectedApps|mutation/);
    if (body.query.includes("DraftOrganizations")) return { ok: true, json: async () => ({ data: { account: { organizations: [{ id: "org-1" }] } } }) };
    if (body.query.includes("DraftChannels")) return { ok: true, json: async () => ({ data: { channels: [target] } }) };
    return { ok: true, json: async () => ({ data: { post: f.post } }) };
  } });
  assert.deepEqual(await client.listOrganizations(), [{ id: "org-1" }]);
  assert.deepEqual(await client.listChannels("org-1"), [target]);
  assert.equal((await client.inspectPost("draft-1")).id, "draft-1");
});
