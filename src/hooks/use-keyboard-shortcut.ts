"use client";

import { useEffect } from "react";

type KeyCombo = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
};

export function useKeyboardShortcut(
  combo: KeyCombo,
  callback: (e: KeyboardEvent) => void,
  disabled: boolean = false
) {
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const matchKey = event.key.toLowerCase() === combo.key.toLowerCase();
      const matchCtrl = combo.ctrlKey ? event.ctrlKey || event.metaKey : true;
      const matchAlt = combo.altKey ? event.altKey : true;
      const matchShift = combo.shiftKey ? event.shiftKey : true;

      // If modifier requirements are specified, enforce them exactly.
      // If they are not specified, we don't care.
      const ctrlCondition = combo.ctrlKey === undefined || matchCtrl;
      const altCondition = combo.altKey === undefined || matchAlt;
      const shiftCondition = combo.shiftKey === undefined || matchShift;

      if (matchKey && ctrlCondition && altCondition && shiftCondition) {
        event.preventDefault();
        callback(event);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [combo, callback, disabled]);
}
