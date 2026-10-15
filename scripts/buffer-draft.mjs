/** Buffer TikTok drafts only. No publish, update, delete, or scheduling operations. */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { BufferDraftError, createGitHubReceiptStore, createLocalReceiptStore } from "./buffer-draft-state.mjs";
export { BufferDraftError } from "./buffer-draft-state.mjs";

const ENDPOINT = "https://api.buffer.com";
const TARGET = "opengroundcoffee";
const POST_FIELDS = "id channelId status dueAt text assets { source }";
const REJECTIONS = new Set(["InvalidInputError", "NotFoundError", "UnauthorizedError", "LimitReachedError"]);

const fail = (code) => { throw new BufferDraftError(code); };
const hash = (value) => createHash("sha256").update(value).digest("hex");

export function buildBufferDraftPlan({ videoPath, videoUrl, captions, channelId, organizationId }) {
  const filename = basename(videoPath);
  const date = /^coffee-(\d{8})\.mp4$/.exec(filename)?.[1];
  if (!date || captions?.date?.compact !== date) fail("video_caption_date_mismatch");
  if (typeof captions.instagram !== "string" || !captions.instagram.trim()) fail("caption_missing");
  if (!channelId || !organizationId) fail("channel_configuration_missing");
  // Reuse this repository's existing public release asset; never upload new media here.
  const expectedUrl = `https://github.com/nannantown/coffee-daily-video/releases/download/v${date}/${filename}`;
  if (videoUrl !== expectedUrl) fail("unexpected_video_url");
  const bytes = readFileSync(videoPath);
  if (!bytes.length) fail("empty_video");
  const videoSha256 = hash(bytes);
  const input = {
    channelId,
    text: captions.instagram,
    assets: [{ video: { url: videoUrl, metadata: { thumbnailOffset: 1500 } } }],
    metadata: { tiktok: { isAiGenerated: true } },
    aiAssisted: true,
    saveToDraft: true,
    needsApproval: false,
    // Required API enums. saveToDraft overrides mode; no dueAt is supplied.
    mode: "addToQueue",
    schedulingType: "notification",
    source: "coffee-daily-video",
  };
  return {
    key: `${channelId}:${date}`, date, channelId, organizationId, videoUrl, videoSha256,
    fingerprint: hash(JSON.stringify({ input, videoSha256, organizationId })), input,
  };
}

function assertDraftInput(input) {
  if (input?.saveToDraft !== true || input.needsApproval !== false ||
      input.mode !== "addToQueue" || input.schedulingType !== "notification" ||
      Object.hasOwn(input, "dueAt")) fail("unsafe_draft_input");
}

