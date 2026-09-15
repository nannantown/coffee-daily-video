import { test } from "node:test";
import assert from "node:assert/strict";
import { YT_TITLE_MAX, youtubeSafe, youtubeTitle } from "./youtube-limits.mjs";

const len = (s) => Array.from(s).length;

test("a long topic is shortened so the title fits 100 characters and keeps the date tail", () => {
  // 2026-09-15: a legacy title of this shape was 106 characters and the upload failed.
  const topic =
    "<速報>商社オラムがブラジル産アラビカ15-20万袋をICE認証在庫へ・9/11ロイター報、26年低水準を倍増候補で9/14の12月限は3.3%下落、市場関係者の見方";
  assert.ok(len(topic) > 72);
  const title = youtubeTitle("【コーヒー豆知識】", topic, "｜2026/09/15 #Shorts");
  assert.equal(len(title), YT_TITLE_MAX);
  assert.ok(title.startsWith("【コーヒー豆知識】＜速報＞商社オラム"));
  assert.ok(title.endsWith("…｜2026/09/15 #Shorts"));
  assert.ok(!/[<>]/.test(title));
});

test("short titles are unchanged and < > are replaced", () => {
  assert.equal(
    youtubeTitle("【コーヒー豆知識】", "水出しコーヒーの科学", "｜2026/09/15 #Shorts"),
    "【コーヒー豆知識】水出しコーヒーの科学｜2026/09/15 #Shorts"
  );
  assert.equal(youtubeSafe("a<b>c"), "a＜b＞c");
});
