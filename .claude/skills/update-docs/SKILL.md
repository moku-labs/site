---
name: update-docs
description: Update content/docs after a release of one or more @moku-labs/* packages. Reads what each bumped package added, changed or removed, then brings the API reference, the guides and their compiled examples up to date, and proves it with typecheck, lint and tests. Use when a dependency bump turns docs tests red, when someone asks to update the docs for a new version, or when scripts/update-docs.ts runs it in CI.
---

# Update the docs after a package release

The site documents every `@moku-labs/*` package in `content/docs/<package>/`. A release can add an
export, change a type or change behaviour. Two tests catch part of that. Your job covers all of it.

## 1. Know what changed

For each bumped package (name, old version, new version):

1. **Release notes.** `gh release view v<new> --repo moku-labs/<repo>` for every version after the
   old one up to the new one (`gh release list --repo moku-labs/<repo> --limit 20` lists them). The
   repo is the package name without the scope: `@moku-labs/game` is `moku-labs/game`.
2. **The installed package.** `node_modules/@moku-labs/<repo>/` is the new version. Its `README.md`,
   its plugin READMEs and its `dist/*.d.mts` (JSDoc with `@example`) are the source of truth for
   names, signatures and behaviour. Never describe an API from memory or from the release title alone.
3. **The failing tests**, if any: `bun run test:integration 2>&1 | tail -80`.

Write yourself a short list: added, changed, removed, and which docs page each one belongs to.

## 2. Update the pages

| Change | Where |
|---|---|
| A new export (function, class, constant, plugin) | `content/docs/<package>/api.md`, in the section it belongs to. One line or a signature in a `no-check` block. |
| A new feature a user would reach for (an effect, a component, a plugin option) | Also the guide that covers its area, under `content/docs/<package>/guides/` or `plugins/`: what it is for and a short example. |
| A changed signature or type | Every example that uses it. Find them with `grep -rn "<name>" content/docs`. |
| A removed or renamed export | Remove or rename it in `api.md` and every page. |
| Changed behaviour with the same types | The sentence that describes the old behaviour. |

Rules of this site:

- Syntax (frontmatter, directives, code block attributes) is in `README.md`, "Writing docs". Copy the
  style of the page you edit: its tone, its table shapes, its heading depth.
- A `ts` or `tsx` block is `check` (compiled against the installed packages) or
  `no-check="<reason>"`. A new example is `check` whenever it can be. A `check` block that needs a
  file of the reader's project uses the stubs in `content/snippet-stubs/<package>/`.
- Never type a version number or a kernel error message in content. The site reads both from the
  installed packages.
- Do not touch `src/`, `tests/`, `package.json` or the lockfile. Only `content/docs/` and, when a new
  example needs one, `content/snippet-stubs/`.
- A docs page is never deleted. A page about a removed feature is rewritten or gets a `drift` note.

## 3. Prove it

Run each and fix what fails, until all three are green:

```bash
bun run typecheck
bun run lint
bun run test:coverage
```

`tests/integration/api-reference.test.ts` compares each `api.md` with the real exports.
`tests/integration/docs-snippets.test.ts` compiles every `check` block. A red test is never fixed
by weakening it, by marking a block `no-check`, or by editing the test.

## 4. Report

End with a short summary: per package, what changed upstream and which pages you edited. Name
anything you could not document with confidence, so a person reviews it.
