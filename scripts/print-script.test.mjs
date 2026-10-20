import { test } from "node:test";
import assert from "node:assert/strict";
import { scriptOf, screenText } from "./print-script.mjs";
import { buildCardsData, episodeById, fallbackLessonContent } from "./content-format.mjs";

test("the first-viewer script shows every scene's screen text and narration, and nothing that is not drawn", () => {
  const content = fallbackLessonContent(episodeById("i12-soft-water"), "2026-10-21");
  const data = buildCardsData(content, {});
  const script = scriptOf(content);
  const scenes = script.split("\n\n");
  assert.equal(scenes.length, data.slides.length + 1);
  [...data.slides, data.ending].forEach((s, i) => {
    assert.ok(scenes[i].startsWith(`【場面 ${i + 1}】`));
    assert.ok(scenes[i].includes(`読み上げ: ${s.narration}`));
  });
  assert.ok(screenText(data.slides[0]).includes(content.lesson.ask));
  assert.ok(screenText(data.slides[1]).includes(content.lesson.premise.term));
  // the ending carries the topic for the caption but does not draw it
  assert.ok(!screenText(data.ending).includes(data.ending.topic));
  assert.ok(screenText(data.ending).includes(data.ending.next));
});
