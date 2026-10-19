import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { CHECK_WORKFLOW, EXPECTED_ACCOUNT, checkAccount, runCheck } from "./check-instagram-connection.mjs";

// Generated in memory; never put the sentinel in a test name, assertion output,
// fixture file, artifact, or failure diagnostic.
const sentinel = `MOCK_SECRET_NEVER_LOG_${randomUUID()}`;
const context = {
  GITHUB_ACTIONS: "true",
  GITHUB_REPOSITORY: "nannantown/coffee-daily-video",
  GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_WORKFLOW: CHECK_WORKFLOW,
};
const expectedSuccess = { status: "success", account: { ...EXPECTED_ACCOUNT } };

function safeResult(actual, expected) {
  assert.ok(!JSON.stringify(actual).includes(sentinel), "result must exclude credential sentinel");
  assert.deepEqual(actual, expected);
}

test("one fixed GET uses a Bearer header, rejects redirects, and requests only identity", async () => {
  let requests = 0;
  const result = await checkAccount({ token: sentinel, fetchImpl: async (url, options) => {
    requests++;
    assert.ok(!String(url).includes(sentinel), "URL must exclude credentials");
    const parsed = new URL(url);
    assert.equal(parsed.origin, "https://graph.facebook.com");
    assert.equal(parsed.pathname, `/v22.0/${EXPECTED_ACCOUNT.id}`);
    assert.deepEqual([...parsed.searchParams], [["fields", "id,username"]]);
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    assert.ok(options.headers.Authorization === `Bearer ${sentinel}`, "credential belongs only in Authorization");
    assert.equal(options.headers.Accept, "application/json");
    assert.equal(Object.hasOwn(options, "body"), false);
    assert.ok(options.signal instanceof AbortSignal);
    return { status: 200, json: async () => ({ ...EXPECTED_ACCOUNT, ignoredSecret: sentinel }) };
  } });
  assert.equal(requests, 1);
  safeResult(result, expectedSuccess);
});

test("missing or malformed credentials never make a request", async () => {
  let requests = 0;
  const fetchImpl = async () => { requests++; throw new Error(sentinel); };
  for (const token of [undefined, null, ""]) {
    safeResult(await checkAccount({ token, fetchImpl }), { status: "failure", reason: "missing_token" });
  }
  for (const token of [` ${sentinel}`, `${sentinel}\n`, `${sentinel}\r`, "x".repeat(8193)]) {
    safeResult(await checkAccount({ token, fetchImpl }), { status: "failure", reason: "invalid_token_format" });
  }
  assert.equal(requests, 0);
});

test("API rejection does not read or log the response body", async () => {
  let bodyReads = 0;
  for (const status of [301, 400, 401, 403, 429, 500]) {
    const result = await checkAccount({ token: sentinel, fetchImpl: async () => ({
      status,
      json: async () => { bodyReads++; throw new Error(sentinel); },
    }) });
    safeResult(result, { status: "failure", reason: "api_rejected" });
  }
  assert.equal(bodyReads, 0);
});

test("unexpected identity, API messages, and malformed payloads cannot enter reports", async () => {
  const examples = [
    [{ ...EXPECTED_ACCOUNT, username: sentinel }, "unexpected_account"],
    [{ ...EXPECTED_ACCOUNT, id: sentinel }, "unexpected_account"],
    [{ ...EXPECTED_ACCOUNT, error: { message: sentinel } }, "api_rejected"],
    [{ ...EXPECTED_ACCOUNT, username: null }, "invalid_response"],
    [{ ...EXPECTED_ACCOUNT, id: 17841464767833513 }, "invalid_response"],
    [sentinel, "invalid_response"], [null, "invalid_response"], [[], "invalid_response"],
  ];
  for (const [data, reason] of examples) {
    safeResult(await checkAccount({ token: sentinel, fetchImpl: async () => ({
      status: 200, json: async () => data,
    }) }), { status: "failure", reason });
  }
});

