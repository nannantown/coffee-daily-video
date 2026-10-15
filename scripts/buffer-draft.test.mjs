import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBufferDraftPlan, createBufferClient, ensureBufferDraft, maybeCreateBufferDraft } from "./buffer-draft.mjs";
import { main as cli } from "./create-buffer-draft.mjs";

const videoUrl = "https://github.com/nannantown/coffee-daily-video/releases/download/v20261015/coffee-20261015.mp4";
const channel = { id: "channel-1", name: "@opengroundcoffee", service: "tiktok", organizationId: "org-1", isDisconnected: false, isLocked: false };
const captions = { date: { compact: "20261015" }, instagram: "今日の抽出のコツ\n#コーヒー" };
const response = (data) => ({ ok: true, json: async () => ({ data }) });

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "buffer-draft-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const videoPath = join(dir, "coffee-20261015.mp4");
  const captionsPath = join(dir, "captions.json");
  const statePath = join(dir, "receipts.json");
  writeFileSync(videoPath, "mock-mp4-bytes");
  writeFileSync(captionsPath, JSON.stringify(captions));
  const plan = buildBufferDraftPlan({ videoPath, videoUrl, captions, channelId: channel.id, organizationId: channel.organizationId });
  const calls = { creates: 0, lists: 0, media: 0 };
  const post = { id: "draft-1", channelId: channel.id, text: captions.instagram, status: "draft", dueAt: null, assets: [{ source: videoUrl }] };
  const client = {
    getChannel: async () => channel,
    getPost: async () => post,
    listPosts: async () => { calls.lists++; return []; },
    createDraft: async (input) => {
      calls.creates++;
      // Receipt exists before any mutation starts, including during a process crash.
      assert.equal(JSON.parse(readFileSync(statePath, "utf8")).entries[plan.key].state, "creating");
      assert.equal(input.saveToDraft, true);
      assert.equal(Object.hasOwn(input, "dueAt"), false);
      return { post };
    },
  };
  const fetchImpl = async (url, options) => {
    calls.media++;
    assert.equal(url, videoUrl);
    assert.equal(options.method, "HEAD");
    assert.equal(options.headers, undefined);
    assert.equal(options.credentials, "omit");
    return { ok: true, headers: new Headers({ "content-length": "123" }) };
  };
  const run = (overrides = {}) => ensureBufferDraft({ plan, client, statePath, fetchImpl, ...overrides });
  const state = () => JSON.parse(readFileSync(statePath, "utf8"));
  return { dir, videoPath, captionsPath, statePath, plan, calls, post, client, fetchImpl, run, state };
}

test("draft input is fixed, date/media match, and rerendered bytes change its fingerprint", (t) => {
  const f = fixture(t);
  assert.equal(f.plan.input.saveToDraft, true);
  assert.equal(f.plan.input.schedulingType, "notification");
  assert.equal(Object.hasOwn(f.plan.input, "dueAt"), false);
  assert.deepEqual(f.plan.input.metadata, { tiktok: { isAiGenerated: true } });
  const build = (opts) => buildBufferDraftPlan({ videoPath: f.videoPath, videoUrl, captions, channelId: channel.id, organizationId: channel.organizationId, ...opts });
  assert.throws(() => build({ captions: { ...captions, date: { compact: "20261014" } } }), { code: "video_caption_date_mismatch" });
  for (const url of ["http://localhost/video.mp4", `${videoUrl}?token=secret`, videoUrl.replace("nannantown", "other")]) {
    assert.throws(() => build({ videoUrl: url }), { code: "unexpected_video_url" });
  }
  writeFileSync(f.videoPath, "different-video");
  assert.notEqual(build({}).fingerprint, f.plan.fingerprint);
  assert.equal(build({}).key, f.plan.key);
});

test("disabled/dry-run does not read credentials, files, or call a client", async () => {
  for (const values of [{}, { DRY_RUN: "true", BUFFER_DRAFTS_ENABLED: "true" }]) {
    const env = Object.defineProperty(values, "BUFFER_ACCESS_TOKEN", { get() { throw new Error("credential read"); } });
    const result = await maybeCreateBufferDraft({ env });
    assert.equal(result.state, "skipped");
  }
});

