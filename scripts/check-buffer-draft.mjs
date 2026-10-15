/** Manual, one-video Buffer check. No pipeline/post-sns imports, no publish or schedule. */
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { BufferDraftError, buildBufferDraftPlan, createBufferClient, ensureBufferDraft } from "./buffer-draft.mjs";
import { createGitHubReceiptStore, RECEIPT_REPOSITORY } from "./buffer-draft-state.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (code) => { throw new BufferDraftError(code); };

export async function resolveTarget(client) {
  const matches = [];
  const organizations = await client.listOrganizations();
  if (organizations.length > 20) fail("organization_scan_limit");
  for (const org of organizations) {
    const channels = await client.listChannels(org.id);
    for (const channel of channels) {
      if (channel.service === "tiktok" && String(channel.name).replace(/^@/, "").toLowerCase() === "opengroundcoffee") {
        if (channel.organizationId !== org.id) fail("unexpected_channel");
        matches.push(channel);
      }
    }
  }
  if (matches.length !== 1) fail("target_not_unique");
  const target = matches[0];
  if (!target.id || target.isDisconnected !== false || target.isLocked !== false) fail("target_unavailable");
  return target;
}

export async function downloadRelease(date, directory, fetchImpl = fetch) {
  const name = `coffee-${date}`;
  const base = `https://github.com/${RECEIPT_REPOSITORY}/releases/download/v${date}/${name}`;
  const videoPath = join(directory, `${name}.mp4`);
  mkdirSync(directory, { recursive: true });
  const options = { redirect: "follow", credentials: "omit", signal: AbortSignal.timeout(60_000) };
  const captionsResponse = await fetchImpl(`${base}-captions.json`, options);
  if (!captionsResponse.ok) fail("release_captions_unavailable");
  const captions = await captionsResponse.json();
  if (captions?.date?.compact !== date) fail("video_caption_date_mismatch");
  const videoResponse = await fetchImpl(`${base}.mp4`, options);
  if (!videoResponse.ok) fail("release_video_unavailable");
  const bytes = Buffer.from(await videoResponse.arrayBuffer());
  if (bytes.length < 12 || bytes.subarray(4, 8).toString() !== "ftyp" || bytes.length > 100_000_000) fail("invalid_release_video");
  writeFileSync(videoPath, bytes);
  return { videoPath, videoUrl: `${base}.mp4`, captions };
}

export function draftObservation(post, postId, channelId) {
  if (post?.id !== postId || post.channelId !== channelId || post.status !== "draft" ||
      post.dueAt !== null || post.sentAt !== null || (post.externalLink !== null && post.externalLink !== "")) fail("post_is_not_unscheduled_draft");
  const assets = post.assets;
  if (!Array.isArray(assets) || assets.length !== 1 || assets[0].type !== "video" || !assets[0].video) fail("video_asset_missing");
  const asset = assets[0];
  const video = asset.video;
  const ready = video.isVideoProcessing === false && video.durationMs > 0 && video.width > 0 && video.height > 0;
  return {
    status: post.status, dueAt: post.dueAt, sentAt: post.sentAt, externalLink: post.externalLink,
    ingestion: ready ? "metadata_ready" : "processing", mimeType: asset.mimeType,
    durationMs: video.durationMs, width: video.width, height: video.height,
    isVideoProcessing: video.isVideoProcessing, isTranscodingRequired: video.isTranscodingRequired,
    thumbnailAvailable: Boolean(asset.thumbnail),
  };
}

export async function runCheck({ env = process.env, client, receiptStore, fetchImpl = fetch, download = downloadRelease, delay = sleep, attempts = 12, directory = join(root, "output", "buffer-check") } = {}) {
  const report = { ok: false, operation: env.BUFFER_CHECK_OPERATION || "inspect", createRequests: 0 };
  try {
    if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_WORKFLOW !== "Buffer TikTok Draft Check" ||
        env.GITHUB_REPOSITORY !== RECEIPT_REPOSITORY || env.GITHUB_REF !== "refs/heads/main") fail("main_repository_required");
    if (!["inspect", "create-draft", "status"].includes(report.operation)) fail("invalid_operation");
    const api = client ?? createBufferClient({ token: env.BUFFER_ACCESS_TOKEN, fetchImpl });
    const target = await resolveTarget(api);
    report.target = { channelId: target.id, organizationId: target.organizationId, handle: "@opengroundcoffee", service: "tiktok" };
    if (report.operation === "inspect") return { ...report, ok: true };
    if (env.EXPECTED_CHANNEL_ID !== target.id || env.EXPECTED_ORGANIZATION_ID !== target.organizationId) fail("target_confirmation_mismatch");
    if (report.operation === "create-draft") {
      if (env.DRAFT_CONFIRMATION !== "CREATE_ONE_DRAFT") fail("draft_confirmation_required");
      const date = env.RELEASE_DATE;
      if (!/^\d{8}$/.test(date ?? "")) fail("invalid_release_date");
      const parsedDate = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}T00:00:00Z`);
      if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10).replaceAll("-", "") !== date) fail("invalid_release_date");
      report.releaseDate = date;
      const media = await download(date, directory, fetchImpl);
      report.videoUrl = media.videoUrl;
      const plan = buildBufferDraftPlan({ ...media, channelId: target.id, organizationId: target.organizationId });
      const guardedClient = { ...api, createDraft: async (input) => { report.createRequests++; return api.createDraft(input); } };
      const result = await ensureBufferDraft({ plan, client: guardedClient, receiptStore: receiptStore ?? createGitHubReceiptStore({ token: env.GITHUB_TOKEN, repository: env.GITHUB_REPOSITORY, fetchImpl }), fetchImpl });
      report.postId = result.postId;
      report.reused = result.reused;
    } else {
      if (!env.BUFFER_POST_ID) fail("post_id_required");
      report.postId = env.BUFFER_POST_ID;
    }
    for (let i = 0; i < attempts; i++) {
      report.observation = draftObservation(await api.inspectPost(report.postId), report.postId, target.id);
      if (report.observation.ingestion === "metadata_ready") return { ...report, ok: true };
      if (i + 1 < attempts) await delay(10_000);
    }
    report.errorCode = "video_processing_pending";
  } catch (error) {
    // No raw API payloads, headers, transport messages, media URLs, or secrets.
    report.errorCode = error instanceof BufferDraftError ? error.code : "draft_check_failed";
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await runCheck();
  mkdirSync(join(root, "output"), { recursive: true });
  const json = JSON.stringify(report, null, 2);
  writeFileSync(join(root, "output", "buffer-draft-check.json"), `${json}\n`);
  console.log(json);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Buffer draft check\n\n\`\`\`json\n${json}\n\`\`\`\n`);
  process.exitCode = report.ok ? 0 : 1;
}
