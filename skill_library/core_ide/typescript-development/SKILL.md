---
name: typescript-development
description: TypeScript compilation, service interfaces, async patterns, and strict typing across core and UI. Use when refactoring TypeScript code, fixing type errors, or designing services.
---

# TypeScript Development Standards

## Guidelines
1. **Dependency Injection:** Use VS Code service decoration (`createDecorator`, `@IInstantiationService`).
2. **Type Safety:** Avoid `any`; use strict typing, discriminating unions, and exhaustiveness checking.
3. **Disposables:** Ensure all listeners and subscriptions extend `Disposable` or are registered in `DisposableStore`.
4. **Build & Typecheck:** Verify with `npm run compile`.
