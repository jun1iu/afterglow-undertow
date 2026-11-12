"use client";

import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { IconButton } from "./IconButton";

/** The floating glass control panel shared by every studio. */
export function Panel({
  label,
  title,
  caption,
  actions,
  onClose,
  children,
}: {
  label: string;
  title: string;
  caption: string;
  actions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={label}
      className="flex max-h-full w-full flex-col overflow-hidden rounded-2xl glass sm:w-[19rem]"
    >
      <header className="flex items-center justify-between py-2 pr-2 pl-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="size-1.5 shrink-0 animate-breathe rounded-full bg-accent shadow-[0_0_10px_var(--accent)]"
          />
          <span className="truncate text-sm font-medium">{title}</span>
          <span className="truncate label-caps text-paper/40">{caption}</span>
        </div>
        <div className="flex shrink-0">
          {actions}
          <IconButton label="Close controls" onClick={onClose} className="sm:hidden">
            <X />
          </IconButton>
        </div>
      </header>
      <div className="scrollbar-none overflow-y-auto border-t border-paper/10">{children}</div>
    </aside>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-paper/10 px-4 pt-3.5 pb-4 first:border-t-0">
      <header className="mb-3 flex h-6 items-center justify-between">
        <h2 className="label-caps text-paper/45">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function SectionAction({ children, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className="-mr-1.5 flex h-6 items-center gap-1.5 rounded-full px-2 text-xs text-paper/60 transition-colors hover:bg-paper/10 hover:text-paper [&_svg]:size-3"
      {...props}
    >
      {children}
    </button>
  );
}
