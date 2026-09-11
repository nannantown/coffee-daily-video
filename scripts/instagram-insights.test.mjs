import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toJstDate,
  missingScopes,
  parseInsights,
  matchReelsToVideos,
  needsRefresh,
  updateInstagramStats,
  GraphError,
} from "./instagram-insights.mjs";

test("toJstDate converts IG +0000 timestamps to the JST calendar date", () => {
  assert.equal(toJstDate("2026-06-12T23:30:00+0000"), "2026-06-13");
  assert.equal(toJstDate("2026-06-13T14:59:59+0000"), "2026-06-13");
  assert.equal(toJstDate("2026-06-13T15:00:00+0000"), "2026-06-14");
});

test("missingScopes lists required scopes that are not granted", () => {
  const payload = {
    data: [
      { permission: "instagram_basic", status: "granted" },
      { permission: "instagram_manage_insights", status: "declined" },
      { permission: "pages_read_engagement", status: "granted" },
    ],
  };
  assert.deepEqual(missingScopes(payload), ["instagram_manage_insights"]);
});

test("parseInsights flattens lifetime values and skips empty metrics", () => {
  const payload = {
    data: [
      { name: "views", period: "lifetime", values: [{ value: 120 }] },
      { name: "reach", values: [{ value: 80 }] },
      { name: "shares", total_value: { value: 3 } },
      { name: "saved", values: [] },
    ],
  };
  assert.deepEqual(parseInsights(payload), { views: 120, reach: 80, shares: 3 });
});

test("matchReelsToVideos prefers stored mediaId, then matches by JST date", () => {
  const videos = [
    { date: "2026-06-13", instagram: { mediaId: "stored" } },
    { date: "2026-06-14" },
    { date: "2026-06-15" },
    { date: "2026-06-16" },
  ];
  const reels = [
    { id: "stored", timestamp: "2026-06-12T23:31:00+0000" },
    { id: "a", timestamp: "2026-06-13T23:31:00+0000" },
    { id: "b1", timestamp: "2026-06-15T23:31:00+0000" },
    { id: "b2", timestamp: "2026-06-16T03:00:00+0000" },
  ];
  const { assignments, unmatched } = matchReelsToVideos(videos, reels);
  assert.equal(assignments.get(videos[0]).id, "stored");
  assert.equal(assignments.get(videos[1]).id, "a");
  assert.equal(assignments.has(videos[2]), false);
  assert.equal(assignments.has(videos[3]), false);
  assert.equal(unmatched.length, 2);
  assert.match(unmatched.find((u) => u.date === "2026-06-15").reason, /no REELS/);
  assert.match(unmatched.find((u) => u.date === "2026-06-16").reason, /ambiguous: 2/);
});

test("needsRefresh: recent entries and never-fetched entries only", () => {
  assert.equal(needsRefresh({ date: "2026-09-01", instagram: { updatedAt: "x" } }, "2026-08-28"), true);
  assert.equal(needsRefresh({ date: "2026-07-01", instagram: { updatedAt: "x" } }, "2026-08-28"), false);
  assert.equal(needsRefresh({ date: "2026-07-01", instagram: { updatedAt: null } }, "2026-08-28"), true);
});

test("GraphError classifies permission errors", () => {
  assert.equal(new GraphError({ message: "x", code: 10 }).isPermissionError, true);
  assert.equal(new GraphError({ message: "x", code: 200 }).isPermissionError, true);
  assert.equal(new GraphError({ message: "x", code: 100 }).isPermissionError, false);
});

const ENV = {
  INSTAGRAM_ACCESS_TOKEN: "user-token",
  INSTAGRAM_USER_ID: "ig1",
  FACEBOOK_PAGE_ID: "page1",
};

function fakeFetch(routes, calls = []) {
  return async (url) => {
    calls.push(url);
    const key = url.pathname.replace("/v22.0", "");
    const handler = routes[key];
    const body = typeof handler === "function" ? handler(url) : handler;
    return { json: async () => body ?? { error: { message: `no route ${key}`, code: 100 } } };
  };
}

const PERMS_OK = {
  data: ["instagram_basic", "instagram_manage_insights", "pages_read_engagement"].map(
    (permission) => ({ permission, status: "granted" })
  ),
};

