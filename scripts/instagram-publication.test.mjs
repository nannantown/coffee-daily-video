import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { TARGET, RECEIPT_PATH, DAILY_WORKFLOW, gitBlobSha, sha256, createGitHubReceiptStore, safeCode } from "./instagram-publish-state.mjs";
import { createInstagramClient, publishOnce, runUpload } from "./upload-instagram.mjs";

import { DATE, NOW, CONTAINER, MEDIA, KNOWN, video, captionBytes, payload, cleanEnv, empty, response, harness } from "./instagram-test-fixtures.mjs";

test("successful publication confirms three durable stages, then a second run skips without reading Instagram credentials", async () => {
  const h = harness();
  const result = await h.run(); h.safe(result);
  assert.deepEqual(result, { status: "published", date: DATE, mediaId: MEDIA });
  assert.equal(h.state().entries[DATE].state, "published");
  Object.defineProperty(h.env, "INSTAGRAM_ACCESS_TOKEN", { get() { assert.fail("Instagram token must not be read on skip"); } });
  assert.equal((await h.run()).status, "already_published");
  assert.equal(h.metaCount("/media"), 1); assert.equal(h.metaCount("/media_publish"), 1);
});

test("Oct19 known success is protected independently of payload and secret availability", async () => {
  const state = JSON.parse(readFileSync(new URL("../data/instagram-post-receipts.json", import.meta.url)));
  const h = harness({ state });
  const result = await h.publish({ date: "2026-10-19", makeClient() { assert.fail("no Meta client"); }, readPayload() { assert.fail("no video read"); } });
  assert.deepEqual(result, { status: "already_published", date: "2026-10-19", mediaId: KNOWN });
  assert.equal(h.calls.filter((c) => c.host !== "api.github.com").length, 0);
});

test("concurrent callers publish at most once via GitHub blob-SHA compare-and-swap", async () => {
  const h = harness();
  const results = await Promise.all([h.publish(), h.publish()]);
  results.forEach(h.safe);
  assert.equal(results.filter((r) => r.status === "published").length, 1);
  assert.equal(h.metaCount("/media"), 1); assert.equal(h.metaCount("/media_publish"), 1);
});

for (const phase of ["started", "publishing", "published"]) {
  for (const kind of ["before", "after", "conflict", "malformed_ack"]) {
    test(`receipt ${phase} ${kind}: ambiguous outcomes never trigger automatic repeat`, async () => {
      const h = harness({ putFault: { phase, kind } });
      const first = await h.publish(); h.safe(first);
      assert.equal(h.faultTriggered(), true, "requested failure injection was reached");
      assert.notEqual(first.status, "published");
      if (phase === "started" && kind !== "conflict") assert.equal(first.status, "needs_review", "reservation outcome may be uncertain");
      const publishedCount = h.metaCount("/media_publish");
      assert.equal(publishedCount, phase === "published" ? 1 : 0);
      // A failed reservation before the server wrote anything can safely try again.
      // Every persisted started/publishing record is terminal pending human review.
      if (h.state().entries[DATE]) {
        h.safe(await h.publish());
        assert.equal(h.metaCount("/media_publish"), publishedCount);
        assert.equal(h.metaCount("/media"), phase === "started" ? 0 : 1);
      }
    });
  }
  test(`receipt ${phase} readback loss fails closed`, async () => {
    const h = harness({ readbackFail: phase });
    const first = await h.publish(); h.safe(first);
    assert.equal(h.faultTriggered(), true, "requested readback loss was reached");
    assert.notEqual(first.status, "published");
    const count = h.metaCount("/media_publish");
    h.safe(await h.publish());
    assert.equal(h.metaCount("/media_publish"), count);
    assert.equal(count, phase === "published" ? 1 : 0);
  });
}

for (const fault of ["create", "upload", "processing", "publish", "publish_json"]) {
  test(`Meta ${fault} failure leaves an irreversible automatic-retry barrier`, async () => {
    const h = harness({ metaFault: fault });
    const first = await h.publish(); h.safe(first);
    assert.equal(first.status, "needs_review");
    assert.equal(h.state().entries[DATE].state, fault.startsWith("publish") ? "publishing" : "started");
    if (fault.startsWith("publish")) assert.equal(first.reason, "publish_outcome_unknown");
    const calls = h.calls.length;
    const second = await h.publish(); h.safe(second);
    assert.equal(second.reason, "prior_attempt_unresolved");
    assert.equal(h.calls.length, calls + 2, "retry only reads receipt/history; it cannot contact Meta");
  });
}