test("transport, timeout, redirect, and JSON exceptions are discarded", async () => {
  for (const fetchImpl of [
    async () => { throw new Error(`https://invalid.example/?access_token=${sentinel}`); },
    async () => { throw new DOMException(sentinel, "TimeoutError"); },
    async () => { throw new TypeError(`redirect rejected ${sentinel}`); },
    async () => ({ status: 200, json: async () => { throw new SyntaxError(sentinel); } }),
  ]) {
    safeResult(await checkAccount({ token: sentinel, fetchImpl }), { status: "failure", reason: "request_failed" });
  }
});

test("untrusted workflow contexts and runtime debugging never access a credential", async () => {
  for (const change of [
    { GITHUB_ACTIONS: "false" }, { GITHUB_REPOSITORY: "nannantown/github-trending-video" },
    { GITHUB_REF: "refs/heads/feature" }, { GITHUB_EVENT_NAME: "push" },
    { GITHUB_WORKFLOW: "Daily Coffee Video" },
    { NODE_DEBUG: "http" }, { NODE_DEBUG_NATIVE: "all" }, { NODE_OPTIONS: "--trace-warnings" }, { DEBUG: "*" },
  ]) {
    let credentialReads = 0;
    const env = { ...context, ...change };
    Object.defineProperty(env, "INSTAGRAM_ACCESS_TOKEN", { get() { credentialReads++; throw new Error(sentinel); } });
    const result = await runCheck({ env, fetchImpl: async () => { throw new Error(sentinel); } });
    assert.equal(credentialReads, 0);
    safeResult(result, {
      status: "failure",
      reason: Object.keys(change).some((key) => /^(NODE_|DEBUG)/u.test(key))
        ? "runtime_debugging_enabled" : "workflow_context_required",
    });
  }
});

test("guarded entry point accepts only the expected manual workflow context", async () => {
  safeResult(await runCheck({ env: { ...context, INSTAGRAM_ACCESS_TOKEN: sentinel }, fetchImpl: async () => ({
    status: 200, json: async () => ({ ...EXPECTED_ACCOUNT }),
  }) }), expectedSuccess);
  safeResult(await runCheck({ env: context }), { status: "failure", reason: "missing_token" });
  const env = { ...context };
  Object.defineProperty(env, "INSTAGRAM_ACCESS_TOKEN", { get() { throw new Error(sentinel); } });
  safeResult(await runCheck({ env }), { status: "failure", reason: "check_failed" });
});

