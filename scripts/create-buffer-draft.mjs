/** Standalone retry/preview: never invokes the YouTube/Instagram orchestrator. */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BufferDraftError, buildBufferDraftPlan, maybeCreateBufferDraft } from "./buffer-draft.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function main(args = process.argv.slice(2), env = process.env) {
  const options = {};
  for (const arg of args) {
    if (arg === "--write-draft" || arg === "--dry-run") { options[arg.slice(2)] = true; continue; }
    const match = /^--(video|video-url|captions|channel-id|organization-id)=(.+)$/.exec(arg);
    if (!match) throw new BufferDraftError("invalid_argument");
    options[match[1]] = match[2];
  }
  if (!options.video || !options["video-url"]) throw new BufferDraftError("video_arguments_required");
  const videoPath = resolve(root, options.video);
  const captionsPath = resolve(root, options.captions ?? "output/captions.json");
  const channelId = options["channel-id"] ?? env.BUFFER_CHANNEL_ID;
  const organizationId = options["organization-id"] ?? env.BUFFER_ORGANIZATION_ID;
  if (!options["write-draft"] || options["dry-run"] || env.DRY_RUN === "true") {
    const plan = buildBufferDraftPlan({ videoPath, videoUrl: options["video-url"], captions: JSON.parse(readFileSync(captionsPath, "utf8")), channelId: channelId ?? "UNCONFIGURED", organizationId: organizationId ?? "UNCONFIGURED" });
    return { state: "preview", ...plan };
  }
  // Inherit lazily: disabled/dry-run guards must not enumerate secret values.
  const configuredEnv = Object.create(env);
  Object.defineProperties(configuredEnv, {
    BUFFER_CHANNEL_ID: { value: channelId, enumerable: true },
    BUFFER_ORGANIZATION_ID: { value: organizationId, enumerable: true },
  });
  return maybeCreateBufferDraft({
    env: configuredEnv, videoPath, videoUrl: options["video-url"], captionsPath,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(error instanceof BufferDraftError ? error.message : "Buffer draft: local input or receipt error. See docs/buffer-tiktok-drafts.md.");
    process.exitCode = 1;
  });
}
