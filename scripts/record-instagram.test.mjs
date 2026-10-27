import { test } from "node:test";
import assert from "node:assert/strict";
import { addInstagram } from "./record-instagram.mjs";

test("addInstagram fills the day's empty instagram block, keeps the rest", () => {
  const h = { videos: [{ date: "2026-10-26", videoId: "y", instagram: null }, { date: "2026-10-25", videoId: "x", instagram: { mediaId: "a" } }] };
  addInstagram(h, "2026-10-26", "m1");
  assert.equal(h.videos[0].instagram.mediaId, "m1");
  assert.equal(h.videos[0].videoId, "y");
  assert.equal(h.videos[1].instagram.mediaId, "a");
});

test("addInstagram: same id is a no-op, another id or a missing day throws", () => {
  const h = { videos: [{ date: "2026-10-26", instagram: { mediaId: "m1", views: 5 } }] };
  addInstagram(h, "2026-10-26", "m1");
  assert.equal(h.videos[0].instagram.views, 5);
  assert.throws(() => addInstagram(h, "2026-10-26", "m2"));
  assert.throws(() => addInstagram(h, "2026-10-27", "m1"));
});