test("CLI success and failure paths keep stdout/stderr/artifacts free of mock credentials", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "coffee-instagram-check-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const workingDirectory = join(directory, "working");
  mkdirSync(workingDirectory);
  const mockPath = join(directory, "mock-fetch.mjs");
  // This fixture contains no credential value. Its environment is constructed
  // below, without inheriting the developer machine's process.env.
  writeFileSync(mockPath, `
const account = { id: "17841464767833513", username: "open_ground_coffee_roasters" };
globalThis.fetch = async (url, options) => {
  const secret = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (url !== "https://graph.facebook.com/v22.0/17841464767833513?fields=id,username" ||
      options.method !== "GET" || options.redirect !== "error" ||
      options.headers.Authorization !== "Bearer " + secret) throw new Error(secret);
  const mode = process.env.MOCK_CHECK_MODE;
  if (mode === "transport") throw new Error("request failed: " + secret);
  if (mode === "timeout") throw new DOMException(secret, "TimeoutError");
  if (mode === "redirect") throw new TypeError("redirect: " + secret);
  if (mode === "bad_json") return new Response(secret, { status: 200 });
  if (mode === "api_error") return new Response(JSON.stringify({ error: { message: secret } }), { status: 400 });
  if (mode === "api_error_200") return new Response(JSON.stringify({ ...account, error: { message: secret } }), { status: 200 });
  if (mode === "wrong_id") return new Response(JSON.stringify({ ...account, id: secret }), { status: 200 });
  if (mode === "wrong_username") return new Response(JSON.stringify({ ...account, username: secret + "\\n::notice::" + secret }), { status: 200 });
  return new Response(JSON.stringify({ ...account, ignoredSecret: secret }), { status: 200 });
};
`);
  const scriptPath = fileURLToPath(new URL("./check-instagram-connection.mjs", import.meta.url));
  const modes = [
    ["success", null], ["transport", "request_failed"], ["timeout", "request_failed"],
    ["redirect", "request_failed"], ["bad_json", "request_failed"],
    ["api_error", "api_rejected"], ["api_error_200", "api_rejected"],
    ["wrong_id", "unexpected_account"], ["wrong_username", "unexpected_account"],
    ["missing_token", "missing_token", { INSTAGRAM_ACCESS_TOKEN: "" }],
    ["malformed_token", "invalid_token_format", { INSTAGRAM_ACCESS_TOKEN: `${sentinel}\n` }],
    ["wrong_repository", "workflow_context_required", { GITHUB_REPOSITORY: "nannantown/figma-navi-video" }],
    ["wrong_ref", "workflow_context_required", { GITHUB_REF: "refs/heads/feature" }],
    ["debug_configuration", "runtime_debugging_enabled", { DEBUG: "*" }],
  ];
  for (const [mode, reason, overrides = {}] of modes) {
    const child = spawnSync(process.execPath, ["--import", mockPath, scriptPath], {
      cwd: workingDirectory,
      encoding: "utf8",
      timeout: 5000,
      env: { ...context, INSTAGRAM_ACCESS_TOKEN: sentinel, MOCK_CHECK_MODE: mode,
        GITHUB_OUTPUT: join(workingDirectory, "outputs"),
        GITHUB_STEP_SUMMARY: join(workingDirectory, "summary"),
        NODE_OPTIONS: "", NODE_DEBUG: "", NODE_DEBUG_NATIVE: "", DEBUG: "", ...overrides },
    });
    // Boolean assertions intentionally avoid printing captured text on failure.
    assert.ok(!`${child.stdout || ""}${child.stderr || ""}`.includes(sentinel), "CLI streams must exclude credential sentinel");
    assert.ok(child.error === undefined, "CLI must complete within the mock timeout");
    assert.ok(child.stderr === "", "CLI must not write raw diagnostics to stderr");
    assert.ok(child.status === (reason ? 1 : 0), "CLI exit status must reflect the check result");
    const expected = reason ? { status: "failure", reason } : expectedSuccess;
    assert.ok(child.stdout === `${JSON.stringify(expected)}\n`, "CLI output must match the exact allowlist");
    assert.equal(readdirSync(workingDirectory).length, 0, "check must not create any files or artifacts");
  }
});

test("workflow exposes one existing secret only to the guarded GET and cannot publish", () => {
  const workflow = readFileSync(new URL("../.github/workflows/check-instagram-connection.yml", import.meta.url), "utf8");
  assert.deepEqual([...workflow.matchAll(/secrets\.([A-Z_]+)/gu)].map((m) => m[1]), ["INSTAGRAM_ACCESS_TOKEN"]);
  assert.match(workflow, /permissions:\n  contents: read\n/u);
  assert.match(workflow, /persist-credentials: false/u);
  assert.match(workflow, /github\.repository == 'nannantown\/coffee-daily-video'/u);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch'/u);
  assert.match(workflow, /^on:\n  workflow_dispatch:\n/mu);
  assert.doesNotMatch(workflow, /^  (schedule|push|pull_request|workflow_call|workflow_run):/mu);
  assert.doesNotMatch(workflow, /upload-artifact|contents: write|gh secret|pipeline\.mjs|post-sns\.mjs|refresh-instagram-token|tee |continue-on-error/u);
  assert.match(workflow, /actions\/checkout@[a-f0-9]{40}/u);
  assert.match(workflow, /actions\/setup-node@[a-f0-9]{40}/u);
});
