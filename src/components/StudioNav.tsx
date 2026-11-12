"use client";

import Link from "next/link";

const STUDIOS = [
  { href: "/", name: "Afterglow", caption: "Materials" },
  { href: "/fluid", name: "Undertow", caption: "Fluid" },
] as const;

/** Wordmark for the current studio plus a switch to the other one. */
export function StudioNav({ current }: { current: (typeof STUDIOS)[number]["name"] }) {
  return (
    <nav aria-label="Studios" className="flex items-center gap-4 [text-shadow:0_1px_16px_rgb(0_0_0/0.5)]">
      <span className="font-display text-[26px] leading-none italic">{current}</span>
      <ul className="flex items-center gap-1 rounded-full p-0.5 glass [text-shadow:none]">
        {STUDIOS.map((studio) => {
          const active = studio.name === current;
          return (
            // On phones only the link to the other studio is shown, to leave room for the toolbar.
            <li key={studio.href} className={active ? "max-sm:hidden" : undefined}>
              <Link
                href={studio.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-7 items-center rounded-full px-3 label-caps transition-colors ${
                  active ? "bg-paper text-ink" : "text-paper/60 hover:text-paper"
                }`}
              >
                {studio.caption}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
