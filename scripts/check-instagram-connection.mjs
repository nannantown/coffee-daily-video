/**
 * One read-only Instagram account lookup. No posting, token exchange, or files.
 * Credentials are accepted only by the guarded Actions entry point. Never log
 * response data, exceptions, request headers, or URLs supplied by a server.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_ACCOUNT = Object.freeze({
  id: "17841464767833513",
  username: "open_ground_coffee_roasters",
});
export const CHECK_WORKFLOW = "Instagram Connection Check (read-only)";
const REPOSITORY = "nannantown/coffee-daily-video";
const LOOKUP_URL = `https://graph.facebook.com/v22.0/${EXPECTED_ACCOUNT.id}?fields=id,username`;
const REQUEST_TIMEOUT_MS = 15_000;

const failure = (reason) => ({ status: "failure", reason });

export async function checkAccount({ token, fetchImpl = globalThis.fetch } = {}) {
  if (typeof token !== "string" || token.length === 0) {
    return failure("missing_token");
  }
  if (token.length > 8192 || /[\u0000-\u0020\u007f]/u.test(token)) {
    return failure("invalid_token_format");
  }

  try {
    const response = await fetchImpl(LOOKUP_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    // Do not read an unsuccessful response body or its error.message.
    if (response.status !== 200) return failure("api_rejected");
    const data = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return failure("invalid_response");
    }
    if (Object.hasOwn(data, "error")) return failure("api_rejected");
    if (typeof data.id !== "string" || typeof data.username !== "string") {
      return failure("invalid_response");
    }
    if (data.id !== EXPECTED_ACCOUNT.id || data.username !== EXPECTED_ACCOUNT.username) {
      return failure("unexpected_account");
    }
    // Return local allowlisted constants, never values copied from the payload.
    return { status: "success", account: { ...EXPECTED_ACCOUNT } };
  } catch {
    // Transport/JSON errors can contain credentials; deliberately discard them.
    return failure("request_failed");
  }
}

export async function runCheck({ env, fetchImpl } = {}) {
  try {
    // Check context before even accessing the credential property.
    if (
      env?.GITHUB_ACTIONS !== "true" ||
      env.GITHUB_REPOSITORY !== REPOSITORY ||
      env.GITHUB_REF !== "refs/heads/main" ||
      env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
      env.GITHUB_WORKFLOW !== CHECK_WORKFLOW
    ) {
      return failure("workflow_context_required");
    }
    if (env.NODE_OPTIONS || env.NODE_DEBUG || env.NODE_DEBUG_NATIVE || env.DEBUG) {
      return failure("runtime_debugging_enabled");
    }
    return await checkAccount({ token: env.INSTAGRAM_ACCESS_TOKEN, fetchImpl });
  } catch {
    return failure("check_failed");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runCheck({ env: process.env });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === "success" ? 0 : 1;
}
