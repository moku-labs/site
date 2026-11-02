/**
 * @file The about page (A12, U12): portrait, name, motto, bio, links, principles and the row of
 * everything the lab ships.
 */
import type { VNode } from "preact";
import { PackageIcon } from "../components/icons";
import { about, portraitAlt, principles } from "../data/about";
import { packages } from "../data/packages";
import type { UrlBuilder } from "../lib/url-builder";

/**
 * The about page.
 *
 * @param props - Component props.
 * @param props.url - Route link builder.
 * @returns The page root.
 * @example
 * ```tsx
 * route("/about/").render(ctx => <AboutPage url={ctx.url} />);
 * ```
 */
export function AboutPage(props: { url: UrlBuilder }): VNode {
  return (
    <div data-page="about">
      <div data-component="about-page">
        <section data-part="intro">
          <div data-part="portrait">
            <img
              src="/art/about-portrait.webp"
              width={640}
              height={640}
              alt={portraitAlt}
              decoding="async"
            />
          </div>
          <div>
            <h1>{about.name}</h1>
            <p data-part="motto">{about.motto}</p>
            {about.bio.map(paragraph => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <div data-part="links">
              {about.links.map((link, index) => (
                <a
                  key={link.href}
                  data-component="button"
                  data-variant={index === 0 ? "primary" : "ghost"}
                  href={link.href}
                  target="_blank"
                  rel="noopener"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </section>
        <section data-part="principles" aria-label="How the lab works">
          {principles.map(principle => (
            <div key={principle.title}>
              <b>{principle.title}</b>
              <p>{principle.text}</p>
            </div>
          ))}
        </section>
        <section data-part="ships" aria-labelledby="ships-title">
          <h2 id="ships-title">What the lab ships</h2>
          <ul>
            {packages.map(entry => (
              <li key={entry.id}>
                <a href={props.url("docsPackage", { pkg: entry.id })}>
                  <PackageIcon id={entry.id} size={72} />
                  <span data-part="name">
                    {entry.name.split(/(?<=\/)/).map(part => (
                      <span key={part}>{part}</span>
                    ))}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
