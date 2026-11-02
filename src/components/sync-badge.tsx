/**
 * @file The pill that says whether a page's examples still match the published package.
 */
import type { ComponentChildren, VNode } from "preact";

/** Props of {@link SyncBadge}. */
type SyncBadgeProperties = {
  /** `synced` is green, `drift` is amber. */
  state: "synced" | "drift";
  /** The pill text. */
  label: string;
  /** First line of the tooltip. */
  tipTitle: string;
  /** Rest of the tooltip. */
  children: ComponentChildren;
};

/**
 * A sync or drift pill with a tooltip on hover and focus.
 *
 * @param props - Component props.
 * @returns The `<button data-component="sync-badge">`; a button so focus shows the tooltip too.
 * @example
 * ```tsx
 * <SyncBadge state="synced" label="Synced with @moku-labs/web v2.4.11 · checked 2026-11-02" tipTitle="Docs checked against the published package.">
 *   Every checked example on this page compiled against @moku-labs/web v2.4.11.
 * </SyncBadge>
 * ```
 */
export function SyncBadge(props: SyncBadgeProperties): VNode {
  return (
    <button type="button" data-component="sync-badge" data-state={props.state}>
      {props.label}
      <span data-part="tip" role="tooltip">
        <b>{props.tipTitle}</b>
        {props.children}
      </span>
    </button>
  );
}

/** Props of {@link PageSyncBadge}. */
type PageSyncBadgeProperties = {
  /** The release the page is checked against, e.g. `@moku-labs/web v2.4.11`. */
  release: string;
  /** Check date. */
  checked: string;
  /** Drift note, or `undefined` when in sync; a note turns the pill amber. */
  drift: string | undefined;
};

/**
 * The sync badge of a docs page: green "Synced with …", or amber "Drift: …" when the page's
 * frontmatter carries a drift note.
 *
 * @param props - Component props.
 * @returns The badge.
 * @example
 * ```tsx
 * <PageSyncBadge release="@moku-labs/room v0.8.9" checked="2026-11-02" drift="1 example out of date" />
 * ```
 */
export function PageSyncBadge(props: PageSyncBadgeProperties): VNode {
  const { release, checked, drift } = props;
  if (drift !== undefined) {
    return (
      <SyncBadge
        state="drift"
        label={`Drift: ${drift} · ${release} · checked ${checked}`}
        tipTitle="This page no longer matches the package."
      >
        Its examples were checked against {release}. The badge stays until the page is fixed.
      </SyncBadge>
    );
  }
  return (
    <SyncBadge
      state="synced"
      label={`Synced with ${release} · checked ${checked}`}
      tipTitle="Docs checked against the published package."
    >
      Every checked example on this page compiled against {release}, installed from npm, in the run
      that built this page. If one breaks, the badge turns to this:
      <span data-component="sync-badge" data-state="drift">
        Drift: 1 example out of date
      </span>
    </SyncBadge>
  );
}