test("CI needs main and the remote receipt backend before reading credentials or inputs", async () => {
  for (const variable of ["CI", "GITHUB_ACTIONS"]) {
    const env = { BUFFER_DRAFTS_ENABLED: "true", [variable]: "true" };
    Object.defineProperty(env, "BUFFER_ACCESS_TOKEN", { get() { throw new Error("credential read"); } });
    await assert.rejects(maybeCreateBufferDraft({ env }), { code: "persistent_state_not_configured" });
  }
});

test("local live entry point also requires the shared GitHub store rather than a private local receipt", async (t) => {
  const f = fixture(t);
  const env = { BUFFER_DRAFTS_ENABLED: "true", BUFFER_CHANNEL_ID: channel.id, BUFFER_ORGANIZATION_ID: channel.organizationId, GITHUB_REPOSITORY: "nannantown/coffee-daily-video" };
  await assert.rejects(maybeCreateBufferDraft({ env, videoPath: f.videoPath, videoUrl, captionsPath: f.captionsPath, client: f.client, fetchImpl: f.fetchImpl }), { code: "receipt_authentication_missing" });
  assert.equal(f.calls.creates, 0);
});

test("a changed plan cannot route creation to an unchecked channel or media URL", async (t) => {
  const f = fixture(t);
  for (const input of [{ ...f.plan.input, channelId: "other" }, { ...f.plan.input, assets: [{ video: { url: "https://example.com/other.mp4" } }] }]) {
    await assert.rejects(f.run({ plan: { ...f.plan, input } }), { code: "unsafe_draft_input" });
  }
  assert.equal(f.calls.creates, 0);
});

test("creates once, records evidence separately from publication, and verifies the same ID on rerun", async (t) => {
  const f = fixture(t);
  assert.deepEqual(await f.run(), { state: "draft", postId: "draft-1", reused: false });
  assert.deepEqual(await f.run(), { state: "draft", postId: "draft-1", reused: true });
  assert.equal(f.calls.creates, 1);
  assert.equal(f.calls.media, 1);
  assert.equal(f.state().entries[f.plan.key].state, "draft");
  assert.equal(existsSync(`${f.statePath}.lock`), false);
});

test("wrong account, organization, service, disconnected or locked channel prevents creation", async (t) => {
  const f = fixture(t);
  for (const changed of [{ name: "somebodyelse" }, { organizationId: "another-org" }, { service: "instagram" }, { id: "another-channel" }, { isDisconnected: true }, { isLocked: true }]) {
    f.client.getChannel = async () => ({ ...channel, ...changed });
    await assert.rejects(f.run(), { code: "unexpected_channel" });
  }
  assert.equal(f.calls.creates, 0);
  assert.equal(existsSync(f.statePath), false);
});

test("same day changed video/caption cannot silently replace or duplicate a draft", async (t) => {
  const f = fixture(t);
  await f.run();
  await assert.rejects(f.run({ plan: { ...f.plan, fingerprint: "changed-content" } }), { code: "receipt_conflict" });
  assert.equal(f.calls.creates, 1);
});

test("timeout after mutation leaves unknown evidence and never automatically resends", async (t) => {
  const f = fixture(t);
  f.client.createDraft = async () => { f.calls.creates++; throw new Error("Bearer private-token transport details"); };
  await assert.rejects(f.run(), { code: "creation_outcome_unknown", message: "Buffer draft: creation_outcome_unknown. See docs/buffer-tiktok-drafts.md." });
  assert.equal(f.state().entries[f.plan.key].state, "unknown");
  await assert.rejects(f.run(), { code: "creation_outcome_unknown" });
  assert.equal(f.calls.creates, 1);
  assert.doesNotMatch(readFileSync(f.statePath, "utf8"), /private-token|Bearer/);
});

