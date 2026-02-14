---
title: Make It Hydration-Proof
impact: CRITICAL
impactDescription: eliminates flash of wrong content between SSR and hydration
tags: hydration, ssr, flicker, script, localStorage
---

## Make It Hydration-Proof

The server-safe version avoids crashes, but users see a flash. The server renders `light`, the client hydrates, then the effect runs and switches to `dark`. Inject a synchronous inline script that sets the correct value before the browser paints and React hydrates.

**Incorrect (flash of wrong theme):**

```tsx
function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    setTheme(localStorage.getItem('theme') || 'light')
  }, [])

  return <div className={theme}>{children}</div>
}
```

The component first renders with `light`, then updates after hydration, causing a visible flash.

**Correct (no mismatch, no flash):**

```tsx
function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <div id="theme" suppressHydrationWarning>{children}</div>
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

The inline script executes synchronously before the browser paints, setting the class before React hydrates. The `suppressHydrationWarning` prop tells React to expect the DOM to differ from the server HTML for this element, preventing hydration mismatch warnings.

**Alternative (mutate element outside React tree):**

```tsx
function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: `
        try {
          const theme = localStorage.getItem('theme') || 'light'
          document.documentElement.classList.add(theme)
        } catch (e) {}
      `}} />
      <div>{children}</div>
    </>
  )
}
```

This alternative mutates `document.documentElement` (the `<html>` element), which is not part of the React-controlled tree, avoiding hydration concerns entirely.
