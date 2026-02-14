---
title: Make It Portal-Proof
impact: MEDIUM
impactDescription: ensures event listeners work in portals, iframes, and pop-out windows
tags: portal, iframe, window, ownerDocument, event-listeners
---

## Make It Portal-Proof

Components that attach global event listeners to `window` break when rendered inside a portal, iframe, or pop-out window. The listener is attached to the parent `window`, not the one the component lives in. Use `ownerDocument.defaultView` to find the correct window.

**Incorrect (breaks in portals/iframes):**

```tsx
function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    const toggle = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'd') {
        e.preventDefault()
        setTheme(t => t === 'dark' ? 'light' : 'dark')
      }
    }
    window.addEventListener('keydown', toggle)
    return () => window.removeEventListener('keydown', toggle)
  }, [])

  return <div className={theme}>{children}</div>
}
```

The listener is on the parent `window` — in a portal or iframe, keyboard events won't reach it.

**Correct (uses the component's own window):**

```tsx
function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState('light')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const win = ref.current?.ownerDocument.defaultView || window
    const toggle = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'd') {
        e.preventDefault()
        setTheme(t => t === 'dark' ? 'light' : 'dark')
      }
    }
    win.addEventListener('keydown', toggle)
    return () => win.removeEventListener('keydown', toggle)
  }, [])

  return <div ref={ref} className={theme}>{children}</div>
}
```

`ownerDocument.defaultView` resolves to the correct window for the DOM node, regardless of portals, iframes, or pop-out windows.
