"use client";

import { useSyncExternalStore } from "react";

/**
 * A minimal external store. React reads it through `useSyncExternalStore`;
 * anything else (a render loop, say) can subscribe directly and stay out of
 * React's way.
 */
export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    get: () => state,
    set(next: T) {
      if (next === state) return;
      state = next;
      for (const listener of listeners) listener();
    },
    subscribe,
    use<S>(selector: (state: T) => S): S {
      return useSyncExternalStore(
        subscribe,
        () => selector(state),
        () => selector(initial),
      );
    },
  };
}
