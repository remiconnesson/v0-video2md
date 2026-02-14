---
title: Make It Future-Proof
impact: LOW
impactDescription: ensures correctness is not dependent on React's internal cache behavior
tags: useMemo, useState, persistence, correctness, cache
---

## Make It Future-Proof

*This is a concept to understand: be defensive. It is not a pattern to apply everywhere.*

`useMemo` is a performance hint, not a semantic guarantee. React may discard cached values during HMR, and reserves the right to do so for offscreen components or future features. If correctness depends on a value persisting across renders, use `useState` instead.

**Incorrect (correctness depends on useMemo cache):**

```tsx
function ThemeProvider({ baseTheme, children }: {
  baseTheme: string
  children: ReactNode
}) {
  const colors = useMemo(
    () => getRandomColors(baseTheme),
    [baseTheme]
  )

  return <div style={colors}>{children}</div>
}
```

If React discards the `useMemo` cache, random colors regenerate and the theme flickers to different colors.

**Correct (useState provides semantic persistence):**

```tsx
function ThemeProvider({ baseTheme, children }: {
  baseTheme: string
  children: ReactNode
}) {
  const [colors, setColors] = useState(() => generateAccentColors(baseTheme))
  const [prevTheme, setPrevTheme] = useState(baseTheme)

  if (baseTheme !== prevTheme) {
    setPrevTheme(baseTheme)
    setColors(generateAccentColors(baseTheme))
  }

  return <div style={colors}>{children}</div>
}
```

`useState` guarantees the value persists across renders. The "derived state from props" pattern re-generates colors only when `baseTheme` actually changes, regardless of React's internal optimizations.
