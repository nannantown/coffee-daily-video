import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewErrors, READERS, MAX_ROUNDS, DEADLINE } from "./check-review.mjs";
import { scriptOf } from "./print-script.mjs";
import { airDate, episodeById, fallbackLessonContent } from "./content-format.mjs";

const DATE = "2026-10-22";
const content = fallbackLessonContent(episodeById("i12-soft-water"), DATE);
const script = scriptOf(content, { art: true });
const ctx = { date: DATE, episode: content.lesson.episode, script };
const none = () => Object.fromEntries(READERS.map((w) => [w, []]));
const heavy = (fix) => ({ severity: "重い", where: "場面 3", point: "炭酸水素塩が説明なしで出る", ...(fix ? { fix } : {}) });
const log = (rounds, result = "pass") => ({
  date: DATE,
  episode: content.lesson.episode,
  readers: "agents",
  result,
  facts: [{ claim: "WHO の硬度区分", source: "https://www.fsc.go.jp/" }],
  rounds,
});

test("a log that fixed a heavy finding and then passed every reader is OK", () => {
  const first = { script: "前の台本", reviews: { ...none(), A: [heavy("直した： 重曹の仲間の成分 と言い換えた")] } };
  assert.deepEqual(reviewErrors(log([first, { script, reviews: none() }]), ctx), []);
});

test("a pass needs the committed content to be the last round's script, every reader, and no open heavy finding", () => {
  assert.match(reviewErrors(log([{ script: "直す前", reviews: none() }]), ctx).join(), /not the script of the last round/);
  const { E, ...four } = none();
  assert.match(reviewErrors(log([{ script, reviews: four }]), ctx).join(), /reader E did not report/);
  assert.match(reviewErrors(log([{ script, reviews: { ...none(), B: [heavy("直さない： 気にならない")] } }]), ctx).join(), /heavy finding/);
  // fixing after the last round means nobody read the fix
  assert.match(reviewErrors(log([{ script, reviews: { ...none(), C: [{ ...heavy("直した： 言い換えた"), severity: "軽い" }] } }]), ctx).join(), /fixed after the last round/);
  // a finding the routine may not change (an approved script, a drawing) is carried over to a human and does not block
  assert.deepEqual(reviewErrors(log([{ script, reviews: { ...none(), E: [heavy("持ち越し： 絵の補充が要る")] } }]), ctx), []);
});

test("every finding says what was done with it, and the fact memo has https sources", () => {
  const first = { script: "前", reviews: { ...none(), A: [heavy()] } };
  assert.match(reviewErrors(log([first, { script, reviews: none() }]), ctx).join(), /fix must start with/);
  assert.match(reviewErrors({ ...log([{ script, reviews: none() }]), facts: [{ claim: "x", source: "fsc.go.jp" }] }, ctx).join(), /https/);
  assert.match(reviewErrors({ ...log([{ script, reviews: none() }]), readers: "me" }, ctx).join(), /readers/);
  assert.match(reviewErrors({ ...log([{ script, reviews: none() }]), date: "2026-10-21" }, ctx).join(), /is not 2026-10-22/);
});

test("fallback only after 10 rounds that still do not pass (owner 2026-10-20: fix up to 10 times, then the evergreen draft)", () => {
  const stuck = (n) => Array.from({ length: n }, (_, i) => ({ script: `第${i + 1}稿`, reviews: { ...none(), D: [heavy(i === n - 1 ? undefined : "直した： 出典に合わせた")] } }));
  assert.equal(MAX_ROUNDS, 10);
  assert.deepEqual(reviewErrors(log(stuck(10), "fallback"), ctx), []);
  assert.match(reviewErrors(log(stuck(3), "fallback"), ctx).join(), /keep fixing up to 10/);
  assert.match(reviewErrors(log(stuck(11), "fallback"), ctx).join(), /at most 10/);
});

test("stopping before 10 rounds counts only after the 08:10 JST deadline of the air date, with the reason written down", () => {
  const stuck = [{ script: "第1稿", reviews: { ...none(), D: [heavy()] } }];
  const early = { ...log(stuck, "fallback"), reason: "締め切り 08:10 JST を過ぎた" };
  const at = (iso) => ({ ...ctx, now: new Date(iso) });
  assert.equal(DEADLINE, "08:10");
  assert.deepEqual(reviewErrors(early, at("2026-10-21T23:10:00Z")), []); // 08:10 JST on the air date
  // the night before (23:00 routine) and 08:09 on the day are before the deadline: keep fixing
  assert.match(reviewErrors(early, at("2026-10-21T14:30:00Z")).join(), /keep fixing up to 10/);
  assert.match(reviewErrors(early, at("2026-10-21T23:09:00Z")).join(), /keep fixing up to 10/);
  // past the deadline the reason is still needed
  assert.match(reviewErrors(log(stuck, "fallback"), at("2026-10-22T00:00:00Z")).join(), /keep fixing up to 10/);
  // a run cut short by the deadline need not have its fact memo; before the deadline it must
  const noFacts = { ...early, facts: [] };
  assert.deepEqual(reviewErrors(noFacts, at("2026-10-21T23:30:00Z")), []);
  assert.match(reviewErrors(noFacts, at("2026-10-21T14:30:00Z")).join(), /fact memo/);
});

test("the air date is today before noon JST and tomorrow from noon (script routine at 23:00 the night before)", () => {
  assert.equal(airDate(new Date("2026-10-20T22:30:00Z")), "2026-10-21"); // 07:30 JST on the 21st
  assert.equal(airDate(new Date("2026-10-20T14:00:00Z")), "2026-10-21"); // 23:00 JST on the 20th
  assert.equal(airDate(new Date("2026-10-20T02:59:00Z")), "2026-10-20"); // 11:59 JST
  assert.equal(airDate(new Date("2026-10-20T03:00:00Z")), "2026-10-21"); // 12:00 JST
});

test("the script for reader E names what each scene draws; the readers' copy does not", () => {
  const plain = scriptOf(content);
  assert.ok(!plain.includes("絵: "));
  const scenes = script.split("\n\n");
  assert.ok(scenes.every((s) => /\n絵: /.test(s)));
  assert.ok(scenes[1].includes(`"art":"${content.lesson.script.scenes[0].art}"`));
});
