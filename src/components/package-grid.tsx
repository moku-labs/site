/**
 * @file "Twelve packages. One kernel." (A1): one lot per package with its cube art.
 */
import type { VNode } from "preact";
import type { HomePackage } from "../lib/home-data";
import type { UrlBuilder } from "../lib/url-builder";

/**
 * The package family as a grid of lots; each lot opens the package's docs.
 *
 * @param props - Component props.
 * @param props.packages - The family in family order, with installed versions.
 * @param props.url - Route link builder.
 * @returns The `<ul data-component="package-grid">`.
 * @example
 * ```tsx
 * <PackageGrid packages={view.packages} url={url} />
 * ```
 */
export function PackageGrid(props: { packages: readonly HomePackage[]; url: UrlBuilder }): VNode {
  return (
    <ul data-component="package-grid">
      {props.packages.map(entry => (
        <li key={entry.id}>
          <a href={props.url("docsPackage", { pkg: entry.id })}>
            <span data-part="icon">
              <img
                src={`/art/icon-${entry.id}-256.webp`}
                srcset={`/art/icon-${entry.id}-256.webp 256w, /art/icon-${entry.id}-512.webp 512w`}
                sizes="76px"
                width={76}
                height={76}
                alt=""
                loading="lazy"
                decoding="async"
              />
              <i data-part="shadow" />
            </span>
            <span data-part="group">{entry.group}</span>
            <span data-part="name">{entry.name}</span>
            <span data-part="version">{entry.version}</span>
            <span data-part="tagline">{entry.tagline}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
