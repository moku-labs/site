---
title: Rulesets
description: "rulesets/main.json: main moves only through a pull request with the four checks green."
section: Reference
order: 21
---

## The ruleset

`setup` applies this file to the repository. After it, `main` can only move through a pull request,
so every release describes a state that passed the checks.

```json file="rulesets/main.json" hl="25-28"
{
  "name": "protect-main",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "ci / lint" },
          { "context": "ci / types" },
          { "context": "ci / test" },
          { "context": "ci / build" }
        ]
      }
    }
  ]
}
```

| Rule | What it means |
|---|---|
| `deletion` | `main` cannot be deleted |
| `non_fast_forward` | No force push |
| `pull_request` | Every change comes through a PR. An approval is not required, so a solo maintainer can merge. |
| `required_status_checks` | The four checks must pass |
| `strict_required_status_checks_policy` | The branch must be up to date with `main` before it merges |
| `bypass_actors: []` | Nobody is exempt, admins included |

The `release` job is not stopped by it, because it pushes a tag and never writes `main`.

## Why the check names look like that

GitHub prefixes a reusable workflow's jobs with the caller's job id. The caller's id is `ci`, so the
job `lint` reports as `ci / lint`. Rename the job and no required check ever reports. Every pull
request then waits forever.

## Which checks are not required

| Check | Why not |
|---|---|
| `ci / preview` | pkg.pr.new is a convenience. It must not block a merge. |
| `ci / extra (<script>)` | A project's own check. Add it yourself. |
| `demos / fast`, `demos / full` | Only some repositories run the demos |

## Require one more check

Edit the ruleset of that repository. The central file stays as it is. `doctor` and `setup` accept a
project's own required check: only a central name with no `ci / ` prefix counts as legacy.

:::steps
1. **Find the ruleset.**

   ```sh terminal title="list"
   $ gh api repos/acme/toolkit/rulesets --jq '.[] | "\(.id) \(.name)"'
   ```

2. **Save its rules, then add the check under `required_status_checks`.** Only the rules go back: the response also holds fields the API sets itself.

   ```sh terminal title="read"
   $ gh api repos/acme/toolkit/rulesets/7 --jq '{rules}' > ruleset.json
   ```

   ```diff file="ruleset.json"
              { "context": "ci / build" },
   +          { "context": "ci / extra (check:bundle)" },
   +          { "context": "demos / fast" }
   ```

3. **Send it back.**

   ```sh terminal title="write"
   $ gh api repos/acme/toolkit/rulesets/7 --method PUT --input ruleset.json
   ```
:::

## A legacy ruleset

An older ruleset requires `lint`, while the thin caller reports `ci / lint`, so no pull request can
merge. `doctor` warns and names the checks. `setup` moves that ruleset to the central names and keeps
your own required checks.

```sh terminal title="doctor"
⚠ branch ruleset on main — ruleset requires legacy checks: lint, types
    fix: moku-release setup
```

## An app

The CLI sets up packages only, and an app's checks have other names. Copy the file and require the
one check `app-deploy.yml` reports on a pull request.

```diff file="ruleset.json"
         "required_status_checks": [
-          { "context": "ci / lint" },
-          { "context": "ci / types" },
-          { "context": "ci / test" },
-          { "context": "ci / build" }
+          { "context": "ci / Validate (typecheck · lint · test · build)" }
         ]
```

```sh terminal title="apply"
$ gh api repos/acme/site/rulesets --method POST --input ruleset.json
```

:::callout{tone="warn"}
Do not require `ci / Deploy to Cloudflare`. On a pull request it is skipped, and it runs only after
the merge.
:::
