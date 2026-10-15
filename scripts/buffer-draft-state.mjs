import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export class BufferDraftError extends Error {
  constructor(code) {
    super(`Buffer draft: ${code}. See docs/buffer-tiktok-drafts.md.`);
    this.code = code;
  }
}
const fail = (code) => { throw new BufferDraftError(code); };
export const RECEIPT_REPOSITORY = "nannantown/coffee-daily-video";
export const RECEIPT_PATH = "data/buffer-draft-receipts.json";
const URL = `https://api.github.com/repos/${RECEIPT_REPOSITORY}/contents/${RECEIPT_PATH}`;
const blobSha = (bytes) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");

function validateState(state) {
  if (state?.version !== 1 || !state.entries || typeof state.entries !== "object" || Array.isArray(state.entries)) fail("invalid_receipt_file");
  for (const [key, entry] of Object.entries(state.entries)) {
    if (!/^.+:\d{8}$/.test(key) || !entry || typeof entry !== "object" || Array.isArray(entry) ||
        !/^[a-f0-9]{64}$/.test(entry.fingerprint) || !["creating", "unknown", "rejected", "draft"].includes(entry.state) ||
        (entry.videoSha256 !== undefined && !/^[a-f0-9]{64}$/.test(entry.videoSha256)) ||
        (entry.postId !== undefined && (typeof entry.postId !== "string" || !entry.postId)) ||
        (entry.state === "draft" && !entry.postId)) fail("invalid_receipt_file");
  }
  return state;
}
function decodeState(text) {
  try { return validateState(JSON.parse(text)); }
  catch { fail("invalid_receipt_file"); }
}

export function createLocalReceiptStore({ statePath, now = () => new Date().toISOString() }) {
  return {
    async withLock(operation) {
      mkdirSync(dirname(statePath), { recursive: true });
      const lock = `${statePath}.lock`;
      let fd;
      try { fd = openSync(lock, "wx", 0o600); } catch { fail("receipt_locked"); }
      try {
        writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: now() }));
        return await operation();
      } finally { closeSync(fd); unlinkSync(lock); }
    },
    async load() {
      return { state: existsSync(statePath) ? decodeState(readFileSync(statePath, "utf8")) : { version: 1, entries: {} }, version: null };
    },
    async save(state) {
      const temp = `${statePath}.${randomUUID()}.tmp`;
      const fd = openSync(temp, "wx", 0o600);
      try { writeFileSync(fd, `${JSON.stringify(validateState(state), null, 2)}\n`); fsyncSync(fd); }
      finally { closeSync(fd); }
      renameSync(temp, statePath);
      const directory = openSync(dirname(statePath), "r");
      try { fsyncSync(directory); } finally { closeSync(directory); }
      return null;
    },
  };
}

/** Remote compare-and-set is mandatory in CI; never fall back to an empty/local store. */
export function createGitHubReceiptStore({ token, repository, fetchImpl = fetch }) {
  if (repository !== RECEIPT_REPOSITORY) fail("unexpected_receipt_repository");
  if (typeof token !== "string" || !token.trim()) fail("receipt_authentication_missing");
  async function request(method, body) {
    let response;
    try {
      response = await fetchImpl(method === "GET" ? `${URL}?ref=main` : URL, {
        method, headers: {
          Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10", "Content-Type": "application/json", "Cache-Control": "no-cache",
          "User-Agent": "coffee-daily-video-buffer-drafts",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(30_000), redirect: "error", cache: "no-store",
      });
    } catch { fail(method === "GET" ? "receipt_store_read_failed" : "receipt_store_write_uncertain"); }
    if (response.status === 409) fail("receipt_store_conflict");
    if (!response.ok) fail(method === "GET" ? "receipt_store_read_failed" : "receipt_store_write_failed");
    try { return await response.json(); }
    catch { fail(method === "GET" ? "receipt_store_read_failed" : "receipt_store_write_uncertain"); }
  }
  return {
    // The conditional PUT provides cross-process exclusion before createPost.
    withLock: (operation) => operation(),
    async load() {
      const file = await request("GET");
      if (file?.type !== "file" || file.path !== RECEIPT_PATH || file.encoding !== "base64" ||
          typeof file.content !== "string" || !/^[a-f0-9]{40}$/.test(file.sha)) fail("invalid_remote_receipt");
      const bytes = Buffer.from(file.content, "base64");
      if (blobSha(bytes) !== file.sha) fail("invalid_remote_receipt");
      return { state: decodeState(bytes.toString("utf8")), version: file.sha };
    },
    async save(state, expectedSha) {
      if (!/^[a-f0-9]{40}$/.test(expectedSha)) fail("receipt_version_missing");
      const bytes = Buffer.from(`${JSON.stringify(validateState(state), null, 2)}\n`);
      if (bytes.length > 900_000) fail("receipt_store_size_limit");
      const result = await request("PUT", {
        message: "Record Buffer draft state [skip ci]", branch: "main", sha: expectedSha, content: bytes.toString("base64"),
      });
      if (result?.content?.sha !== blobSha(bytes) || !/^[a-f0-9]{40}$/.test(result?.commit?.sha)) fail("receipt_store_write_uncertain");
      return result.content.sha;
    },
  };
}
