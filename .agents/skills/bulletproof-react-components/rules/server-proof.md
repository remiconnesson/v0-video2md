---
title: Make It Server-Proof
impact: CRITICAL
impactDescription: prevents SSR crashes from browser API access during render
tags: ssr, server, localStorage, window, useEffect
---

## Make It Server-Proof

Browser APIs like `localStorage`, `window`, and `document` don't exist on the server. Components that access them during render crash SSR builds. Move browser API access into `useEffect`.

**Incorrect (crashes in SSR):**

```tsx
function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState(
    localStorage.getItem('theme') || 'light'
  )

  return <div className={theme}>{children}</div>
}
```

`localStorage` is not available on the server — this crashes the build in Next.js, Remix, or any SSR framework.

**Correct (defers to client):**

```tsx
function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    setTheme(localStorage.getItem('theme') || 'light')
  }, [])

  return <div className={theme}>{children}</div>
}
```

`useEffect` only runs on the client, so the server renders safely with the default value.