/** Errors never include headers, tokens, request bodies, or raw API messages. */
export function createBufferClient({ token, fetchImpl = fetch }) {
  if (typeof token !== "string" || !token.trim()) fail("authentication_missing");
  async function request(query, variables) {
    let response;
    try {
      response = await fetchImpl(ENDPOINT, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(30_000),
        redirect: "error",
      });
      if (!response.ok) fail("api_request_failed");
      const body = await response.json();
      if (body?.errors?.length || !body?.data) fail("api_request_failed");
      return body.data;
    } catch {
      fail("api_request_failed");
    }
  }
  return {
    async listOrganizations() {
      const organizations = (await request("query DraftOrganizations { account { organizations { id } } }", {})).account?.organizations;
      if (!Array.isArray(organizations) || organizations.some((org) => typeof org?.id !== "string")) fail("invalid_account_response");
      return organizations;
    },
    async listChannels(organizationId) {
      const channels = (await request(`query DraftChannels($input: ChannelsInput!) {
        channels(input: $input) { id name service organizationId isDisconnected isLocked }
      }`, { input: { organizationId } })).channels;
      if (!Array.isArray(channels)) fail("invalid_channel_response");
      return channels;
    },
    async inspectPost(id) {
      return (await request(`query DraftInspection($input: PostInput!) {
        post(input: $input) {
          ${POST_FIELDS} sentAt externalLink
          assets { type mimeType thumbnail ... on VideoAsset {
            video { durationMs width height isVideoProcessing isTranscodingRequired }
          } }
        }
      }`, { input: { id } })).post;
    },
    async getChannel(id) {
      return (await request(`query DraftChannel($input: ChannelInput!) {
        channel(input: $input) { id name service organizationId isDisconnected isLocked }
      }`, { input: { id } })).channel;
    },
    async getPost(id) {
      return (await request(`query DraftReceipt($input: PostInput!) {
        post(input: $input) { ${POST_FIELDS} }
      }`, { input: { id } })).post;
    },
    async listPosts(organizationId, channelId) {
      const posts = [];
      const cursors = new Set();
      let after = null;
      // Scan every status: a user may already have scheduled/published a former draft.
      for (let page = 0; page < 100; page++) {
        const result = (await request(`query DraftDuplicates($input: PostsInput!, $after: String) {
          posts(input: $input, first: 100, after: $after) {
            edges { node { ${POST_FIELDS} } } pageInfo { hasNextPage endCursor }
          }
        }`, { input: { organizationId, filter: { channelIds: [channelId] } }, after })).posts;
        if (!Array.isArray(result?.edges) || typeof result?.pageInfo?.hasNextPage !== "boolean") fail("incomplete_post_scan");
        for (const edge of result.edges) {
          assertPost(edge?.node, channelId);
          posts.push(edge.node);
        }
        if (!result.pageInfo.hasNextPage) return posts;
        after = result.pageInfo.endCursor;
        if (typeof after !== "string" || !after || cursors.has(after)) fail("incomplete_post_scan");
        cursors.add(after);
      }
      fail("post_scan_limit");
    },
    async createDraft(input) {
      assertDraftInput(input);
      const result = (await request(`mutation CoffeeTikTokDraft($input: CreatePostInput!) {
        createPost(input: $input) {
          __typename
          ... on PostActionSuccess { post { ${POST_FIELDS} } }
          ... on MutationError { message }
        }
      }`, { input })).createPost;
      if (result?.__typename === "PostActionSuccess") return { post: result.post };
      // A transport/top-level/unexpected failure can occur after creation; never retry it blindly.
      if (REJECTIONS.has(result?.__typename)) return { rejected: result.__typename };
      fail("creation_outcome_unknown");
    },
  };
}

function assertPost(post, channelId) {
  if (typeof post?.id !== "string" || !post.id || post.channelId !== channelId || typeof post.text !== "string" ||
      typeof post.status !== "string" || !Object.hasOwn(post, "dueAt") ||
      !Array.isArray(post.assets) || post.assets.some((a) => typeof a?.source !== "string")) fail("invalid_post_response");
}
function assertUnscheduledDraft(post, channelId) {
  assertPost(post, channelId);
  if (post.status !== "draft" || post.dueAt !== null) fail("post_is_not_unscheduled_draft");
}
async function assertPublicVideo(videoUrl, fetchImpl) {
  try {
    // Deliberately no Buffer authorization on the media request, including redirects.
    const response = await fetchImpl(videoUrl, { method: "HEAD", redirect: "follow", credentials: "omit", signal: AbortSignal.timeout(30_000) });
    if (!response.ok || response.headers.get("content-length") === "0") fail("public_video_unavailable");
  } catch { fail("public_video_unavailable"); }
}

