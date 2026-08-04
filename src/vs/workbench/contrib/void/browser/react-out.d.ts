/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

declare module '*react/out/diff/index.js' {
  export function diffLines(oldStr: string, newStr: string): any[];
}

declare module '*react/out/void-settings-tsx/index.js' {
  export function mountVoidSettings(elt: HTMLElement, accessor: any): { dispose: () => void };
}

declare module '*react/out/void-editor-widgets-tsx/index.js' {
  export function mountVoidSelectionHelper(elt: HTMLElement, accessor: any): any;
  export function mountVoidCommandBar(elt: HTMLElement, accessor: any, props: any): { dispose: () => void; rerender: (props: any) => void };
}

declare module '*react/out/void-onboarding/index.js' {
  export function mountVoidOnboarding(elt: HTMLElement, accessor: any): { dispose: () => void };
}

declare module '*react/out/void-tooltip/index.js' {
  export function mountVoidTooltip(elt: HTMLElement, accessor: any): { dispose: () => void };
}

declare module '*react/out/sidebar-tsx/index.js' {
  export function mountSidebar(elt: HTMLElement, accessor: any): { dispose: () => void };
}

declare module '*react/out/quick-edit-tsx/index.js' {
  export function mountCtrlK(elt: HTMLElement, accessor: any, props: any): { dispose: () => void };
}
