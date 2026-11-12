"use client";

import { AnimatePresence, motion } from "motion/react";
import { useToast } from "@/lib/runtime";

export function Toaster() {
  const toast = useToast();

  return (
    <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-0 top-5 z-40 flex justify-center px-4">
      <AnimatePresence>
        {toast && (
          <motion.p
            key={toast.id}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            className="glass rounded-full px-4 py-2 text-[13px] text-paper/90"
          >
            {toast.message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
