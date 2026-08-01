/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]): void {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcutsRef.current) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ?? false ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        const shiftMatch = shortcut.shift ?? false ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ?? false ? e.altKey : !e.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}

export const defaultChatShortcuts: KeyboardShortcut[] = [
  {
    key: 'Enter',
    ctrl: false,
    shift: true,
    alt: false,
    meta: false,
    action: () => {
      const textarea = document.activeElement;
      if (textarea && textarea.tagName === 'TEXTAREA') {
        textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
      }
    },
    description: 'New line in textarea',
    preventDefault: false,
  },
  {
    key: 'Enter',
    ctrl: false,
    shift: false,
    alt: false,
    meta: false,
    action: () => {
      const submitBtn = document.querySelector('[data-action="submit"]');
      submitBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
    description: 'Submit message',
    preventDefault: true,
  },
  {
    key: 'Escape',
    ctrl: false,
    shift: false,
    alt: false,
    meta: false,
    action: () => {
      const abortBtn = document.querySelector('[data-action="abort"]');
      abortBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
    description: 'Abort current operation',
    preventDefault: true,
  },
  {
    key: 'k',
    ctrl: true,
    shift: false,
    alt: false,
    meta: false,
    action: () => {
      const slashInput = document.querySelector('[data-slash-command]');
      slashInput?.dispatchEvent(new MouseEvent('focus', { bubbles: true }));
    },
    description: 'Open slash command palette',
    preventDefault: true,
  },
  {
    key: 'v',
    ctrl: true,
    shift: false,
    alt: false,
    meta: false,
    action: () => {
      const voiceBtn = document.querySelector('[data-action="voice-toggle"]');
      voiceBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
    description: 'Toggle voice input',
    preventDefault: true,
  },
];