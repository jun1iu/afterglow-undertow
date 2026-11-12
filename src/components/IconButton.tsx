"use client";

import { Tooltip } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

interface IconButtonProps extends Omit<ComponentProps<"button">, "children"> {
  label: string;
  shortcut?: string;
  children: ReactNode;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-paper/15 bg-paper/5 px-1 font-mono text-[10px] text-paper/60">
      {children}
    </kbd>
  );
}

export function IconButton({ label, shortcut, children, className = "", ...props }: IconButtonProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className={`grid size-9 place-items-center rounded-full text-paper/70 transition-colors duration-150 hover:bg-paper/10 hover:text-paper active:scale-95 [&_svg]:size-4 ${className}`}
          {...props}
        >
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={8}
          className="glass z-50 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-paper/90 data-[state=closed]:opacity-0"
        >
          {label}
          {shortcut && <Kbd>{shortcut}</Kbd>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
