import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runRecovery, recoveryInput } from "./recover-instagram.mjs";
import { TARGET, RECOVERY_WORKFLOWS, sha256 } from "./instagram-publish-state.mjs";
import { DATE, NOW, MEDIA, CONTAINER, KNOWN, payload, harness, empty } from "./instagram-test-fixtures.mjs";

function recovery(h, options = {}) {
  const env = { ...h.env, GITHUB_WORKFLOW: RECOVERY_WORKFLOWS.manual, GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_RUN_ID: "39185391719", INSTAGRAM_RECOVERY_ACTION: "retry", RELEASE_TAG: "v20261020", ASSET_NAME: "coffee-20261020.mp4",
    CONFIRM_VIDEO_SHA256: payload.videoSha256, CONFIRM_CAPTIONS_SHA256: payload.captionSha256, ...options.env };
  return { env, async run(extra = {}) {
    const prepared = await runRecovery({ env, now: NOW, fetchImpl: h.fetchImpl, prepare: true }); h.safe(prepared);
    if (extra.prepare) return prepared;
    if (prepared.status !== "inspected") return prepared;
    return runRecovery({ env: { ...env, INSTAGRAM_RECOVERY_PLAN: JSON.stringify(prepared.plan) }, now: NOW, fetchImpl: h.fetchImpl, ...extra });
  } };
}
const fingerprint = sha256(JSON.stringify({ video: payload.videoSha256, captions: payload.captionSha256 }));
const entry = (state) => ({ state, fingerprint, runId: "39185391718", ...(state === "publishing" ? { containerId: CONTAINER } : {}) });
const receipt = (state) => ({ ...empty(), entries: { [DATE]: entry(state) } });

test("inspect returns exact source plan with GitHub GETs only and never reads Instagram credentials", async () => {
  const h = harness(); const r = recovery(h, { env: { INSTAGRAM_RECOVERY_ACTION: "inspect" } });
  Object.defineProperty(r.env, "INSTAGRAM_ACCESS_TOKEN", { get() { assert.fail("no Meta credential access on inspection"); } });
  const result = await runRecovery({ env: r.env, now: NOW, fetchImpl: h.fetchImpl }); h.safe(result);
  assert.equal(result.status, "inspected"); assert.equal(result.state, "absent");
  assert.equal(result.plan.video.id, "400000001"); assert.equal(result.plan.captions.sha256, payload.captionSha256);
  assert.ok(h.calls.every((c) => c.host === "api.github.com" && c.method === "GET"));
});

test("manual retry pins the source, publishes Instagram once, and repeated recovery skips", async () => {
  const h = harness(); const r = recovery(h);
  const result = await r.run(); h.safe(result); assert.equal(result.status, "published");
  assert.equal((await r.run()).status, "already_published"); assert.equal(h.metaCount("/media_publish"), 1);
  assert.ok(!h.calls.some((c) => c.host.includes("youtube")));
});

test("known Oct19 publication skips without Meta, downloads or a new receipt", async () => {
  const state = JSON.parse(readFileSync(new URL("../data/instagram-post-receipts.json", import.meta.url)));
  const h = harness({ state }); const r = recovery(h, { env: { RELEASE_TAG: "v20261019", ASSET_NAME: "coffee-20261019.mp4" } });
  const result = await r.run(); h.safe(result); assert.equal(result.mediaId, KNOWN); assert.equal(result.status, "already_published");
  assert.equal(h.calls.filter((c) => c.method !== "GET" || c.host !== "api.github.com").length, 0);
});

test("known history success overrides a stale started/publishing claim and forbids ownership transfer", async () => {
  for (const state of ["started", "publishing"]) {
    const h = harness({ state: receipt(state), history: { videos: [{ date: DATE, instagram: { mediaId: MEDIA } }] } });
    const result = await recovery(h, { env: { INSTAGRAM_RECOVERY_ACTION: "resume_before_publish" } }).run();
    assert.equal(result.status, "already_published"); assert.equal(result.mediaId, MEDIA); assert.equal(h.metaCount("/media"), 0);
    await assert.rejects(h.store.claimRecovery(DATE, fingerprint, "39185391719", { resume: true }), { message: "prior_attempt_unresolved" });
  }
});

