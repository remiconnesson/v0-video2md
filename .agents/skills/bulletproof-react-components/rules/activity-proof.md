---
title: Make It Activity-Proof
impact: MEDIUM
impactDescription: prevents hidden components from leaking global DOM side effects
tags: activity, style, useLayoutEffect, dom-side-effects
---

## Make It Activity-Proof

Components that inject global styles via `<style>` tags have DOM-level side effects. When wrapped in `<Activity>`, the component's DOM is preserved even when hidden — but the styles still apply globally. React can't automatically clean up these side effects. Use `useLayoutEffect` to disable styles when hidden.

**Incorrect (styles leak when Activity hides component):**

```tsx
function DarkTheme({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        :root {
          --bg: #000;
          --fg: #fff;
        }
      `}</style>
      {children}
    </>
  )
}
```

When `<Activity>` hides this component, the dark theme CSS variables persist globally.

**Correct (styles disabled when hidden):**

```tsx
function DarkTheme({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLStyleElement>(null)

  useLayoutEffect(() => {
    if (!ref.current) return
    ref.current.media = 'all'
    return () => {
      if (ref.current) ref.current.media = 'not all'
    }
  }, [])

  return (
    <>
      <style ref={ref}>{`
        :root {
          --bg: #000;
          --fg: #fff;
        }
      `}</style>
      {children}
    </>
  )
}
```

`useLayoutEffect` sets `media='not all'` on cleanup, disabling the styles when Activity hides the component. When unhidden, the effect runs again and restores `media='all'`.
