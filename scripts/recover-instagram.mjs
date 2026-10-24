/** Instagram-only recovery. No YouTube, caption regeneration, or automatic reset. */
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TARGET, RECOVERY_WORKFLOWS, assertContext, createGitHubReceiptStore, fail, isId, jstDate, safeCode, sha256, validDate } from "./instagram-publish-state.mjs";
import { createInstagramClient, publishOnce } from "./upload-instagram.mjs";
import { scanBannedTerms } from "./brand-guard.mjs";
import { recipeNumberHits } from "./content-format.mjs";

const ACTIONS = new Set(["inspect", "retry", "resume_before_publish", "reconcile_published"]);
const isHash = (s) => typeof s === "string" && /^[a-f0-9]{64}$/u.test(s);
export function recoveryInput(env, now) {
  const automatic = env.GITHUB_WORKFLOW === RECOVERY_WORKFLOWS.push;
  const action = automatic ? "retry" : env.INSTAGRAM_RECOVERY_ACTION || "inspect";
  assertContext(env, action === "inspect", true);
  if (!ACTIONS.has(action) || env.REGENERATE_CAPTIONS === "true") fail("invalid_input");
  const tag = automatic ? `v${jstDate(now).replaceAll("-", "")}` : env.RELEASE_TAG;
  if (typeof tag !== "string" || !/^v20[0-9]{6}$/u.test(tag)) fail("invalid_input");
  const date = `${tag.slice(1, 5)}-${tag.slice(5, 7)}-${tag.slice(7, 9)}`;
  if (!validDate(date) || date > jstDate(now) || (!automatic && env.ASSET_NAME !== `coffee-${tag.slice(1)}.mp4`)) fail("invalid_input");
  const confirmedUnpublished = !automatic && env.CONFIRMED_UNPUBLISHED === "true";
  if (!automatic && action !== "inspect" && (!isHash(env.CONFIRM_VIDEO_SHA256) || !isHash(env.CONFIRM_CAPTIONS_SHA256))) fail("confirmation_required");
  if (action === "reconcile_published" && !isId(env.PUBLISHED_MEDIA_ID)) fail("confirmation_required");
  return { date, action, automatic, confirmedUnpublished, mediaId: action === "reconcile_published" ? env.PUBLISHED_MEDIA_ID : undefined };
}

async function downloadAsset(asset, token, fetchImpl) {
  try {
    const first = await fetchImpl(`https://api.github.com/repos/${TARGET.repository}/releases/assets/${asset.id}`, {
      method: "GET", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(120_000),
      headers: { Authorization: `Bearer ${token}`, Accept: "application/octet-stream", "Cache-Control": "no-cache" },
    });
    let response = first;
    if (first.status === 302) {
      const target = new URL(first.headers.get("location"));
      if (target.protocol !== "https:" || target.hostname !== "release-assets.githubusercontent.com" || target.port || target.username || target.password || target.hash) fail("source_unverified");
      // Never forward GitHub or Instagram credentials to the signed asset URL.
      response = await fetchImpl(target.href, { method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(120_000) });
    }
    if (!response.ok || response.status !== 200) fail("source_unverified");
    const length = response.headers?.get("content-length");
    if (length && Number(length) !== asset.size) fail("source_unverified");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== asset.size || sha256(bytes) !== asset.sha256) fail("source_changed");
    return bytes;
  } catch (error) {
    if (["source_changed", "source_unverified"].includes(safeCode(error))) throw error;
    fail("source_unverified");
  }
}