test("local result write fails after successful publication: receipt still prevents repeat", async () => {
  const h = harness();
  const first = await h.run({ writeFile() { throw new Error(h.secret); } }); h.safe(first);
  assert.equal(first.reason, "local_result_write_failed");
  assert.equal(h.state().entries[DATE].state, "published");
  assert.equal((await h.run()).status, "already_published");
  assert.equal(h.metaCount("/media_publish"), 1);
});

for (const badReceipt of ["missing", "corrupt", "schema"]) {
  test(`${badReceipt} receipt blocks all Meta requests`, async () => {
    const h = harness({ badReceipt, ...(badReceipt === "schema" ? { state: { ...empty(), extra: "unknown" } } : {}) });
    h.safe(await h.publish());
    assert.equal(h.calls.filter((c) => c.host !== "api.github.com").length, 0);
  });
}

for (const instagram of [null, { mediaId: KNOWN }]) {
  test(`existing same-day history ${instagram ? "success skips" : "uncertain blocks"}`, async () => {
    const h = harness({ history: { videos: [{ date: DATE, instagram }] } });
    const result = await h.publish(); h.safe(result);
    assert.equal(result.status, instagram ? "already_published" : "blocked");
    assert.equal(h.metaCount("/media"), 0);
  });
}

test("unmanaged historical dates require review regardless of empty history", async () => {
  const h = harness(); const result = await h.publish({ date: "2026-10-18" });
  assert.equal(result.reason, "historical_date_requires_review"); assert.equal(h.metaCount("/media"), 0);
});

for (const [key, value] of Object.entries({ GITHUB_REPOSITORY: "nannantown/figma-navi-video", GITHUB_REF: "refs/heads/topic",
  GITHUB_WORKFLOW: "other", GITHUB_EVENT_NAME: "pull_request", GITHUB_RUN_ATTEMPT: "2", NODE_OPTIONS: "--inspect", NODE_DEBUG: "http",
  DEBUG: "*", DRY_RUN: "true", SNS_POST_ENABLED: "false", INSTAGRAM_RECEIPT_WRITE_ENABLED: "false" })) {
  test(`context ${key} blocks before credential access or file reads`, async () => {
    const h = harness(); const env = { ...h.env, [key]: value };
    Object.defineProperty(env, "INSTAGRAM_ACCESS_TOKEN", { get() { assert.fail("no IG secret access"); } });
    const result = await h.run({ env, readFile() { assert.fail("no file read"); } }); h.safe(result);
    assert.equal(result.status, "blocked"); assert.equal(h.metaCount("/media"), 0);
  });
}

test("both recovery workflows are read-only even if someone sets write flag and all credentials", async () => {
  for (const name of ["Inspect Instagram Recovery (manual)", "Inspect Today's Instagram Recovery (push-triggered)"]) {
    const h = harness(); const env = { ...h.env, GITHUB_WORKFLOW: name, INSTAGRAM_POST_DATE: DATE };
    Object.defineProperty(env, "INSTAGRAM_ACCESS_TOKEN", { get() { assert.fail("no IG credential access"); } });
    const result = await h.run({ env, argv: ["--inspect"], readFile() { assert.fail("no file access"); } }); h.safe(result);
    assert.equal(result.reason, "receipt_write_approval_required");
    assert.equal(h.calls.filter((c) => c.method !== "GET").length, 0);
  }
});

for (const release of [
  { published_at: `${DATE}T00:59:59Z` }, { tag_name: "v20261019" }, { draft: true }, { assets: [] },
  { assets: [{ name: "coffee-20261020.mp4", digest: "sha256:wrong", size: video.length }] },
]) {
  test(`unverified release ${Object.keys(release)[0]} blocks before Meta or receipt write`, async () => {
    const h = harness({ release }); const result = await h.publish(); h.safe(result);
    assert.equal(result.reason, "source_unverified");
    assert.equal(h.calls.filter((c) => c.host !== "api.github.com" || c.method !== "GET").length, 0);
  });
}

test("invalid or future job boundary cannot authorize an existing release", async () => {
  for (const start of ["1970-01-01T00:00:00Z", `${DATE}T02:00:00Z`, "invalid"]) {
    const h = harness(); h.env.INSTAGRAM_PUBLICATION_STARTED_AT = start;
    assert.equal((await h.publish()).reason, "source_unverified"); assert.equal(h.metaCount("/media"), 0);
  }
});

test("wrong Page/account pairing is detected by GET before any mutation", async () => {
  const h = harness({ wrongAccount: true });
  assert.equal((await h.publish()).reason, "wrong_account");
  assert.equal(h.calls.filter((c) => c.method !== "GET").length, 0);
});

for (const fault of ["target_transport", "target_json", "target_error"]) {
  test(`raw ${fault} errors are suppressed`, async () => {
    const h = harness({ metaFault: fault }); const result = await h.publish(); h.safe(result);
    assert.equal(result.status, "blocked"); assert.equal(h.metaCount("/media"), 0);
  });
}