for (const field of ["CONFIRM_VIDEO_SHA256", "CONFIRM_CAPTIONS_SHA256"]) {
  test(`manual mutation requires matching ${field}`, async () => {
    for (const value of ["", "b".repeat(64)]) {
      const h = harness(); const r = recovery(h, { env: { [field]: value } });
      const result = await r.run(); h.safe(result); assert.ok(["confirmation_required", "source_changed"].includes(result.reason));
      assert.equal(h.metaCount("/media"), 0); assert.equal(h.writes.length, 0);
    }
  });
}

test("manual input rejects shell text, mismatched dates, future dates and caption regeneration", () => {
  const h = harness();
  for (const change of [{ RELEASE_TAG: "v20261020; injected" }, { ASSET_NAME: "../coffee-20261020.mp4" },
    { RELEASE_TAG: "v20260230", ASSET_NAME: "coffee-20260230.mp4" }, { RELEASE_TAG: "v20261021", ASSET_NAME: "coffee-20261021.mp4" },
    { REGENERATE_CAPTIONS: "true" }, { INSTAGRAM_RECOVERY_ACTION: "force" }]) {
    assert.throws(() => recoveryInput({ ...recovery(h).env, ...change }, NOW));
  }
});

test("legacy null history requires human unpublished confirmation; push cannot supply it", async () => {
  const options = { history: { videos: [{ date: DATE, instagram: null }] } };
  const h = harness(options); const first = await recovery(h).run(); h.safe(first);
  assert.equal(first.reason, "confirmation_required"); assert.equal(h.metaCount("/media_publish"), 0);
  assert.equal((await recovery(h, { env: { CONFIRMED_UNPUBLISHED: "true" } }).run()).status, "published");
  const auto = harness(options);
  const blocked = await recovery(auto, { env: { GITHUB_WORKFLOW: RECOVERY_WORKFLOWS.push, GITHUB_EVENT_NAME: "push", CONFIRMED_UNPUBLISHED: "true" } }).run();
  assert.equal(blocked.reason, "confirmation_required"); assert.equal(auto.metaCount("/media"), 0);
});

test("a past date cannot publish without explicit unpublished confirmation", async () => {
  const h = harness(); const r = recovery(h);
  const prepared = await r.run({ prepare: true });
  const result = await runRecovery({ env: { ...r.env, INSTAGRAM_RECOVERY_PLAN: JSON.stringify(prepared.plan) }, now: new Date("2026-10-21T01:00:00Z"), fetchImpl: h.fetchImpl });
  assert.equal(result.reason, "historical_date_requires_review"); assert.equal(h.metaCount("/media"), 0);
});

test("a confirmed historical retry records the actual publication day for later GET-only reconciliation", async () => {
  const options = { metaFault: "publish", ownedMedia: [{ id: MEDIA, timestamp: "2026-10-21T01:03:00Z", caption: payload.caption, media_product_type: "REELS" }] };
  const h = harness(options); const later = new Date("2026-10-21T01:05:00Z");
  const r = recovery(h, { env: { CONFIRMED_UNPUBLISHED: "true" } });
  assert.equal((await r.run({ now: later })).reason, "publish_outcome_unknown");
  assert.equal(h.state().entries[DATE].publicationDate, "2026-10-21");
  delete options.metaFault;
  const result = await recovery(h, { env: { INSTAGRAM_RECOVERY_ACTION: "reconcile_published", PUBLISHED_MEDIA_ID: MEDIA } }).run({ now: later });
  assert.equal(result.status, "reconciled"); assert.equal(h.metaCount("/media_publish"), 1);
});

test("pre-publish resume transfers ownership and fences the original owner before media_publish", async () => {
  const h = harness({ state: receipt("started") });
  const old = { date: DATE, fingerprint, runId: "39185391718" };
  const newer = await h.store.claimRecovery(DATE, fingerprint, "39185391719", { resume: true });
  await assert.rejects(h.store.markPublishing(old, CONTAINER), { message: "prior_attempt_unresolved" });
  await h.store.markPublishing(newer, CONTAINER);
  assert.equal(h.state().entries[DATE].runId, "39185391719");
  await assert.rejects(h.store.claimRecovery(DATE, fingerprint, "39185391720", { resume: true }), { message: "publication_requires_reconciliation" });
});

test("explicit manual resume and today's push retry resume only matching started claims", async () => {
  for (const automatic of [false, true]) {
    const h = harness({ state: receipt("started") });
    const r = recovery(h, { env: automatic ? { GITHUB_WORKFLOW: RECOVERY_WORKFLOWS.push, GITHUB_EVENT_NAME: "push" } : { INSTAGRAM_RECOVERY_ACTION: "resume_before_publish" } });
    const result = await r.run(); h.safe(result); assert.equal(result.status, "published"); assert.equal(h.metaCount("/media_publish"), 1);
  }
});

