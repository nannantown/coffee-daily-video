#!/usr/bin/env node
/**
 * Check the day's review log of the script pipeline (docs/script-pipeline.md)
 * before the routine commits: data/reviews/<air date>.json.
 *
 *   node scripts/check-review.mjs [--date=YYYY-MM-DD]   # default: the next air date (scripts/air-date.mjs)
 *
 * "OK: pass …"     — every reader passed, and the content file is exactly the script of the last round.
 * "OK: fallback …" — 10 rounds did not pass; the content is not committed and the evergreen draft airs.
 * "NG: …"          — the log is missing, malformed, or does not match the content (exit 1).
 */

import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { airDate } from "./content-format.mjs";
import { scriptOf } from "./print-script.mjs";

// A 初見の人 / B 編集者 / C 見出しと言葉 / D 事実確認 / E 絵 (owner 2026-10-20: four readers + the art reader)
export const READERS = ["A", "B", "C", "D", "E"];
export const MAX_ROUNDS = 10; // owner 2026-10-20: fix up to 10 times, then the evergreen draft airs
const SEVERITIES = ["重い", "軽い"];
const FIX = /^(直した|直さない|持ち越し)[:：]\s*\S/;
const carried = (f) => /^持ち越し[:：]/.test(f.fix ?? "");
/** A heavy finding blocks unless it is carried over to a human (something the routine may not change). */
export const blocking = (f) => f.severity === "重い" && !carried(f);

/**
 * Every problem with a review log. `episode` and `script` are the day's content
 * (its episode id and scriptOf(content, { art: true })); both are only compared on a pass.
 */
export function reviewErrors(log, { date, episode, script }) {
  if (!log || typeof log !== "object" || Array.isArray(log)) return ["review log is not an object"];
  const e = [];
  if (log.date !== date) e.push(`date "${log.date}" is not ${date}`);
  if (typeof log.episode !== "string" || !log.episode) e.push("episode is empty");
  if (!["agents", "self"].includes(log.readers)) e.push('readers must be "agents" (sub-agents read) or "self" (no Agent tool: read in turn)');
  if (!Array.isArray(log.facts) || log.facts.length === 0) e.push("facts: the fact memo (claim + https source) is empty");
  else
    log.facts.forEach((f, i) => {
      if (typeof f?.claim !== "string" || !f.claim) e.push(`facts[${i}].claim is empty`);
      if (!/^https:\/\/\S+$/.test(f?.source ?? "")) e.push(`facts[${i}].source is not an https URL`);
    });
  const rounds = Array.isArray(log.rounds) ? log.rounds : [];
  if (rounds.length === 0) e.push("rounds: no round was read");
  if (rounds.length > MAX_ROUNDS) e.push(`rounds: ${rounds.length} rounds, at most ${MAX_ROUNDS}`);
  rounds.forEach((r, i) => {
    const at = `rounds[${i}]`;
    const last = i === rounds.length - 1;
    if (typeof r?.script !== "string" || !r.script.trim()) e.push(`${at}.script: the script the readers got is empty`);
    for (const who of READERS) {
      const list = r?.reviews?.[who];
      if (!Array.isArray(list)) {
        e.push(`${at}.reviews.${who}: reader ${who} did not report (an empty list means no findings)`);
        continue;
      }
      list.forEach((f, j) => {
        const where = `${at}.reviews.${who}[${j}]`;
        if (!SEVERITIES.includes(f?.severity)) e.push(`${where}.severity must be 重い or 軽い`);
        if (typeof f?.where !== "string" || !f.where) e.push(`${where}.where is empty`);
        if (typeof f?.point !== "string" || !f.point) e.push(`${where}.point is empty`);
        const giveUp = last && log.result === "fallback";
        if (!giveUp && !FIX.test(f?.fix ?? "")) e.push(`${where}.fix must start with 直した： / 直さない： / 持ち越し： and say what or why`);
        // nothing reads the script after the last round, so a fix there is never checked
        if (last && log.result === "pass" && /^直した/.test(f?.fix ?? "")) e.push(`${where}: fixed after the last round — read it again (one more round)`);
      });
    }
  });
  const final = rounds.at(-1);
  const blocked = final ? READERS.flatMap((w) => (Array.isArray(final.reviews?.[w]) ? final.reviews[w] : [])).filter(blocking) : [];
  if (log.result === "pass") {
    if (blocked.length) e.push(`result pass but the last round has ${blocked.length} heavy finding(s) not carried over`);
    if (log.episode !== episode) e.push(`episode "${log.episode}" is not the content's "${episode}"`);
    if (final && final.script !== script) e.push("the content is not the script of the last round (changed after the review) — read it again");
  } else if (log.result === "fallback") {
    if (rounds.length !== MAX_ROUNDS) e.push(`result fallback after ${rounds.length} rounds — keep fixing up to ${MAX_ROUNDS}`);
    if (final && !blocked.length) e.push("result fallback but the last round passed — commit it as a pass");
  } else e.push('result must be "pass" or "fallback"');
  return e;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
  const date = process.argv.find((a) => a.startsWith("--date="))?.slice(7) || airDate();
  const logPath = join(rootDir, "data", "reviews", `${date}.json`);
  if (!existsSync(logPath)) {
    console.error(`NG: no review log ${logPath} — run docs/script-pipeline.md first`);
    process.exit(1);
  }
  let log;
  let content = null;
  try {
    log = JSON.parse(readFileSync(logPath, "utf-8"));
    const contentPath = join(rootDir, "data", "enriched-coffee-news.json");
    if (log?.result === "pass") content = JSON.parse(readFileSync(contentPath, "utf-8"));
  } catch (err) {
    console.error(`NG: cannot read: ${err.message}`);
    process.exit(1);
  }
  const errors = reviewErrors(log, { date, episode: content?.lesson?.episode, script: content ? scriptOf(content, { art: true }) : undefined });
  if (errors.length) {
    console.error(`NG: ${errors.length} problem(s) in ${logPath}`);
    for (const x of errors) console.error(`  - ${x}`);
    process.exit(1);
  }
  const findings = log.rounds.map((r) => READERS.map((w) => r.reviews[w].length).reduce((a, b) => a + b, 0));
  console.log(`OK: ${log.result} ${date} ${log.episode} — ${log.rounds.length} round(s), findings per round ${findings.join(" → ")}, readers: ${log.readers}`);
}
