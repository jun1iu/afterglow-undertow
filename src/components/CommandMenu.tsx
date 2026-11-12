"use client";

import { Command } from "cmdk";
import { Download, EyeOff, Link2, Pause, Play, RotateCcw, Shuffle, Sparkle } from "lucide-react";
import type { ReactNode } from "react";
import { MATERIAL_LIST } from "@/lib/gl/materials";
import { runtime, useCommandOpen } from "@/lib/runtime";
import { actions, useStudio } from "@/lib/store";
import { Kbd } from "./IconButton";

function Item({
  icon,
  children,
  shortcut,
  keywords,
  onSelect,
}: {
  icon: ReactNode;
  children: ReactNode;
  shortcut?: string;
  keywords?: string[];
  onSelect: () => void;
}) {
  return (
    <Command.Item
      keywords={keywords}
      onSelect={() => {
        runtime.setCommandOpen(false);
        onSelect();
      }}
      className="flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-paper/75 data-[selected=true]:bg-paper/10 data-[selected=true]:text-paper [&_svg]:size-4 [&_svg]:text-paper/50"
    >
      {icon}
      <span className="grow">{children}</span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </Command.Item>
  );
}

const GROUP =
  "[&_[cmdk-group-heading]]:label-caps [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:text-paper/40";

export function CommandMenu() {
  const open = useCommandOpen();
  const paused = useStudio((s) => s.paused);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={runtime.setCommandOpen}
      label="Command menu"
      loop
      overlayClassName="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]"
      contentClassName="fixed top-[18vh] left-1/2 z-50 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 outline-none"
      className="glass overflow-hidden rounded-2xl"
    >
      <Command.Input
        placeholder="Switch material, shuffle, export…"
        className="h-13 w-full border-b border-paper/10 bg-transparent px-4 text-[15px] outline-none placeholder:text-paper/35"
      />
      <Command.List className="scrollbar-none max-h-[min(22rem,50vh)] overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-8 text-center text-sm text-paper/50">Nothing matches that.</Command.Empty>

        <Command.Group heading="Materials" className={GROUP}>
          {MATERIAL_LIST.map((material, i) => (
            <Item
              key={material.id}
              icon={<Sparkle />}
              shortcut={String(i + 1)}
              keywords={[material.technique]}
              onSelect={() => actions.setMaterial(material.id)}
            >
              {material.name}
              <span className="ml-2 text-paper/40">{material.technique}</span>
            </Item>
          ))}
        </Command.Group>

        <Command.Group heading="Actions" className={GROUP}>
          <Item icon={<Shuffle />} shortcut="R" keywords={["random", "palette", "seed"]} onSelect={actions.shuffle}>
            Shuffle palette &amp; seed
          </Item>
          <Item icon={paused ? <Play /> : <Pause />} shortcut="Space" keywords={["stop", "freeze"]} onSelect={actions.togglePaused}>
            {paused ? "Resume animation" : "Pause animation"}
          </Item>
          <Item icon={<Download />} shortcut="E" keywords={["save", "image", "download"]} onSelect={() => void runtime.exportPng()}>
            Export frame as PNG
          </Item>
          <Item icon={<Link2 />} shortcut="C" keywords={["share", "url"]} onSelect={() => void runtime.copyLink()}>
            Copy link to this look
          </Item>
          <Item icon={<EyeOff />} shortcut="H" keywords={["fullscreen", "zen", "ui"]} onSelect={actions.toggleChrome}>
            Hide interface
          </Item>
          <Item icon={<RotateCcw />} keywords={["default"]} onSelect={actions.resetMaterial}>
            Reset this material
          </Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
