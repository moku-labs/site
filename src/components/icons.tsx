/**
 * @file Small decorative icons of the chrome and the package art.
 */
import type { VNode } from "preact";

/**
 * The magnifier of the search buttons.
 *
 * @param props - Component props.
 * @param props.size - Width and height in CSS px.
 * @returns The `<svg>`.
 * @example
 * ```tsx
 * <SearchIcon size={15} />
 * ```
 */
export function SearchIcon(props: { size: number }): VNode {
  return (
    <svg
      viewBox="0 0 24 24"
      width={props.size}
      height={props.size}
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      aria-hidden="true"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21" />
    </svg>
  );
}

/**
 * The disclosure chevron; the parent's sheet rotates it when the disclosure is open.
 *
 * @returns The `<svg>`.
 * @example
 * ```tsx
 * <summary>Pages <ChevronIcon /></summary>
 * ```
 */
export function ChevronIcon(): VNode {
  return (
    <svg
      data-part="chevron"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * The cube of the theme toggle: a pale top, a filled left face and an outlined right face.
 *
 * @returns The `<svg>`.
 * @example
 * ```tsx
 * <button type="button"><ThemeCubeIcon /> Light</button>
 * ```
 */
export function ThemeCubeIcon(): VNode {
  return (
    <svg viewBox="0 0 100 104" width="16" height="17" aria-hidden="true">
      <polygon points="50,8 92,30 50,52 8,30" fill="currentColor" opacity=".35" />
      <polygon points="8,30 50,52 50,96 8,74" fill="currentColor" />
      <polygon
        points="50,52 92,30 92,74 50,96"
        fill="none"
        stroke="currentColor"
        stroke-width="7"
      />
    </svg>
  );
}

/**
 * A package's isometric cube art from `public/art/`, decorative.
 *
 * @param props - Component props.
 * @param props.id - Package id, e.g. `web`.
 * @param props.size - Width and height in CSS px.
 * @returns The `<img>`.
 * @example
 * ```tsx
 * <PackageIcon id="web" size={44} />
 * ```
 */
export function PackageIcon(props: { id: string; size: number }): VNode {
  // `loading` comes before `src`: Preact sets props in order, and a browser that sees `src` first
  // starts the download before it learns the image is lazy.
  return (
    <img
      loading="lazy"
      decoding="async"
      data-component="package-icon"
      src={`/art/icon-${props.id}-256.webp`}
      srcset={`/art/icon-${props.id}-256.webp 256w, /art/icon-${props.id}-512.webp 512w`}
      sizes={`${props.size}px`}
      width={props.size}
      height={props.size}
      alt=""
    />
  );
}
