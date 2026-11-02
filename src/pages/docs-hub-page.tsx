/**
 * @file The docs hub (A2): search, sync state, the concepts cards and the family by group.
 */
import type { VNode } from "preact";
import { CubeIcon, conceptGlyph } from "../components/cube-icon";
import { DocumentMeta } from "../components/doc-meta";
import { PackageIcon, SearchIcon } from "../components/icons";
import { SyncBadge } from "../components/sync-badge";
import type { PackageGroup } from "../data/packages";
import type {
  DocumentationConceptCard,
  DocumentationHubView,
  DocumentationPackage,
  DocumentationPackageGroup
} from "../lib/docs-data";

/** The line under each group title. */
const GROUP_NOTES: Readonly<Record<PackageGroup, string>> = {
  Start: "Let the agent drive.",
  Core: "The kernel and its shared plugins.",
  Frameworks: "Pick a runtime.",
  Native: "Desktop and mobile installers.",
  Game: "Puzzle engine and its devtools.",
  Tooling: "Assets and releases."
};

/**
 * One concepts card.
 *
 * @param props - Component props.
 * @param props.card - The concepts page.
 * @returns The card link.
 */
function ConceptCard(props: { card: DocumentationConceptCard }): VNode {
  const { card } = props;
  return (
    <a data-part="concept" href={card.path}>
      <CubeIcon tone="docs" glyph={conceptGlyph(card.slug)} size={34} />
      <b>
        {card.title}
        {card.full ? <small data-part="full">full page</small> : undefined}
      </b>
      <span>{card.description}</span>
    </a>
  );
}

/**
 * One package row of a group card; a package without docs pages is not a link.
 *
 * @param props - Component props.
 * @param props.entry - The package.
 * @returns The row.
 */
function PackageRow(props: { entry: DocumentationPackage }): VNode {
  const { entry } = props;
  const body = (
    <>
      <PackageIcon id={entry.icon} size={44} />
      <span data-part="name">{entry.name}</span>
      <span data-part="version">{entry.versionLabel}</span>
      <span data-part="tagline">{entry.tagline}</span>
      {entry.drift === undefined ? undefined : <span data-part="drift">{entry.drift}</span>}
    </>
  );
  return entry.home === undefined ? (
    <div data-part="package">{body}</div>
  ) : (
    <a data-part="package" href={entry.home}>
      {body}
    </a>
  );
}

/**
 * One group card.
 *
 * @param props - Component props.
 * @param props.group - The group.
 * @returns The `<section data-part="group">`.
 */
function GroupCard(props: { group: DocumentationPackageGroup }): VNode {
  const { group } = props;
  return (
    <section data-part="group">
      <h3>
        {group.label}
        <small>{group.packages.length}</small>
      </h3>
      <p data-part="note">{GROUP_NOTES[group.label]}</p>
      <ul>
        {group.packages.map(entry => (
          <li key={entry.id}>
            <PackageRow entry={entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The docs hub page. The search button opens the ⌘K palette (`data-search-open`).
 *
 * @param props - Component props.
 * @param props.view - The hub view loaded at build.
 * @returns The page root, in docs mode.
 * @example
 * ```tsx
 * route("/docs/").render(ctx => <DocumentationHubPage view={ctx.data} />);
 * ```
 */
export function DocumentationHubPage(props: { view: DocumentationHubView }): VNode {
  const { view } = props;
  return (
    <div data-page="docs-hub" data-mode="docs">
      <div data-component="docs-hub">
        <header data-part="head">
          <div>
            <h1>Docs</h1>
            <p data-part="intro">
              {view.packageCount} packages, one kernel. If an agent writes your code, start with the
              Claude plugin. If you write the framework, start with the concepts.
            </p>
          </div>
          <button type="button" data-part="search" data-search-open>
            <SearchIcon size={18} />
            Search packages, guides, plugins, APIs
            <kbd>⌘K</kbd>
          </button>
          <DocumentMeta markdownUrl={view.markdownUrl}>
            <SyncBadge
              state="synced"
              label={`Synced with ${view.packageCount} published packages · checked ${view.checked}`}
              tipTitle="Every page is checked on every build."
            >
              Checked examples compile against the installed release of each package. A page that no
              longer matches gets a drift badge.
            </SyncBadge>
            {view.drifts.map(entry => (
              <SyncBadge
                key={entry.id}
                state="drift"
                label={`${entry.name}: ${entry.drift}`}
                tipTitle="Drift found."
              >
                A page of {entry.name} no longer matches {entry.release}. It shows the drift badge
                until it is fixed.
              </SyncBadge>
            ))}
          </DocumentMeta>
        </header>
        <section data-part="section">
          <h2>Concepts</h2>
          <p>How every Moku package works underneath. From @moku-labs/core.</p>
          <div data-part="concepts">
            {view.concepts.map(card => (
              <ConceptCard key={card.path} card={card} />
            ))}
          </div>
        </section>
        <section data-part="section">
          <h2>Packages</h2>
          <p>Grouped by what you are building.</p>
          <div data-part="groups">
            {view.groups.map(group => (
              <GroupCard key={group.label} group={group} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
