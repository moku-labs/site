/** @file The home page. A placeholder until the design round delivers the real landing page. */
import type { VNode } from "preact";
import { SITE } from "../config";

/**
 * The home page body: a hello heading and the site tagline.
 *
 * @returns The page markup rendered into the layout's swap region.
 * @example
 * ```tsx
 * route("/").render(() => <HomePage />);
 * ```
 */
export function HomePage(): VNode {
  return (
    <section data-page="home">
      <h1>Hello from {SITE.name}</h1>
      <p>{SITE.description}</p>
    </section>
  );
}
