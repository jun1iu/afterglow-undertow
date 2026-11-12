"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MATERIAL_IDS, MATERIALS } from "@/lib/gl/materials";
import { useStudio } from "@/lib/store";

const EASE = [0.16, 1, 0.3, 1] as const;

export function Title() {
  const id = useStudio((s) => s.material);
  const reduced = useReducedMotion();
  const def = MATERIALS[id];
  const index = MATERIAL_IDS.indexOf(id) + 1;

  return (
    <div className="[text-shadow:0_1px_24px_rgb(0_0_0/0.45)]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={id}
          initial="hidden"
          animate="shown"
          exit="gone"
          transition={{ staggerChildren: reduced ? 0 : 0.035 }}
        >
          <motion.p
            className="flex items-center gap-3 label-caps text-paper/70"
            variants={{
              hidden: { opacity: 0, y: 8 },
              shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
              gone: { opacity: 0, transition: { duration: 0.15 } },
            }}
          >
            <span className="tabular-nums">
              {String(index).padStart(2, "0")}
              <span className="text-paper/40"> / {String(MATERIAL_IDS.length).padStart(2, "0")}</span>
            </span>
            <span aria-hidden className="h-px w-8 bg-paper/40" />
            {def.technique}
          </motion.p>

          <h1
            aria-label={def.name}
            className="mt-2 flex font-display text-[clamp(4.5rem,15vw,11.5rem)] leading-[0.86] tracking-[-0.02em] italic sm:mt-3"
          >
            {Array.from(def.name).map((char, i) => (
              <motion.span
                key={i}
                aria-hidden
                className="inline-block pr-[0.04em] will-change-transform"
                variants={{
                  hidden: reduced ? { opacity: 0 } : { opacity: 0, y: "0.35em", filter: "blur(14px)" },
                  shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.8, ease: EASE } },
                  gone: reduced
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        y: "-0.12em",
                        filter: "blur(10px)",
                        transition: { duration: 0.2, ease: "easeIn" },
                      },
                }}
              >
                {char}
              </motion.span>
            ))}
          </h1>

          <motion.p
            className="mt-4 max-w-[26rem] text-[15px] leading-relaxed text-pretty text-paper/80 sm:mt-5"
            variants={{
              hidden: { opacity: 0, y: 8 },
              shown: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
              gone: { opacity: 0, transition: { duration: 0.15 } },
            }}
          >
            {def.blurb}
          </motion.p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