export async function runRecovery({ env, prepare = false, now = new Date(), fetchImpl = fetch }) {
  try {
    const input = recoveryInput(env, now);
    const store = createGitHubReceiptStore({ token: env.GITHUB_TOKEN, fetchImpl });
    const observed = await store.inspect(input.date);
    if (observed.state === "published") return { status: "already_published", date: input.date, mediaId: observed.mediaId };
    const plan = await store.sourcePlan(input.date);
    if (!input.automatic && input.action !== "inspect" &&
        (plan.video.sha256 !== env.CONFIRM_VIDEO_SHA256 || plan.captions.sha256 !== env.CONFIRM_CAPTIONS_SHA256)) fail("source_changed");
    if (prepare || input.action === "inspect") {
      // Only typed public data is returned. No Meta credential access on prepare.
      return { status: "inspected", date: input.date, state: observed.state, plan,
        ...(observed.containerId ? { containerId: observed.containerId } : {}),
        ...(observed.runId ? { runId: observed.runId } : {}) };
    }
    // A reviewed prepare job pins IDs, names, sizes and hashes. Any change
    // between jobs stops here before assets or Instagram credentials are read.
    let pinned;
    try { pinned = JSON.parse(env.INSTAGRAM_RECOVERY_PLAN); } catch { fail("source_unverified"); }
    if (JSON.stringify(pinned) !== JSON.stringify(plan)) fail("source_changed");
    let downloaded;
    const readPayload = () => downloaded;
    const verifySource = async () => {
      const fresh = await store.sourcePlan(input.date);
      if (JSON.stringify(fresh) !== JSON.stringify(plan)) fail("source_changed");
    };
    // Delay downloads until publishOnce has rejected existing/uncertain states.
    const proxyStore = { ...store };
    const originalInspect = proxyStore.inspect;
    proxyStore.inspect = async (date) => {
      const current = await originalInspect(date);
      const eligible = current.state === "absent" || (current.state === "unresolved" && input.confirmedUnpublished) ||
        (current.state === "started" && (input.action === "resume_before_publish" || input.automatic)) || input.action === "reconcile_published";
      if (eligible && current.state !== "published") {
        if (env.INSTAGRAM_RECEIPT_WRITE_ENABLED !== "true") fail("receipt_write_approval_required");
        if (input.date !== jstDate(now) && input.action !== "reconcile_published" && !input.confirmedUnpublished) fail("historical_date_requires_review");
        const videoBytes = await downloadAsset(plan.video, env.GITHUB_TOKEN, fetchImpl);
        const captionBytes = await downloadAsset(plan.captions, env.GITHUB_TOKEN, fetchImpl);
        let captions;
        try { captions = JSON.parse(captionBytes.toString("utf8")); } catch { fail("invalid_input"); }
        if (captions?.date?.compact !== plan.tag.slice(1) || typeof captions.instagram !== "string" || !captions.instagram.trim() || captions.instagram.length > 2200) fail("source_unverified");
        if (scanBannedTerms([["instagram", captions.instagram]]).length || recipeNumberHits([["instagram", captions.instagram]]).length) fail("source_unverified");
        downloaded = { videoBytes, captionBytes, caption: captions.instagram, thumbOffset: captions.format ? 1500 : 7000,
          videoSha256: sha256(videoBytes), captionSha256: sha256(captionBytes) };
      }
      return current;
    };
    return await publishOnce({ env, date: input.date, now, store: proxyStore, recovery: { ...input, verifySource },
      readPayload, makeClient: () => createInstagramClient({ userToken: env.INSTAGRAM_ACCESS_TOKEN, fetchImpl }) });
  } catch (error) { return { status: "blocked", reason: safeCode(error) }; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const prepare = process.argv.length === 3 && process.argv[2] === "--prepare";
  const argsValid = process.argv.length === 2 || prepare;
  const result = argsValid ? await runRecovery({ env: process.env, prepare }) : { status: "blocked", reason: "invalid_input" };
  if (prepare && process.env.GITHUB_OUTPUT) {
    try {
      const writeRequired = result.status === "inspected" && (process.env.INSTAGRAM_RECOVERY_ACTION || "inspect") !== "inspect";
      appendFileSync(process.env.GITHUB_OUTPUT, `write_required=${writeRequired}\nplan=${JSON.stringify(result.plan ?? null)}\n`);
    } catch { process.stdout.write('{"status":"blocked","reason":"local_result_write_failed"}\n'); process.exit(1); }
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = ["published", "reconciled", "already_published", "inspected"].includes(result.status) ? 0 : 1;
}