test("unknown result reconciles exact remote draft without another mutation", async (t) => {
  const f = fixture(t);
  f.client.createDraft = async () => { f.calls.creates++; throw new Error("timeout"); };
  await assert.rejects(f.run());
  f.client.listPosts = async () => [f.post];
  assert.deepEqual(await f.run(), { state: "draft", postId: "draft-1", reused: true });
  assert.equal(f.calls.creates, 1);
});

test("interrupted creating receipt without remote proof stops even after a fresh process starts", async (t) => {
  const f = fixture(t);
  writeFileSync(f.statePath, JSON.stringify({ version: 1, entries: { [f.plan.key]: { state: "creating", fingerprint: f.plan.fingerprint } } }));
  await assert.rejects(f.run(), { code: "creation_outcome_unknown" });
  assert.equal(f.calls.creates, 0);
});

test("fresh receipt adopts exact remote draft; rewritten URLs or duplicate matches stop for review", async (t) => {
  const f = fixture(t);
  f.client.listPosts = async () => [{ ...f.post, assets: [{ source: "https://buffer.example/imported.mp4" }] }];
  await assert.rejects(f.run(), { code: "ambiguous_existing_post" });
  f.client.listPosts = async () => [f.post, { ...f.post, id: "draft-2" }];
  await assert.rejects(f.run(), { code: "multiple_matching_posts" });
  f.client.listPosts = async () => [f.post];
  assert.equal((await f.run()).reused, true);
  assert.equal(f.calls.creates, 0);
});

test("confirmed rejection can be retried after a new read; ambiguous failure cannot", async (t) => {
  const f = fixture(t);
  const create = f.client.createDraft;
  f.client.createDraft = async () => ({ rejected: "InvalidInputError" });
  await assert.rejects(f.run(), { code: "creation_rejected" });
  assert.equal(f.state().entries[f.plan.key].state, "rejected");
  f.client.createDraft = create;
  assert.equal((await f.run()).state, "draft");
  assert.equal(f.calls.lists, 2);
});

test("remote scheduled/sent posts, deleted recorded posts, or scheduled creation result never cause another create", async (t) => {
  const f = fixture(t);
  f.client.listPosts = async () => [{ ...f.post, status: "sent" }];
  await assert.rejects(f.run(), { code: "post_is_not_unscheduled_draft" });
  f.client.listPosts = async () => [];
  f.post.dueAt = "2026-10-16T00:00:00Z";
  await assert.rejects(f.run(), { code: "post_is_not_unscheduled_draft" });
  assert.equal(f.state().entries[f.plan.key].state, "unknown");
  assert.equal(f.state().entries[f.plan.key].postId, f.post.id);
  await assert.rejects(f.run(), { code: "post_is_not_unscheduled_draft" });
  f.client.getPost = async () => null;
  await assert.rejects(f.run(), { code: "recorded_post_missing" });
  assert.equal(f.calls.creates, 1);
});

test("unavailable media, incomplete remote reads or corrupt receipts prevent mutation", async (t) => {
  const f = fixture(t);
  await assert.rejects(f.run({ fetchImpl: async () => ({ ok: false }) }), { code: "public_video_unavailable" });
  f.client.listPosts = async () => [{ ...f.post, assets: null }];
  await assert.rejects(f.run(), { code: "invalid_post_response" });
  writeFileSync(f.statePath, "broken-json");
  await assert.rejects(f.run(), { code: "invalid_receipt_file" });
  assert.equal(readFileSync(f.statePath, "utf8"), "broken-json");
  assert.equal(f.calls.creates, 0);
});

test("concurrent and stale-lock runs stop rather than bypassing the shared lock", async (t) => {
  const f = fixture(t);
  let release;
  let entered;
  const ready = new Promise((r) => { entered = r; });
  const resume = new Promise((r) => { release = r; });
  const create = f.client.createDraft;
  f.client.createDraft = async (input) => { entered(); await resume; return create(input); };
  const first = f.run();
  await ready;
  await assert.rejects(f.run(), { code: "receipt_locked" });
  release();
  await first;
  writeFileSync(`${f.statePath}.lock`, "old process");
  await assert.rejects(f.run(), { code: "receipt_locked" });
  assert.equal(f.calls.creates, 1);
});

