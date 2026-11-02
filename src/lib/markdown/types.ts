/**
 * @file Minimal structural types for the unified plugins passed to the content renderer.
 *
 * Declared here instead of importing from `unified`, `mdast` or `hast`, so the site adds no
 * dependency. Each type is the subset of the real shape the plugins read or write.
 */

/** A value of a hast element property (`className` is a list, `dataLine` a number). */
export type HastPropertyValue = string | number | boolean | Array<string | number>;

/** The properties of a hast element, keyed by their camelCase name (`dataComponent`). */
export type HastProperties = { [name: string]: HastPropertyValue | undefined };

/** A hast text node. */
export type HastText = {
  /** Node kind. */
  type: "text";
  /** The text. */
  value: string;
};

/** A hast element: a tag with properties and children. */
export type HastElement = {
  /** Node kind. */
  type: "element";
  /** Lowercase tag name. */
  tagName: string;
  /** Element attributes, camelCase. */
  properties: HastProperties;
  /** Child nodes. */
  children: HastNode[];
};

/** A hast node the plugins pass through untouched (comment, doctype, raw HTML). */
export type HastOther = {
  /** Node kind. */
  type: "comment" | "doctype" | "raw";
  /** Source text, when the node has one. */
  value?: string;
};

/** Any hast node. */
export type HastNode = HastText | HastElement | HastOther;

/** The root of a hast tree. */
export type HastRoot = {
  /** Node kind. */
  type: "root";
  /** Top-level nodes. */
  children: HastNode[];
};

/** A hast node that has children. */
export type HastParent = HastRoot | HastElement;

/** The `data` bag of an mdast node: how `remark-rehype` turns it into hast. */
export type MdastData = {
  /** Tag name of the hast element this node becomes. */
  hName?: string;
  /** Properties merged onto the hast element. */
  hProperties?: HastProperties;
  /** Hast children that replace the converted children. */
  hChildren?: HastNode[];
  /** Set by `remark-directive` on the paragraph that holds a directive's `[label]`. */
  directiveLabel?: boolean;
};

/**
 * An mdast node, as one structural shape: the fields of `code`, `text`, `paragraph` and the
 * `remark-directive` nodes the plugins read, all optional except `type`.
 */
export type MdastNode = {
  /** Node kind: `code`, `paragraph`, `containerDirective`, … */
  type: string;
  /** Child nodes of a parent node. */
  children?: MdastNode[];
  /** Text of a literal node (`text`, `code`, `inlineCode`). */
  value?: string;
  /** Fence language of a `code` node. */
  lang?: string | null;
  /** Fence meta of a `code` node: everything after the language. */
  meta?: string | null;
  /** Directive name (`callout` for `:::callout`). */
  name?: string;
  /** Directive attributes from `{…}`. */
  attributes?: Record<string, string | null | undefined> | null;
  /** How the node becomes hast. */
  data?: MdastData;
};

/** A transform `mdast-util-from-markdown` runs on the finished mdast tree. */
export type MdastTransform = (tree: MdastNode) => void;

/** An `mdast-util-from-markdown` extension; the plugins only add `transforms`. */
export type FromMarkdownExtension = {
  /** Tree transforms run right after parsing, before any unified transformer. */
  transforms: MdastTransform[];
};

/** The data store of a unified processor, as `remark-parse` reads it. */
export type ProcessorData = {
  /** Unified settings; present so the type is not a weak type. */
  settings?: object | undefined;
  /** Extensions `remark-parse` passes to `mdast-util-from-markdown`. */
  fromMarkdownExtensions?: FromMarkdownExtension[];
};

/** The part of a unified processor a plugin attacher uses: its data store. */
export type ProcessorLike = {
  /**
   * The processor's data store, shared by every plugin.
   *
   * @returns The mutable data object.
   */
  data(): ProcessorData;
};

/** A hast tree transformer returned by a rehype plugin. */
export type HastTransformer = (tree: HastRoot) => void;

/** A parsed fence meta string: `file="src/app.ts" hl="3,5-7" check`. */
export type FenceMeta = {
  /** `key=value` pairs; quotes removed. */
  attributes: Record<string, string>;
  /** Bare words such as `check`, `diff`, `terminal`. */
  flags: Set<string>;
};

/** One displayed line of a code block, after notes and diff signs are taken out. */
export type CodeLine = {
  /** The code of the line. */
  text: string;
  /** Diff row kind, in a diff block. */
  change?: "add" | "del";
  /** Numbers of the notes that mark this line, from 1. */
  notes: number[];
};

/** The lines of a code block and the note texts found in it. */
export type CodeLines = {
  /** Displayed lines. */
  lines: CodeLine[];
  /** Note texts; note `n` is `notes[n - 1]`. */
  notes: string[];
};
