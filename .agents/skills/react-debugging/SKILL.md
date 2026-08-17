---
name: react-debugging
description: Diagnoses and fixes Forge React UI components, state management, hooks, and browser view rendering. Use when debugging React frontend behavior or UI layout glitches.
---

# React Debugging for Forge Workbench

## Procedure
1. Inspect the target component under `src/vs/workbench/contrib/void/browser/react/`.
2. Trace component props, state hooks (`useState`, `useReducer`), and context providers.
3. Check `useEffect` / `useMemo` dependency arrays for stale closures or unnecessary rerenders.
4. Verify CSS / layout rules and theme variable bindings.
5. Rebuild with `npm run buildreact` after modifications.
6. Verify rendered UI behavior in Forge IDE.
