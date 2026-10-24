# Instagram-only recovery

Target: `nannantown/coffee-daily-video`, `@open_ground_coffee_roasters`
(`17841464767833513`), linked Page `1149844638201593`.
Existing Secrets only: `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`,
`FACEBOOK_PAGE_ID`. No new OAuth scope or Secret is needed by this change.

Daily and both recovery workflows share `coffee-instagram-publication`
concurrency. A conditional GitHub Contents write to
`data/instagram-post-receipts.json` reserves each JST date before a Meta POST.
`contents: write` is limited to the daily publishing job and each recovery
job that saves this receipt; preparation and PR tests remain read-only.
The existing Oct19 success `18137947933725162` is seeded and always skipped.

## Inspect before a manual retry

Use **Test Instagram Upload (manual)** on **main**, set the exact
`release_tag=vYYYYMMDD`, `asset_name=coffee-YYYYMMDD.mp4`, and `action=inspect`.
This performs GitHub GETs only and reports the receipt state plus a public
plan containing Release/asset IDs, names, sizes and SHA-256 hashes. It does not
read the Instagram token. Review the actual archived video/caption and account
before authorizing publication. Never enter a token in workflow inputs.

For a subsequent write action, supply `video_sha256` and `captions_sha256`
exactly as inspected. Preparation pins the complete plan. The recovery job
rechecks the plan, downloads those asset IDs, hashes the exact bytes, and checks
the caption date and existing brand/recipe-number rules. Any mismatch stops.
Archived captions are mandatory: `regenerate_captions=true` now fails safely
instead of generating text from a later day's content. There is no URL fallback.

## Choose the action from the receipt state

| State | Safe action |
| --- | --- |
| `published` or history with a known media ID | Every action skips; never republishes. |
| `absent` | `retry`. For a past date also check the platform and set `confirmed_unpublished=true`. |
| `unresolved` (legacy history with no media ID) | Check the platform first. Only if verified unpublished, use `retry` with `confirmed_unpublished=true`; absence of a history ID is not proof. |
| `started` | `resume_before_publish` with the same hashes. Ownership transfers atomically; an older runner cannot cross the publish barrier. A new unpublished upload container may be created. Past dates still require explicit unpublished confirmation. |
| `publishing` | Never retry or reset automatically. Check the platform for the original result. If published, use `reconcile_published` with its confirmed `published_media_id` and the same source hashes. This makes GETs to verify account ownership, the recorded publication JST date, caption and Reel type, then saves the receipt; it never creates or publishes media. |

If a `publishing` result cannot be confirmed, leave it unresolved. A timeout,
an empty listing, an expired container or a failed response is not proof that
no Reel was published. There is deliberately no force/reset action. Reconciliation
checks up to 1,000 owned recent media; older or otherwise unverifiable media
require human investigation and remain blocked. A `started` entry cannot be
reconciled while its previous owner might still be allowed to publish.
Historical retries record their actual publication date separately from the
source video's date. A run crossing JST midnight may need human investigation
if the media timestamp no longer matches that recorded day; it is never reset
or republished automatically.

**Retry Today's Instagram (push-triggered)** retains `.retry-ig-trigger` on main.
It pins only today's exact archived assets. It may claim a new date or safely
resume a matching `started` claim. It stops on legacy uncertainty, changed
source or `publishing`; it cannot authorize historical posts or reconciliation.
Retry by dispatching a new run; GitHub's “Re-run jobs” is blocked for mutation.

The publisher sends credentials only in Authorization headers, rejects upload
destinations outside `rupload.facebook.com`, and reports fixed error codes.
An uncertain receipt write or publish outcome requires review. Receipt commits
contain only public dates, hashes, IDs and states. Recovery does not run the
pipeline, YouTube upload, caption generation, or performance-history overwrite.

These guards cover the reviewed publisher and workflows. Manual Instagram posts,
external publishers and rerunning old workflow revisions cannot be coordinated
by this ledger. Full-pipeline/YouTube duplicate prevention is outside this change.
PR CI uses mocks only; live Meta publishing and branch-write behavior still need
separate approval and validation after review. Do not dispatch a production run
merely to test authentication.
