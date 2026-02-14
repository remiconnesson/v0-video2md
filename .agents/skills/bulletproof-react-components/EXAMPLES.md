# Bulletproof React Components - Code Examples

All examples show before/after patterns. Copy the "after" version for your own code.

## 1. Server-Proof

### Before ❌
```typescript
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    localStorage.getItem('theme') || 'light'  // Crashes on server
  )
  return <div className={theme}>{children}</div>
}
```

### After ✅
```typescript
'use client'

import { useState, useEffect } from 'react'

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    setTheme(localStorage.getItem('theme') || 'light')
  }, [])

  return <div className={theme}>{children}</div>
}
```

---

## 2. Hydration-Proof

### Before ❌
```typescript
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    setTheme(localStorage.getItem('theme') || 'light')
    // Flash: server renders 'light', then switches to 'dark'
  }, [])

  return <div className={theme}>{children}</div>
}
```

### After ✅
```typescript
'use client'

import { useId } from 'react'

function ThemeProvider({ children }) {
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

---

## 3. Instance-Proof

### Before ❌
```typescript
function ThemeProvider({ children }) {
  return (
    <>
      <div id="theme">{children}</div>
      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('theme').className = 'dark'
      `}} />
    </>
  )
}

// Problem: multiple instances fight over same ID
function App() {
  return <>
    <ThemeProvider><MainApp /></ThemeProvider>
    <ThemeProvider><Sidebar /></ThemeProvider>
  </>
}
```

### After ✅
```typescript
'use client'

import { useId } from 'react'

function ThemeProvider({ children }) {
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

// ✅ Now safe to use multiple times
function App() {
  return <>
    <ThemeProvider><MainApp /></ThemeProvider>
    <ThemeProvider><Sidebar /></ThemeProvider>
  </>
}
```

---

## 4. Concurrent-Proof

### Before ❌
```typescript
// Server Component
async function Dashboard() {
  const prefs = await db.preferences.get(userId)
  // If this component renders twice, DB is hit twice
  return <div className={prefs.theme}>Content</div>
}
```

### After ✅
```typescript
import { cache } from 'react'

const getPreferences = cache(
  userId => db.preferences.get(userId)
)

async function Dashboard() {
  const prefs = await getPreferences(userId)
  // ✅ Same request = one DB hit, even if called multiple times
  return <div className={prefs.theme}>Content</div>
}
```

---

## 5. Composition-Proof

### Before ❌
```typescript
'use client'

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')

  return React.Children.map(children, (child) => {
    return React.cloneElement(child, { theme })
    // ❌ Breaks with Server Components, lazy components, promises
  })
}
```

### After ✅
```typescript
'use client'

import { createContext, useContext, useState } from 'react'

const ThemeContext = createContext<string>('light')

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')

  return (
    <ThemeContext.Provider value={theme}>
      {children}  // ✅ Works with any child type
    </ThemeContext.Provider>
  )
}

function MyComponent() {
  const theme = useContext(ThemeContext)
  return <div className={theme}>Content</div>
}
```

---

## 6. Portal-Proof

### Before ❌
```typescript
'use client'

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    const toggle = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'd') {
        e.preventDefault()
        setTheme(t => t === 'dark' ? 'light' : 'dark')
      }
    }
    window.addEventListener('keydown', toggle)
    // ❌ Doesn't work if rendered in portal/iframe
    return () => window.removeEventListener('keydown', toggle)
  }, [])

  return <div className={theme}>{children}</div>
}
```

### After ✅
```typescript
'use client'

import { useState, useEffect, useRef } from 'react'

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const win = ref.current?.ownerDocument.defaultView || window
    // ✅ Gets the correct window, even in portals/iframes

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

---

## 7. Transition-Proof

### Before ❌
```typescript
'use client'

function ThemeSettings() {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <>
      {showAdvanced ? <AdvancedPanel /> : <SimplePanel />}
      <button onClick={() => setShowAdvanced(!showAdvanced)}>
        {showAdvanced ? 'Simple' : 'Advanced'}
      </button>
      {/* ❌ Inside ViewTransition but no animation plays */}
    </>
  )
}
```

### After ✅
```typescript
'use client'

import { useState, startTransition } from 'react'

function ThemeSettings() {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <>
      {showAdvanced ? <AdvancedPanel /> : <SimplePanel />}
      <button onClick={() =>
        startTransition(() => setShowAdvanced(!showAdvanced))
        // ✅ Transition animates smoothly
      }>
        {showAdvanced ? 'Simple' : 'Advanced'}
      </button>
    </>
  )
}
```

---

## 8. Activity-Proof

### Before ❌
```typescript
'use client'

function DarkTheme({ children }) {
  return (
    <>
      <style>{`
        :root {
          --bg: #000;
          --fg: #fff;
        }
      `}</style>
      {children}
      {/* ❌ Inside Activity, style persists when hidden */}
    </>
  )
}
```

### After ✅
```typescript
'use client'