test("updateInstagramStats fills instagram metrics and nulls unmatched entries", async () => {
  const history = {
    videos: [
      { date: "2026-09-09", stats: { views: 5 } },
      { date: "2026-09-10", stats: { views: 7 } },
    ],
  };
  const calls = [];
  const fetchImpl = fakeFetch(
    {
      "/me/permissions": PERMS_OK,
      "/page1": { access_token: "page-token" },
      "/ig1/media": {
        data: [
          { id: "m10", media_product_type: "REELS", timestamp: "2026-09-09T23:30:00+0000", permalink: "p10" },
          { id: "f1", media_product_type: "FEED", timestamp: "2026-09-08T23:30:00+0000" },
        ],
      },
      "/m10/insights": {
        data: ["views", "reach", "likes", "comments", "shares", "saved"].map((name, i) => ({
          name,
          values: [{ value: (i + 1) * 10 }],
        })),
      },
    },
    calls
  );
  const logs = [];
  const now = new Date("2026-09-11T00:00:00Z");
  const result = await updateInstagramStats(history, ENV, { fetchImpl, now, log: (m) => logs.push(m) });

  assert.equal(history.videos[0].instagram, null);
  assert.deepEqual(history.videos[1].instagram, {
    mediaId: "m10",
    permalink: "p10",
    views: 10,
    reach: 20,
    likes: 30,
    comments: 40,
    shares: 50,
    saved: 60,
    updatedAt: now.toISOString(),
  });
  assert.deepEqual(history.videos[1].stats, { views: 7 }, "YouTube stats untouched");
  assert.equal(result.updated, 1);
  assert.equal(result.permissionDenied, false);
  assert.ok(logs.some((l) => l.includes("2026-09-09 unmatched")));
  const insightsCall = calls.find((u) => u.pathname.endsWith("/m10/insights"));
  assert.equal(insightsCall.searchParams.get("metric"), "views,reach,likes,comments,shares,saved");
  assert.ok(!insightsCall.searchParams.get("metric").includes("plays"));
  assert.ok(!logs.join("\n").includes("user-token") && !logs.join("\n").includes("page-token"));
});

test("updateInstagramStats reports permissionDenied when every insights call is refused", async () => {
  const history = { videos: [{ date: "2026-09-10" }] };
  const fetchImpl = fakeFetch({
    "/me/permissions": { data: [{ permission: "instagram_basic", status: "granted" }] },
    "/page1": { access_token: "page-token" },
    "/ig1/media": {
      data: [{ id: "m10", media_product_type: "REELS", timestamp: "2026-09-09T23:30:00+0000" }],
    },
    "/m10/insights": { error: { message: "(#10) Application does not have permission", code: 10 } },
  });
  const result = await updateInstagramStats(history, ENV, {
    fetchImpl,
    now: new Date("2026-09-11T00:00:00Z"),
    log: () => {},
  });
  assert.equal(result.permissionDenied, true);
  assert.deepEqual(result.missingScopes, ["instagram_manage_insights", "pages_read_engagement"]);
  assert.equal(history.videos[0].instagram.mediaId, "m10");
  assert.equal(history.videos[0].instagram.views, null);
});

test("updateInstagramStats falls back to the user token when the page token is refused", async () => {
  const history = { videos: [{ date: "2026-09-10" }] };
  const fetchImpl = fakeFetch({
    "/me/permissions": PERMS_OK,
    "/page1": { access_token: "page-token" },
    "/ig1/media": {
      data: [{ id: "m10", media_product_type: "REELS", timestamp: "2026-09-09T23:30:00+0000" }],
    },
    "/m10/insights": (url) =>
      url.searchParams.get("access_token") === "page-token"
        ? { error: { message: "denied", code: 10 } }
        : { data: [{ name: "views", values: [{ value: 42 }] }] },
  });
  await updateInstagramStats(history, ENV, {
    fetchImpl,
    now: new Date("2026-09-11T00:00:00Z"),
    log: () => {},
  });
  assert.equal(history.videos[0].instagram.views, 42);
  assert.equal(history.videos[0].instagram.reach, null);
});

test("listReels follows paging until the window is covered", async () => {
  const history = { videos: [{ date: "2026-09-01" }, { date: "2026-09-10" }] };
  const calls = [];
  const fetchImpl = fakeFetch(
    {
      "/me/permissions": PERMS_OK,
      "/page1": { access_token: "page-token" },
      "/ig1/media": (url) =>
        url.searchParams.get("after") === "c1"
          ? {
              data: [{ id: "old", media_product_type: "REELS", timestamp: "2026-08-31T23:30:00+0000" }],
            }
          : {
              data: [{ id: "new", media_product_type: "REELS", timestamp: "2026-09-09T23:30:00+0000" }],
              paging: { next: "https://graph.facebook.com/v22.0/ig1/media?after=c1" },
            },
      "/new/insights": { data: [{ name: "views", values: [{ value: 1 }] }] },
      "/old/insights": { data: [{ name: "views", values: [{ value: 2 }] }] },
    },
    calls
  );
  await updateInstagramStats(history, ENV, {
    fetchImpl,
    now: new Date("2026-09-11T00:00:00Z"),
    log: () => {},
  });
  assert.equal(history.videos[0].instagram.mediaId, "old");
  assert.equal(history.videos[1].instagram.mediaId, "new");
});
