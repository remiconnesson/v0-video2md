---
title: Make It Composition-Proof
impact: HIGH
impactDescription: ensures data passing works with Server Components, lazy, and async children
tags: context, cloneElement, composition, server-components, lazy
---

## Make It Composition-Proof

Traditionally, `React.cloneElement` was used to pass data to children. But with Server Components, `React.lazy`, or `"use cache"`, `children` might be a Promise or an opaque reference — `cloneElement` won't work. Use context instead.

**Incorrect (breaks with Server Components and lazy):**

```tsx
function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState('light')

  return React.Children.map(children, (child) => {
    return React.cloneElement(child as ReactElement, { theme })
  })
}
```

`cloneElement` fails when children are Promises (Server Components), lazy-loaded, or opaque references.

**Correct (context works everywhere):**

```tsx
const ThemeContext = createContext('light')

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState('light')

  return (
    <ThemeContext value={theme}>
      {children}
    </ThemeContext>
  )
}
```

Children read the theme through `useContext` — no prop drilling, no cloning. Context works with Server Components, lazy, and async children.