import { useRef, useLayoutEffect } from 'react'

function DarkTheme({ children }) {
  const ref = useRef<HTMLStyleElement>(null)

  useLayoutEffect(() => {
    if (!ref.current) return
    ref.current.media = 'all'  // Show when active
    return () => ref.current.media = 'not all'  // Hide when inactive
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

---

## 9. Leak-Proof

### Before ❌
```typescript
// Server Component
async function Dashboard() {
  const user = await getUser()  // Has { id, name, token: 'secret' }

  return <UserThemeConfig user={user} />
  // ❌ UserThemeConfig might serialize user to client
  // ❌ Token leaks in HTML
}
```

### After ✅
```typescript
import { experimental_taintUniqueValue } from 'react'

async function Dashboard() {
  const user = await getUser()

  experimental_taintUniqueValue(
    'Do not pass user token to client',
    user,
    user.token  // ✅ React throws if this reaches Client Component
  )

  return <UserThemeConfig user={user} />
}

// Alternative: taint entire object
import { experimental_taintObjectReference } from 'react'

async function Dashboard() {
  const user = await getUser()

  experimental_taintObjectReference(
    'Do not pass user object to client',
    user
  )

  return <UserThemeConfig user={user} />
}
```

---

## 10. Future-Proof

### Before ❌
```typescript
'use client'

function ThemeProvider({ baseTheme, children }) {
  const colors = useMemo(
    () => generateAccentColors(baseTheme),
    [baseTheme]
  )
  // ❌ useMemo can be discarded during HMR or React optimization
  // ❌ Colors flicker when cache is cleared

  return <div style={colors}>{children}</div>
}
```

### After ✅
```typescript
'use client'

import { useState } from 'react'

function ThemeProvider({ baseTheme, children }) {
  const [colors, setColors] = useState(() =>
    generateAccentColors(baseTheme)
  )
  const [prevBaseTheme, setPrevBaseTheme] = useState(baseTheme)

  // Manual dependency tracking
  if (baseTheme !== prevBaseTheme) {
    setPrevBaseTheme(baseTheme)
    setColors(generateAccentColors(baseTheme))
  }
  // ✅ useState provides semantic persistence guarantee

  return <div style={colors}>{children}</div>
}
```

---

## Real-World Example: Bulletproof Theme Provider

A complete example combining multiple patterns:

```typescript
'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useId,
  startTransition,
  useLayoutEffect,
} from 'react'

const ThemeContext = createContext<{
  theme: string
  setTheme: (theme: string) => void
}>({ theme: 'light', setTheme: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState('light')

  // 1. Hydration-Proof: Inline script before paint
  // 2. Instance-Proof: useId generates unique ID
  // 3. Server-Proof: No browser APIs at render time

  // 4. Portal-Proof: Keyboard shortcut in correct window
  useEffect(() => {
    const win = ref.current?.ownerDocument.defaultView || window
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'd') {
        e.preventDefault()
        startTransition(() => {
          setTheme(t => t === 'dark' ? 'light' : 'dark')
        })
      }
    }
    win.addEventListener('keydown', handleKeydown)
    return () => win.removeEventListener('keydown', handleKeydown)
  }, [])

  // 5. Activity-Proof: Clean up global style when hidden
  const styleRef = useRef<HTMLStyleElement>(null)
  useLayoutEffect(() => {
    if (!styleRef.current) return
    styleRef.current.media = 'all'
    return () => {
      styleRef.current!.media = 'not all'
    }
  }, [])

  return (
    <>
      <div id={id} ref={ref}>
        {/* 6. Composition-Proof: Use context, not cloneElement */}
        <ThemeContext.Provider value={{ theme, setTheme }}>
          {children}
        </ThemeContext.Provider>
      </div>

      {/* Global theme styles */}
      <style ref={styleRef} dangerouslySetInnerHTML={{
        __html: `
          html {
            --bg: ${theme === 'dark' ? '#000' : '#fff'};
            --fg: ${theme === 'dark' ? '#fff' : '#000'};
          }
        `
      }} />

      {/* Hydration script */}
      <script dangerouslySetInnerHTML={{
        __html: `
          try {
            const theme = localStorage.getItem('theme') || 'light'
            document.getElementById('${id}').dataset.theme = theme
          } catch (e) {}
        `
      }} />
    </>
  )
}

// Consumer hook
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be inside ThemeProvider')
  }
  return context
}
```

---

## Quick Copy-Paste Checklist

- [ ] `'use client'` at top of client components
- [ ] Browser APIs in `useEffect` only
- [ ] `useId()` for all element IDs
- [ ] `React.cache()` for Server Component fetches
- [ ] Context for passing data, not cloneElement
- [ ] `ownerDocument.defaultView` for global listeners
- [ ] `startTransition()` for state in transitions
- [ ] `useLayoutEffect` to toggle CSS media
- [ ] `experimental_taintUniqueValue()` for sensitive data
- [ ] `useState` for persistent computed values, not `useMemo`
