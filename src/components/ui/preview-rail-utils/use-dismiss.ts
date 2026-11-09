"use client";

import { type RefObject, useEffect } from "react";

export type DismissBehavior = "pass-through" | "consume";

export interface DismissOptions {
  behavior?: DismissBehavior;
  escape?: boolean;
  ignore?: (target: Element) => boolean;
}

const openScopes = new Set<(target: Element) => boolean>();

function claimedByAnotherScope(
  self: (target: Element) => boolean,
  target: Element,
) {
  for (const scope of openScopes) {
    if (scope !== self && scope(target)) return true;
  }
  return false;
}

function consumeActivation(source: Event) {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    release();
  };
  const restart = (event: Event) => {
    if (event !== source) release();
  };
  const release = () => {
    window.removeEventListener("click", swallow, true);
    window.removeEventListener("pointerdown", restart, true);
    window.removeEventListener("pointercancel", restart, true);
    window.removeEventListener("keydown", release, true);
  };
  window.addEventListener("click", swallow, true);
  window.addEventListener("pointerdown", restart, true);
  window.addEventListener("pointercancel", restart, true);
  window.addEventListener("keydown", release, true);
}

export function useDismiss(
  open: boolean,
  onDismiss: () => void,
  ref: RefObject<Element | null> | null,
  options: DismissOptions = {},
) {
  const { behavior = "pass-through", escape: dismissOnEscape = true, ignore } = options;

  useEffect(() => {
    if (!open) return;

    const inside = (target: Element) =>
      Boolean(ref?.current?.contains(target)) || Boolean(ignore?.(target));

    openScopes.add(inside);

    const onKey = (event: KeyboardEvent) => {
      if (dismissOnEscape && event.key === "Escape") {
        event.preventDefault();
        onDismiss();
      }
    };

    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (inside(target) || claimedByAnotherScope(inside, target)) return;

      if (behavior === "consume") consumeActivation(event);
      onDismiss();
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer, true);

    return () => {
      openScopes.delete(inside);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open, onDismiss, ref, behavior, dismissOnEscape, ignore]);
}
