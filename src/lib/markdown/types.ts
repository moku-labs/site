/**
 * @file Minimal structural types for the unified plugins passed to the content renderer.
 *
 * Declared here instead of importing from `unified`, so the site adds no dependency.
 */

/** A syntax-tree transformer returned by a unified plugin. */
export type TreeTransformer = (tree: unknown) => void;

/** A unified plugin: a function that returns a tree transformer. */
export type UnifiedPlugin = () => TreeTransformer;
