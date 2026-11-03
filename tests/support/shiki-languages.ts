import { bundledLanguages } from "shiki";

// The framework calls @shikijs/rehype without `langs`, so the first render of every test file
// loads all 328 grammars: about 2 s of each slow test. Tests keep the languages the docs write,
// by full name: a second app in one file asks Shiki again, and `ts` then resolves to `typescript`.
// `bun scripts/build.ts` without this file still runs in the commit hook and in CI.
const USED_LANGUAGES = new Set([
  "css",
  "diff",
  "html",
  "javascript",
  "json",
  "markdown",
  "shellscript",
  "toml",
  "tsx",
  "typescript",
  "yaml"
]);

for (const language of Object.keys(bundledLanguages)) {
  if (!USED_LANGUAGES.has(language)) {
    delete bundledLanguages[language as keyof typeof bundledLanguages];
  }
}
