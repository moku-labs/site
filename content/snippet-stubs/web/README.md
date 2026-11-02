# Snippet stubs

The smallest reader project the docs examples import from. `src/lib/snippets.ts` copies
`<package>/` into the project of every `check` block of `content/docs/<package>/`, then writes
the blocks over it. A block's relative import that its own `group` does not hold resolves here.

Stubs are real code against the installed packages. A stub that stops compiling fails the test run.

These files are fixtures, never an app entry. Do not import them from `src/` or `scripts/`.
