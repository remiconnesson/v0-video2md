---
title: Make It Instance-Proof
impact: HIGH
impactDescription: prevents conflicts when multiple instances of a component coexist
tags: useId, instances, id, uniqueness
---

## Make It Instance-Proof

The hydration-proof version targets a hardcoded `id="theme"`. If someone uses two instances, both scripts fight over the same element. Use `useId` to generate stable, unique IDs per instance.

**Incorrect (hardcoded ID — multiple instances conflict):**

```tsx
function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <div id="theme">{children}</div>
      <script dangerouslySetInnerHTML={{ __html: `
        try {
          const theme = localStorage.getItem('theme') || 'light'
          document.getElementById('theme').className = theme
        } catch (e) {}
      `}} />
    </>
  )
}
```

Two `<ThemeProvider>` instances both target `id="theme"` — the second overwrites the first.

**Correct (unique ID per instance):**

```tsx
function ThemeProvider({ children }: { children: ReactNode }) {
  const id = useId()
  return (
    <>
      <div id={id}>{children}</div>
      <script dangerouslySetInnerHTML={{ __html: `
        try {
          const theme = localStorage.getItem('theme') || 'light'
          document.getElementById('${id}').className = theme
        } catch (e) {}
      `}} />
    </>
  )
}
```

`useId` generates a stable, unique ID per component instance that is consistent between server and client. Multiple instances coexist safely.