for (const uri of [
  `https://evil.invalid/ig-api-upload/${CONTAINER}`, `http://rupload.facebook.com/ig-api-upload/${CONTAINER}`,
  `https://rupload.facebook.com/ig-api-upload/${CONTAINER}?access_token=mock`,
  `https://user:pass@rupload.facebook.com/ig-api-upload/${CONTAINER}`,
  `https://rupload.facebook.com/ig-api-upload/${MEDIA}`, `https://rupload.facebook.com/other/${CONTAINER}`,
]) {
  test(`untrusted upload destination ${new URL(uri).hostname} is never fetched`, async () => {
    const h = harness({ uri }); const result = await h.publish(); h.safe(result);
    assert.equal(result.reason, "untrusted_upload_destination");
    assert.equal(h.calls.filter((c) => c.host !== "api.github.com" && c.host !== "graph.facebook.com").length, 0);
    assert.equal(h.metaCount("/media_publish"), 0);
  });
}

test("processing timeout and redirects return fixed errors, with no publish retries", async () => {
  let requests = 0;
  const h = harness();
  const client = createInstagramClient({ userToken: h.tokens.user, delay: async () => {}, fetchImpl: async (url, init) => {
    if (String(url).includes(`/${TARGET.pageId}?`)) return h.fetchImpl(url, init);
    requests++; return response({ status_code: "IN_PROGRESS" });
  } });
  await client.verifyTarget();
  await assert.rejects(client.waitReady({ id: CONTAINER }), { message: "processing_timeout" });
  assert.equal(requests, 60);
  const redirect = createInstagramClient({ userToken: h.tokens.user, fetchImpl: async (_url, init) => {
    assert.equal(init.redirect, "error"); return response({ error: { message: h.secret } }, 302);
  } });
  await assert.rejects(redirect.verifyTarget(), { message: "api_rejected" });
});