test("resume refuses changed fingerprints and ordinary manual retry refuses a started record", async () => {
  const state = receipt("started"); state.entries[DATE].fingerprint = "b".repeat(64);
  const h = harness({ state });
  assert.equal((await recovery(h, { env: { INSTAGRAM_RECOVERY_ACTION: "resume_before_publish" } }).run()).reason, "source_changed");
  assert.equal(h.metaCount("/media"), 0);
  const unchanged = harness({ state: receipt("started") });
  assert.equal((await recovery(unchanged).run()).reason, "resume_requires_started");
  assert.equal(unchanged.metaCount("/media"), 0);
});

test("concurrent pre-publish resumers create at most one public Reel", async () => {
  const h = harness({ state: receipt("started") });
  const one = recovery(h, { env: { INSTAGRAM_RECOVERY_ACTION: "resume_before_publish" } });
  const two = recovery(h, { env: { INSTAGRAM_RECOVERY_ACTION: "resume_before_publish", GITHUB_RUN_ID: "39185391720" } });
  const results = await Promise.all([one.run(), two.run()]); results.forEach(h.safe);
  assert.equal(results.filter((r) => r.status === "published").length, 1); assert.equal(h.metaCount("/media_publish"), 1);
});

for (const action of ["retry", "resume_before_publish"]) {
  test(`${action} never clears a publishing record, even with confirmed_unpublished=true`, async () => {
    const h = harness({ state: receipt("publishing") });
    const result = await recovery(h, { env: { INSTAGRAM_RECOVERY_ACTION: action, CONFIRMED_UNPUBLISHED: "true" } }).run(); h.safe(result);
    assert.equal(result.reason, "publication_requires_reconciliation"); assert.equal(h.metaCount("/media"), 0); assert.equal(h.writes.length, 0);
  });
}

test("unknown publishing result is reconciled by verified owned media ID with zero Meta POSTs", async () => {
  const h = harness({ state: receipt("publishing") });
  const result = await recovery(h, { env: { INSTAGRAM_RECOVERY_ACTION: "reconcile_published", PUBLISHED_MEDIA_ID: MEDIA } }).run(); h.safe(result);
  assert.equal(result.status, "reconciled"); assert.equal(h.state().entries[DATE].mediaId, MEDIA);
  assert.equal(h.calls.filter((c) => c.host !== "api.github.com" && c.method !== "GET").length, 0);
  assert.equal((await recovery(h).run()).status, "already_published");
});

for (const media of [[], [{ id: MEDIA, timestamp: "2026-10-19T01:00:00Z", caption: payload.caption, media_product_type: "REELS" }],
  [{ id: MEDIA, timestamp: `${DATE}T01:00:00Z`, caption: "different", media_product_type: "REELS" }]]) {
  test("unverified reconciliation cannot mark success or trigger a new post", async () => {
    const h = harness({ state: receipt("publishing"), ownedMedia: media });
    const result = await recovery(h, { env: { INSTAGRAM_RECOVERY_ACTION: "reconcile_published", PUBLISHED_MEDIA_ID: MEDIA } }).run(); h.safe(result);
    assert.equal(result.reason, "media_not_verified"); assert.equal(h.state().entries[DATE].state, "publishing");
    assert.equal(h.metaCount("/media_publish"), 0); assert.equal(h.writes.length, 0);
  });
}

for (const phase of ["started", "publishing", "published"]) {
  for (const kind of ["before", "after", "conflict", "malformed_ack"]) {
    test(`recovery receipt ${phase}/${kind} fails closed without repeating publish`, async () => {
      const h = harness({ putFault: { phase, kind } }); const r = recovery(h);
      const result = await r.run(); h.safe(result); assert.equal(h.faultTriggered(), true);
      assert.notEqual(result.status, "published"); assert.equal(h.metaCount("/media_publish"), phase === "published" ? 1 : 0);
      if (h.state().entries[DATE]?.state === "publishing") {
        await r.run(); assert.equal(h.metaCount("/media_publish"), phase === "published" ? 1 : 0);
      }
    });
  }
}

