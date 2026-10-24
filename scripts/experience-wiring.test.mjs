// 実体験の語り (owner 2026-10-24): validateDailyContent runs the experience guard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CURRICULUM, fallbackLessonContent, validateDailyContent } from "./content-format.mjs";

test("lesson: an unbacked 「淹れてみたら」 is stopped; the plain explanation passes", () => {
  const ok = fallbackLessonContent(CURRICULUM.episodes[1], "2026-10-25");
  assert.deepEqual(validateDailyContent(ok).errors, []);
  const told = structuredClone(ok);
  told.lesson.why = "うちで淹れてみたら苦みが減りました";
  assert.match(validateDailyContent(told).errors.join("\n"), /"てみた" tells it as our own experience, with no record/);
  const plain = structuredClone(ok);
  plain.lesson.why = "量のブレが、そのまま味のブレになるため";
  assert.deepEqual(validateDailyContent(plain).errors, []);
});