test("CLI stdout/stderr and filesystem outputs never contain a raw mock credential or exception", () => {
  const dir = mkdtempSync(join(tmpdir(), "ig-cli-"));
  try {
    const secret = `mock-only-${randomBytes(24).toString("hex")}`;
    const preload = join(dir, "mock-fetch.mjs");
    writeFileSync(preload, `globalThis.fetch = async () => { throw new Error(${JSON.stringify(secret)}); };`);
    const result = spawnSync(process.execPath, ["--import", preload, new URL("./upload-instagram.mjs", import.meta.url).pathname, "--file=/invalid.mp4"],
      { env: { ...cleanEnv(), GITHUB_TOKEN: secret, INSTAGRAM_ACCESS_TOKEN: secret }, encoding: "utf8" });
    assert.equal(result.status, 1); assert.equal(result.stderr, "");
    assert.ok(!result.stdout.includes(secret)); assert.deepEqual(JSON.parse(result.stdout), { status: "blocked", reason: "invalid_input" });
    const second = spawnSync(process.execPath, ["--import", preload, new URL("./upload-instagram.mjs", import.meta.url).pathname, "--inspect"],
      { env: { ...cleanEnv(), GITHUB_WORKFLOW: "Inspect Instagram Recovery (manual)", GITHUB_TOKEN: secret }, encoding: "utf8" });
    assert.equal(second.status, 1); assert.equal(second.stderr, ""); assert.ok(!second.stdout.includes(secret));
    assert.equal(JSON.parse(second.stdout).reason, "receipt_unavailable");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("record-upload preserves known IDs when result is absent, wrong-date or corrupt", () => {
  for (const result of [null, { date: "2026-10-19", mediaId: MEDIA }, "corrupt", { date: DATE, mediaId: "invalid" }, { date: DATE, mediaId: MEDIA }, { date: DATE, mediaId: KNOWN }]) {
    const dir = mkdtempSync(join(tmpdir(), "ig-record-"));
    try {
      for (const path of ["scripts", "data", "output", "src/looks"]) mkdirSync(join(dir, path), { recursive: true });
      for (const path of ["scripts/record-upload.mjs", "scripts/content-format.mjs", "scripts/brand-guard.mjs", "scripts/youtube-limits.mjs",
        "src/looks/safe-layout.mjs", "src/looks/vessels-data.mjs", "data/curriculum.json", "data/coffee-lineup.json"]) {
        writeFileSync(join(dir, path), readFileSync(new URL(`../${path}`, import.meta.url)));
      }
      writeFileSync(join(dir, "clock.mjs"), `const OriginalDate = Date; globalThis.Date = class extends OriginalDate { constructor(...args) { super(...(args.length ? args : [${JSON.stringify(NOW.toISOString())}])); } };`);
      writeFileSync(join(dir, "output/upload-result.json"), JSON.stringify({ videoId: "mock-youtube", videoUrl: "mock" }));
      writeFileSync(join(dir, "data/performance-history.json"), JSON.stringify({ videos: [{ date: DATE, instagram: { mediaId: KNOWN, views: 42 } }] }));
      if (result) writeFileSync(join(dir, "output/instagram-result.json"), result === "corrupt" ? "{" : JSON.stringify(result));
      const run = spawnSync(process.execPath, ["--import", join(dir, "clock.mjs"), join(dir, "scripts/record-upload.mjs")], { env: { TZ: "Asia/Tokyo" }, encoding: "utf8" });
      assert.equal(run.status, 0);
      const record = JSON.parse(readFileSync(join(dir, "data/performance-history.json"))).videos[0];
      assert.equal(record.instagram.mediaId, KNOWN, "known publication cannot be replaced even by a conflicting same-day result");
      assert.equal(record.instagram.views, 42);
      // With no known publication, accept only a valid result for this date.
      writeFileSync(join(dir, "data/performance-history.json"), JSON.stringify({ videos: [] }));
      const freshRun = spawnSync(process.execPath, ["--import", join(dir, "clock.mjs"), join(dir, "scripts/record-upload.mjs")], { env: { TZ: "Asia/Tokyo" }, encoding: "utf8" });
      assert.equal(freshRun.status, 0);
      const fresh = JSON.parse(readFileSync(join(dir, "data/performance-history.json"))).videos[0];
      assert.equal(fresh.instagram?.mediaId ?? null, result?.date === DATE && [MEDIA, KNOWN].includes(result.mediaId) ? result.mediaId : null);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test("receipt writers alone have contents:write; recovery preserves Instagram-only operations", () => {
  for (const path of [".github/workflows/daily-video.yml", ".github/workflows/test-instagram-upload.yml", ".github/workflows/retry-today-instagram.yml"]) {
    const text = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    const permissionBlock = /^permissions:\n((?:[ \t].*\n|\n)+)/mu.exec(text)?.[1].trim();
    assert.equal(permissionBlock, "contents: read");
    assert.equal((text.match(/^      contents: write/gmu) ?? []).length, 1, "one authorized receipt writer job only");
    assert.ok(!/^\s+(?:actions|packages|id-token|deployments): write$/mu.test(text));
    assert.match(text, /^  cancel-in-progress: false$/mu);
    if (!path.endsWith("/daily-video.yml")) {
      assert.match(text, /^  group: coffee-instagram-publication$/mu);
      const prepare = text.split("  prepare:")[1].split("  recover:")[0];
      assert.ok(!prepare.includes("secrets.") && !prepare.includes("contents: write"));
      assert.ok(text.includes("needs.prepare.outputs.write_required == 'true'"));
      assert.ok(text.includes("INSTAGRAM_RECOVERY_PLAN: ${{ needs.prepare.outputs.plan }}"));
      assert.deepEqual([...new Set([...text.matchAll(/secrets\.([A-Z_]+)/gu)].map((m) => m[1]))].sort(),
        ["FACEBOOK_PAGE_ID", "INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_USER_ID"]);
      assert.ok(!text.includes("pipeline.mjs") && !text.includes("youtube") && !text.includes("generate-caption"));
      assert.ok(!/^\s*run:.*\$\{\{.*inputs\./mu.test(text), "no shell interpolation of inputs");
      assert.equal((text.match(/github.ref == 'refs\/heads\/main'/gu) ?? []).length, 2);
      if (path.endsWith("/test-instagram-upload.yml")) {
        assert.ok(text.includes("release_tag:") && text.includes("asset_name:") && text.includes("resume_before_publish") && text.includes("reconcile_published"));
      }
    } else {
      assert.ok(text.includes("INSTAGRAM_RECEIPT_WRITE_ENABLED: ${{ steps.mode.outputs.dry_run != 'true' && 'true' || 'false' }}"));
      assert.match(text, /^          NODE_DEBUG: ""$/mu);
      assert.ok(text.includes("INSTAGRAM_ACCESS_TOKEN: ${{ steps.mode.outputs.dry_run != 'true' && secrets.INSTAGRAM_ACCESS_TOKEN || '' }}"));
    }
  }
  const ci = readFileSync(new URL("../.github/workflows/instagram-safety-tests.yml", import.meta.url), "utf8");
  assert.ok(ci.includes("pull_request:") && ci.includes("contents: read"));
  assert.ok(!ci.includes("secrets.") && !ci.includes("contents: write"));
  assert.ok(ci.includes("scripts/instagram-recovery.test.mjs"));
});

test("unknown exceptions never enter the public status allowlist", () => {
  assert.equal(safeCode(new Error("mock-only-private-data")), "unexpected_failure");
});