for (const metaFault of ["create", "upload", "processing", "publish", "publish_json"]) {
  test(`recovery ${metaFault} failure cannot automatically repeat an uncertain publish`, async () => {
    const h = harness({ metaFault }); const r = recovery(h); const result = await r.run(); h.safe(result);
    assert.equal(result.status, "needs_review"); const count = h.metaCount("/media_publish");
    await r.run(); assert.equal(h.metaCount("/media_publish"), count);
  });
}

test("source changes between prepare and recovery stop before Instagram credentials or download", async () => {
  const options = {}; const h = harness(options); const r = recovery(h);
  const prepared = await r.run({ prepare: true });
  const plan = structuredClone(prepared.plan); plan.video.id = "499999999";
  const result = await runRecovery({ env: { ...r.env, INSTAGRAM_RECOVERY_PLAN: JSON.stringify(plan) }, now: NOW, fetchImpl: h.fetchImpl });
  assert.equal(result.reason, "source_changed"); assert.equal(h.metaCount("/media"), 0);
});

for (const assetFault of ["digest", "network"]) {
  test(`asset ${assetFault} failure never reaches Meta`, async () => {
    const h = harness({ assetFault }); const result = await recovery(h).run(); h.safe(result);
    assert.ok(["source_changed", "source_unverified"].includes(result.reason)); assert.equal(h.metaCount("/media"), 0);
  });
}

test("GitHub asset redirect strips credentials and rejects untrusted hosts", async () => {
  const h = harness({ assetRedirect: "https://release-assets.githubusercontent.com/mock?signature=mock-only" });
  assert.equal((await recovery(h).run()).status, "published");
  const bad = harness({ assetRedirect: "https://untrusted.invalid/mock" });
  assert.equal((await recovery(bad).run()).reason, "source_unverified"); assert.equal(bad.metaCount("/media"), 0);
});

for (const kind of ["before", "after", "conflict", "malformed_ack"]) {
  test(`resumed ownership ${kind} failure never reaches Meta publication`, async () => {
    const h = harness({ state: receipt("started"), putFault: { phase: "started", kind } });
    const result = await recovery(h, { env: { INSTAGRAM_RECOVERY_ACTION: "resume_before_publish" } }).run(); h.safe(result);
    assert.equal(h.faultTriggered(), true); assert.notEqual(result.status, "published"); assert.equal(h.metaCount("/media"), 0);
  });
  test(`reconciliation write ${kind} failure remains GET-only and cannot duplicate a Reel`, async () => {
    const h = harness({ state: receipt("publishing"), putFault: { phase: "published", kind } });
    const r = recovery(h, { env: { INSTAGRAM_RECOVERY_ACTION: "reconcile_published", PUBLISHED_MEDIA_ID: MEDIA } });
    const result = await r.run(); h.safe(result); assert.equal(h.faultTriggered(), true);
    assert.notEqual(result.status, "reconciled"); assert.equal(h.metaCount("/media_publish"), 0);
    await r.run(); assert.equal(h.metaCount("/media_publish"), 0);
  });
}

test("source revalidation after downloads detects a Release asset replacement before Meta access", async () => {
  const h = harness(); const r = recovery(h); const prepared = await r.run({ prepare: true });
  let releaseReads = 0;
  const fetchImpl = async (url, init) => {
    if (String(url).includes("/releases/tags/") && ++releaseReads === 2) h.release.assets[0].id = 499999999;
    return h.fetchImpl(url, init);
  };
  const result = await runRecovery({ env: { ...r.env, INSTAGRAM_RECOVERY_PLAN: JSON.stringify(prepared.plan) }, now: NOW, fetchImpl });
  assert.equal(result.reason, "source_changed"); assert.equal(h.metaCount("/media"), 0);
});

for (const caption of ["当店の自家焙煎豆", "湯温92度", "Mock caption"]) {
  test("archived caption policy and date mismatches stop recovery before Meta", async () => {
    const bytes = Buffer.from(JSON.stringify({ instagram: caption, date: { compact: caption === "Mock caption" ? "20261019" : "20261020" } }));
    const h = harness({ captionsBytes: bytes });
    h.release.assets[1].digest = `sha256:${sha256(bytes)}`; h.release.assets[1].size = bytes.length;
    const r = recovery(h, { env: { CONFIRM_CAPTIONS_SHA256: sha256(bytes) } });
    const result = await r.run(); h.safe(result);
    assert.equal(result.reason, "source_unverified"); assert.equal(h.metaCount("/media"), 0);
  });
}
