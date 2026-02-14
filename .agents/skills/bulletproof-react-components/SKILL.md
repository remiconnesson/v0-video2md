---
name: bulletproof-react-components
description: Build production-ready React components that handle server rendering, hydration, concurrent features, and edge cases. Use when creating robust components for Next.js/RSC, fixing component bugs related to SSR or hydration, or designing component APIs that need to survive real-world conditions.
---

# Bulletproof React Components

Build components that work everywhere: server rendering, hydration, multiple instances, concurrent rendering, portals, transitions, and more. The patterns here ensure your component survives when moved to different contexts or used in ways you didn't plan for.

## The 10 Bulletproofing Patterns

1. **Server-Proof** - Safe browser API usage
2. **Hydration-Proof** - No flash/mismatches
3. **Instance-Proof** - Multiple instances coexist
4. **Concurrent-Proof** - Works with RSC & caching
5. **Composition-Proof** - Context over cloneElement
6. **Portal-Proof** - Correct window context
7. **Transition-Proof** - Smooth view transitions
8. **Activity-Proof** - Hidden state cleanup
9. **Leak-Proof** - No sensitive data to client
10. **Future-Proof** - Correct persistence guarantees

## Quick Start: Making a Component Bulletproof

Check these patterns in order when building or debugging:

```
[ ] Browser APIs inside useEffect only (Server-Proof)
[ ] No hydration mismatch: use useId + inline script (Hydration-Proof)
[ ] Global state uses unique IDs (Instance-Proof)
[ ] Data fetching with React.cache() (Concurrent-Proof)
[ ] Passing data via Context, not cloneElement (Composition-Proof)
[ ] Window listeners use ownerDocument.defaultView (Portal-Proof)
[ ] State changes wrapped in startTransition (Transition-Proof)
[ ] CSS side effects toggled with useLayoutEffect (Activity-Proof)
[ ] Sensitive data marked with taintUniqueValue (Leak-Proof)
[ ] Persistent values in useState, not useMemo (Future-Proof)
```

## Common Workflows

### Fixing Hydration Flashes

**Problem**: Server renders one thing, client renders another. User sees flash.

**Solution**:
1. Move browser API logic to useEffect
2. Add inline script that runs before paint
3. Use useId for unique DOM references
4. Return same initial render state

See [EXAMPLES.md](EXAMPLES.md#hydration-proof) for code.

### Adding Global Shortcuts

**Problem**: Keyboard listeners don't work in portals/iframes.

**Solution**:
1. Store ref to component's DOM element
2. Get correct window via `element.ownerDocument.defaultView`
3. Attach listener to that window
4. Cleanup listener on unmount

See [EXAMPLES.md](EXAMPLES.md#portal-proof) for code.

### Passing Data Through Component Trees

**Problem**: cloneElement breaks with Server Components, Lazy, "use cache".

**Solution**:
1. Create Context for the data
2. Provider wraps children
3. Consumers use useContext
4. No prop drilling, works everywhere

See [EXAMPLES.md](EXAMPLES.md#composition-proof) for code.

### Preventing Data Leaks to Client

**Problem**: You pass sensitive data (tokens) to another component. You don't control what it does with it.

**Solution**:
1. Use `experimental_taintUniqueValue()` on sensitive values
2. React throws if value reaches a Client Component
3. Protects against future refactors

See [EXAMPLES.md](EXAMPLES.md#leak-proof) for code.

## Decision Tree

**"Does my component need this pattern?"**

| Question | Pattern | Action |
|----------|---------|--------|
| Uses `localStorage`, `document`, `window`? | Server-Proof | Move to useEffect |
| Renders server + client with async data? | Hydration-Proof | Add inline script + useId |
| Used multiple times with global state? | Instance-Proof | Use useId for all IDs |
| Fetches data in Server Component? | Concurrent-Proof | Wrap with React.cache() |
| Passes data to unknown children? | Composition-Proof | Use Context instead |
| Attaches global listeners? | Portal-Proof | Use ownerDocument.defaultView |
| Shows/hides with `<ViewTransition>`? | Transition-Proof | Use startTransition |
| Injects global CSS? | Activity-Proof | Toggle media with useLayoutEffect |
| Passes server secrets? | Leak-Proof | Use taintUniqueValue |
| Needs stable computed values? | Future-Proof | Use useState, not useMemo |

## Tips

- **Start with Server-Proof and Hydration-Proof** - these are most common
- **Context is your friend** - it works in Server Components, portals, async trees
- **useId solves instance problems** - unique per component instance, stable across renders
- **useState > useMemo for correctness** - useMemo is a hint, useState is a guarantee
- **Defensive programming pays off** - these patterns prevent bugs from hidden contexts

For detailed explanations and all patterns, see [REFERENCE.md](REFERENCE.md).