/** The receipt must live on persistent storage, shared by all writers for this channel. */
export async function ensureBufferDraft({ plan, client, statePath, receiptStore, fetchImpl = fetch, now = () => new Date().toISOString() }) {
  assertDraftInput(plan.input);
  if (plan.input.channelId !== plan.channelId || plan.input.assets?.length !== 1 ||
      plan.input.assets[0]?.video?.url !== plan.videoUrl) fail("unsafe_draft_input");
  const store = receiptStore ?? createLocalReceiptStore({ statePath, now });
  return store.withLock(async () => {
    const snapshot = await store.load();
    const state = snapshot.state;
    let version = snapshot.version;
    const persist = async () => { version = await store.save(state, version); };
    const previous = state.entries[plan.key];
    if (previous && (previous.fingerprint !== plan.fingerprint || !["creating", "unknown", "rejected", "draft"].includes(previous.state))) fail("receipt_conflict");
    const channel = await client.getChannel(plan.channelId);
    if (channel?.id !== plan.channelId || channel.service !== "tiktok" ||
        channel.organizationId !== plan.organizationId ||
        String(channel.name).replace(/^@/, "").toLowerCase() !== TARGET ||
        channel.isDisconnected !== false || channel.isLocked !== false) fail("unexpected_channel");
    if (previous?.postId) {
      const post = await client.getPost(previous.postId);
      if (!post) fail("recorded_post_missing"); // Deleted does not mean safe to recreate.
      if (post.id !== previous.postId) fail("invalid_post_response");
      assertUnscheduledDraft(post, plan.channelId);
      state.entries[plan.key] = { ...previous, state: "draft", verifiedAt: now() };
      await persist();
      return { state: "draft", postId: post.id, reused: true };
    }
    const posts = await client.listPosts(plan.organizationId, plan.channelId);
    if (!Array.isArray(posts)) fail("incomplete_post_scan");
    posts.forEach((p) => assertPost(p, plan.channelId));
    const matches = posts.filter((p) => p.text === plan.input.text || p.assets.some((a) => a.source === plan.videoUrl));
    if (matches.length > 1) fail("multiple_matching_posts");
    if (matches.length === 1) {
      const post = matches[0];
      // Buffer may replace imported asset URLs. Text alone is insufficient proof of identity.
      if (post.text !== plan.input.text || !post.assets.some((a) => a.source === plan.videoUrl)) fail("ambiguous_existing_post");
      assertUnscheduledDraft(post, plan.channelId);
      state.entries[plan.key] = { fingerprint: plan.fingerprint, videoSha256: plan.videoSha256, state: "draft", postId: post.id, verifiedAt: now() };
      await persist();
      return { state: "draft", postId: post.id, reused: true };
    }
    if (previous && previous.state !== "rejected") fail("creation_outcome_unknown");
    await assertPublicVideo(plan.videoUrl, fetchImpl);
    const receipt = { fingerprint: plan.fingerprint, videoSha256: plan.videoSha256, state: "creating", attemptId: randomUUID(), attemptedAt: now() };
    state.entries[plan.key] = receipt;
    await persist(); // Confirmed on persistent storage before the only mutation.
    try {
      const result = await client.createDraft(plan.input);
      if (result?.rejected && REJECTIONS.has(result.rejected)) {
        state.entries[plan.key] = { ...receipt, state: "rejected", reason: result.rejected };
        await persist();
        fail("creation_rejected");
      }
      const post = result?.post;
      // Retain any returned ID even if the draft invariant is violated, preventing another create.
      if (typeof post?.id === "string" && post.id) receipt.postId = post.id;
      assertUnscheduledDraft(post, plan.channelId);
      state.entries[plan.key] = { ...receipt, state: "draft", verifiedAt: now() };
      await persist();
      return { state: "draft", postId: post.id, reused: false };
    } catch (error) {
      if (state.entries[plan.key].state === "creating") {
        state.entries[plan.key] = { ...receipt, state: "unknown" };
        await persist();
      }
      // Do not propagate API/transport error messages (may contain credentials).
      if (error instanceof BufferDraftError) throw error;
      fail("creation_outcome_unknown");
    }
  });
}

/** Disabled and DRY_RUN paths do not read credentials or contact Buffer/media. */
export async function maybeCreateBufferDraft({ env = process.env, videoPath, videoUrl, captionsPath, fetchImpl = fetch, client }) {
  if (env.DRY_RUN === "true") return { state: "skipped", reason: "dry_run" };
  if (env.BUFFER_DRAFTS_ENABLED !== "true") return { state: "skipped", reason: "disabled" };
  const isCI = env.CI === "true" || env.GITHUB_ACTIONS === "true";
  if (isCI && env.GITHUB_REF !== "refs/heads/main") fail("persistent_state_not_configured");
  if ((env.BUFFER_DRAFT_STATE_BACKEND ?? "github") !== "github") fail("persistent_state_not_configured");
  // All live entry points share this remote store, including standalone retries.
  // A local receipt must never let a different writer bypass an unknown CI send.
  const receiptStore = createGitHubReceiptStore({ token: env.GITHUB_TOKEN, repository: env.GITHUB_REPOSITORY, fetchImpl });
  const plan = buildBufferDraftPlan({ videoPath, videoUrl, captions: JSON.parse(readFileSync(captionsPath, "utf8")), channelId: env.BUFFER_CHANNEL_ID, organizationId: env.BUFFER_ORGANIZATION_ID });
  return ensureBufferDraft({ plan, receiptStore, fetchImpl, client: client ?? createBufferClient({ token: env.BUFFER_ACCESS_TOKEN, fetchImpl }) });
}