test("GraphQL client uses official endpoint, paginates all statuses, and sends only draft creation", async (t) => {
  const f = fixture(t);
  const requests = [];
  const client = createBufferClient({ token: "mock-token", fetchImpl: async (url, options) => {
    assert.equal(url, "https://api.buffer.com");
    assert.equal(options.headers.Authorization, "Bearer mock-token");
    assert.equal(options.redirect, "error");
    const body = JSON.parse(options.body);
    requests.push(body);
    if (body.query.includes("query DraftChannel")) return response({ channel });
    if (body.query.includes("query DraftReceipt")) return response({ post: f.post });
    if (body.query.includes("query DraftDuplicates")) {
      assert.deepEqual(body.variables.input.filter, { channelIds: [channel.id] });
      return response({ posts: { edges: body.variables.after ? [{ node: f.post }] : [], pageInfo: { hasNextPage: !body.variables.after, endCursor: "cursor-1" } } });
    }
    assert.match(body.query, /^mutation CoffeeTikTokDraft/);
    assert.equal(body.variables.input.saveToDraft, true);
    assert.equal(Object.hasOwn(body.variables.input, "dueAt"), false);
    return response({ createPost: { __typename: "PostActionSuccess", post: f.post } });
  } });
  assert.deepEqual(await client.getChannel(channel.id), channel);
  assert.deepEqual(await client.getPost(f.post.id), f.post);
  assert.deepEqual(await client.listPosts(channel.organizationId, channel.id), [f.post]);
  assert.deepEqual(await client.createDraft(f.plan.input), { post: f.post });
  const count = requests.length;
  for (const input of [{ ...f.plan.input, saveToDraft: false }, { ...f.plan.input, mode: "shareNow" }, { ...f.plan.input, dueAt: null }]) {
    await assert.rejects(client.createDraft(input), { code: "unsafe_draft_input" });
  }
  assert.equal(requests.length, count);
  assert.equal(requests.filter((r) => r.query.startsWith("mutation")).length, 1);
});

test("GraphQL read failures and repeated cursors stop; API failures never expose raw secrets", async (t) => {
  const f = fixture(t);
  for (const body of [{ errors: [{ message: "secret-token" }] }, { data: { createPost: { __typename: "UnexpectedError", message: "secret-token" } } }]) {
    const client = createBufferClient({ token: "secret-token", fetchImpl: async () => ({ ok: true, json: async () => body }) });
    await assert.rejects(client.createDraft(f.plan.input), (error) => !error.message.includes("secret-token"));
  }
  const client = createBufferClient({ token: "mock", fetchImpl: async () => response({ posts: { edges: [], pageInfo: { hasNextPage: true, endCursor: "same" } } }) });
  await assert.rejects(client.listPosts(channel.organizationId, channel.id), { code: "incomplete_post_scan" });
});

test("standalone command previews by default even when live environment is present, rejects publish flags", async (t) => {
  const f = fixture(t);
  const args = [`--video=${f.videoPath}`, `--video-url=${videoUrl}`, `--captions=${f.captionsPath}`];
  const env = { BUFFER_DRAFTS_ENABLED: "true" };
  Object.defineProperty(env, "BUFFER_ACCESS_TOKEN", { get() { throw new Error("preview read credential"); } });
  Object.defineProperty(env, "GITHUB_TOKEN", { get() { throw new Error("preview read credential"); } });
  assert.equal((await cli(args, env)).state, "preview");
  assert.equal((await cli([...args, "--write-draft", "--dry-run"], env)).state, "preview");
  assert.equal(existsSync(f.statePath), false);
  await assert.rejects(cli([...args, "--publish"], env), { code: "invalid_argument" });
  assert.equal((await cli([...args, "--write-draft"], Object.create(env, { BUFFER_DRAFTS_ENABLED: { value: "false" } }))).state, "skipped");
});
