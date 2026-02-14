---
name: bulletproof-react-components
description: Build React components that survive real-world conditions — SSR, hydration, concurrent rendering, portals, transitions, and more. Based on Shu Ding's "Building Bulletproof React Components". Use when writing, reviewing, or refactoring React components to ensure they handle server rendering, hydration mismatches, multiple instances, concurrent features, composition patterns, portals, view transitions, Activity API, data leaks, and cache semantics correctly.
license: MIT
metadata:
  author: Shu Ding
  version: "1.0.0"
---

# Bulletproof React Components

A guide for building React components that survive hostile real-world conditions: server rendering, hydration, concurrent rendering, multiple instances, portals, transitions, and more. Most components are built for the happy path — this skill teaches how to make them survive when someone else uses them in conditions you didn't plan for.

## When to Apply

Reference these guidelines when:
- Writing new React components that may run in SSR environments
- Building components that use browser APIs (localStorage, window, document)
- Creating provider components or context-based patterns
- Reviewing components for hydration mismatches or flicker
- Building components that may be used in portals or iframes
- Using React 19 features (ViewTransition, Activity, Server Components)
- Passing sensitive data between Server and Client Components

## Rule Categories

| Rule | Impact | File |
|------|--------|------|
| Make It Server-Proof | CRITICAL | `server-proof.md` |
| Make It Hydration-Proof | CRITICAL | `hydration-proof.md` |
| Make It Instance-Proof | HIGH | `instance-proof.md` |
| Make It Concurrent-Proof | HIGH | `concurrent-proof.md` |
| Make It Composition-Proof | HIGH | `composition-proof.md` |
| Make It Leak-Proof | HIGH | `leak-proof.md` |
| Make It Portal-Proof | MEDIUM | `portal-proof.md` |
| Make It Transition-Proof | MEDIUM | `transition-proof.md` |
| Make It Activity-Proof | MEDIUM | `activity-proof.md` |
| Make It Future-Proof | LOW | `future-proof.md` |

## Key Principles

1. **Defer browser APIs** — Never call `localStorage`, `window`, or `document` during render. Use `useEffect` or inline scripts.
2. **Avoid hydration flicker** — Inject synchronous scripts to set DOM state before React hydrates.
3. **Use `useId` for uniqueness** — Never hardcode element IDs in reusable components.
4. **Use `React.cache` for deduplication** — Wrap async calls in Server Components to avoid duplicate requests.
5. **Prefer context over cloneElement** — Context works with Server Components, lazy, and async children.
6. **Taint sensitive values** — Use `experimental_taintUniqueValue` to prevent tokens from leaking to the client.
7. **Use `ownerDocument.defaultView`** — Don't assume `window` is the correct global in portal/iframe contexts.
8. **Wrap state updates in `startTransition`** — Required for ViewTransition animations.
9. **Clean up DOM side effects** — Use `useLayoutEffect` to disable styles when Activity hides components.
10. **Use `useState` for semantic persistence** — `useMemo` is a performance hint, not a correctness guarantee.
