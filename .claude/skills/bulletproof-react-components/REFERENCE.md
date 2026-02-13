# Bulletproof React Components - Detailed Reference

## 1. Server-Proof: Safe Browser API Usage

**Why it matters**: Browser APIs (`localStorage`, `window`, `document`) don't exist on the server. Your SSR build crashes if you use them at render time.

**The Problem**:
```javascript
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    localStorage.getItem('theme') || 'light'  // ❌ Crashes on server
  )
  return <div className={theme}>{children}</div>
}
```

**The Solution**: Move all browser APIs into `useEffect`. On the server, render a safe default. On the client, `useEffect` updates with real data.

```javascript
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')  // ✅ Safe default

  useEffect(() => {
    setTheme(localStorage.getItem('theme') || 'light')  // ✅ Client-side only
  }, [])

  return <div className={theme}>{children}</div>
}
```

**Key Rule**: Browser APIs only in `useEffect`, event handlers, or client-only components.

---

## 2. Hydration-Proof: Prevent Flash/Mismatch

**Why it matters**: Server renders one HTML, client hydrates and changes it = flash. User sees theme switch, text reflow, or wrong content for a moment.

**The Problem**:
```javascript
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    setTheme(localStorage.getItem('theme') || 'light')
    // ❌ Server renders 'light', useEffect runs, switches to 'dark' = flash
  }, [])

  return <div className={theme}>{children}</div>
}
```

**The Solution**: Run JavaScript inline (in `<script>`) before the browser paints. Set the correct value before React hydrates.

```javascript
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

**How it works**:
1. Server renders `<div id="r0">` with no class
2. Browser receives HTML
3. Inline script runs immediately, adds correct class
4. Browser paints with correct theme
5. React hydrates to matching HTML

**Key Rule**: Sync the initial HTML state with client-side persistence before React renders.

---

## 3. Instance-Proof: Handle Multiple Instances

**Why it matters**: If someone uses your component twice, hardcoded IDs cause conflicts.

**The Problem**:
```javascript
function ThemeProvider({ children }) {
  return (
    <>
      <div id="theme">{children}</div>  // ❌ Both instances target same ID
      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('theme').className = 'dark'
      `}} />
    </>
  )
}

// Two providers fight over the same element
function App() {
  return <>
    <ThemeProvider><MainApp /></ThemeProvider>
    <ThemeProvider><Sidebar /></ThemeProvider>
  </>
}
```

**The Solution**: Use `useId()` to generate unique IDs per instance.

```javascript
function ThemeProvider({ children }) {
  const id = useId()  // ✅ Unique per instance

  return (
    <>
      <div id={id}>{children}</div>
      <script dangerouslySetInnerHTML={{ __html: `
        const theme = localStorage.getItem('theme') || 'light'
        document.getElementById('${id}').className = theme
      `}} />
    </>
  )
}
```

**Key Rule**: Never hardcode IDs. Use `useId()` for all element references.

---

## 4. Concurrent-Proof: Works with RSC & Request Caching

**Why it matters**: With Server Components and concurrent rendering, the same data fetching function can be called multiple times. Deduplicate with `React.cache()`.

**The Problem**:
```javascript
async function ThemeProvider({ children }) {
  const prefs = await db.preferences.get(userId)
  // ❌ If rendered twice, hits database twice
  return <div className={prefs.theme}>{children}</div>
}
```

**The Solution**: Wrap data fetching with `React.cache()` to deduplicate per request.

```javascript
import { cache } from 'react'

const getPreferences = cache(
  userId => db.preferences.get(userId)
)

async function ThemeProvider({ children }) {
  const prefs = await getPreferences(userId)
  // ✅ Same userId, same request = one database call
  return <div className={prefs.theme}>{children}</div>
}
```

**How it works**:
- First call: hits database, caches result
- Subsequent calls with same args in same request: return cached result
- New request: cache resets

**Key Rule**: Wrap Server Component data fetching in `React.cache()` to deduplicate.

---

## 5. Composition-Proof: Context Over cloneElement

**Why it matters**: `React.cloneElement` breaks with Server Components, `React.lazy`, and `"use cache"`. Children might be Promises or opaque references.

**The Problem**:
```javascript
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')

  return React.Children.map(children, (child) => {
    return React.cloneElement(child, { theme })
    // ❌ Breaks with RSC, Lazy, promises
  })
}
```

**The Solution**: Use Context. Works everywhere: Server Components, Client Components, Lazy, portals, async trees.

```javascript
const ThemeContext = createContext('light')

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')

  return (
    <ThemeContext.Provider value={theme}>
      {children}  // ✅ Works everywhere
    </ThemeContext.Provider>
  )
}

// Consumer uses useContext
function MyComponent() {
  const theme = useContext(ThemeContext)
  return <div className={theme}>Content</div>
}
```

**Key Rule**: Pass data via Context, never via cloneElement. No prop drilling needed.

---

## 6. Portal-Proof: Correct Window Context

**Why it matters**: Global listeners (keyboard shortcuts, resize) attach to `window`. But if your component renders in a popup, iframe, or portal, it's a different `window`. Listeners stop working.

**The Problem**:
```javascript
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    const toggle = (e) => {
      if (e.metaKey && e.key === 'd') {
        setTheme(t => t === 'dark' ? 'light' : 'dark')
      }
    }
    window.addEventListener('keydown', toggle)
    // ❌ Listener on parent window, not component's window
    return () => window.removeEventListener('keydown', toggle)
  }, [])

  return <div className={theme}>{children}</div>
}
```

**The Solution**: Use `ownerDocument.defaultView` to find the correct window.

```javascript
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')
  const ref = useRef(null)

  useEffect(() => {
    const win = ref.current?.ownerDocument.defaultView || window
    // ✅ Finds component's actual window, even in portal

    const toggle = (e) => {
      if (e.metaKey && e.key === 'd') {
        setTheme(t => t === 'dark' ? 'light' : 'dark')
      }
    }

    win.addEventListener('keydown', toggle)
    return () => win.removeEventListener('keydown', toggle)
  }, [])

  return <div ref={ref} className={theme}>{children}</div>
}
```

**Key Rule**: For global listeners, find the correct window with `element.ownerDocument.defaultView || window`.

---

## 7. Transition-Proof: Smooth View Transitions

**Why it matters**: React 19's `<ViewTransition>` enables CSS view transitions. But if state updates don't use `startTransition`, animations won't play.

**The Problem**:
```javascript
function ThemeSettings() {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <>
      {showAdvanced ? <AdvancedPanel /> : <SimplePanel />}
      <button onClick={() => setShowAdvanced(!showAdvanced)}>
        {showAdvanced ? 'Simple' : 'Advanced'}
      </button>
      {/* ❌ Inside ViewTransition, but no animation plays */}
    </>
  )
}
```

**The Solution**: Wrap state changes in `startTransition`.

```javascript
import { startTransition } from 'react'

function ThemeSettings() {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <>
      {showAdvanced ? <AdvancedPanel /> : <SimplePanel />}
      <button onClick={() =>
        startTransition(() => setShowAdvanced(!showAdvanced))
        // ✅ Tells React this is a transition
      }>
        {showAdvanced ? 'Simple' : 'Advanced'}
      </button>
    </>
  )
}
```

**Key Rule**: For smooth view transitions, wrap state updates in `startTransition()`.

---

## 8. Activity-Proof: Clean Up CSS Side Effects

**Why it matters**: React's `<Activity>` component preserves DOM when hidden. If your component injects global CSS, it persists even when hidden. Need to clean up.

**The Problem**:
```javascript
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
      {/* ❌ Inside <Activity>, style stays active when hidden */}
    </>
  )
}
```

**The Solution**: Use `useLayoutEffect` to toggle the style's media query.

```javascript
function DarkTheme({ children }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    if (!ref.current) return
    ref.current.media = 'all'  // Show when active
    return () => ref.current.media = 'not all'  // Hide when hidden
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

**How it works**:
- `media="all"` applies styles
- `media="not all"` hides them (but keeps DOM)
- useLayoutEffect runs before paint, ensuring sync cleanup

**Key Rule**: For injected styles, toggle `media` attribute with useLayoutEffect.

---

## 9. Leak-Proof: Prevent Sensitive Data Leaks

**Why it matters**: You pass a server object (with session tokens) to another component you don't control. That component might serialize it to the client, leaking the token.

**The Problem**:
```javascript
async function Dashboard() {
  const user = await getUser()  // Has { token: 'secret' }

  return <UserThemeConfig user={user} />
  // ❌ UserThemeConfig might pass user to a Client Component
  // ❌ Token gets serialized and sent to browser
}
```

**The Solution**: Mark sensitive values with `experimental_taintUniqueValue()` or entire objects with `experimental_taintObjectReference()`.

```javascript
import { experimental_taintUniqueValue } from 'react'

async function Dashboard() {
  const user = await getUser()

  experimental_taintUniqueValue(
    'Do not pass the user token to the client.',
    user,
    user.token  // ✅ If token reaches Client Component, React throws
  )

  return <UserThemeConfig user={user} />
}
```

**How it works**:
- Marks the token as server-only
- If any component tries to pass it to client, React throws
- Catches leaks during development, protects against future refactors

**Alternative** (taint entire object):
```javascript
import { experimental_taintObjectReference } from 'react'

experimental_taintObjectReference(
  'Do not pass user object to client',
  user
)
```

**Key Rule**: Mark sensitive values/objects with `taint*` to catch client leaks early.

---

## 10. Future-Proof: Correct Persistence Guarantees

**Why it matters**: `useMemo` is a performance hint, not a contract. React can discard cached values during HMR, concurrent rendering, or future optimizations. If your logic depends on persistence, use `useState`.

**The Problem**:
```javascript
function ThemeProvider({ baseTheme, children }) {
  const colors = useMemo(
    () => generateRandomColors(baseTheme),
    [baseTheme]
  )
  // ❌ useMemo discards cache during HMR or React optimizations
  // ❌ Theme colors flicker if cache is discarded

  return <div style={colors}>{children}</div>
}
```

**The Solution**: Use `useState` when correctness depends on persistence.

```javascript
function ThemeProvider({ baseTheme, children }) {
  const [colors, setColors] = useState(() =>
    generateRandomColors(baseTheme)
  )
  const [prevTheme, setPrevTheme] = useState(baseTheme)

  if (baseTheme !== prevTheme) {
    setPrevTheme(baseTheme)
    setColors(generateRandomColors(baseTheme))
  }
  // ✅ useState provides semantic persistence guarantee

  return <div style={colors}>{children}</div>
}
```

**How it works**:
- `useState` with initializer runs once
- Manual dependency tracking with `prevTheme`
- If baseTheme changes, update both state variables
- Colors stay stable across renders and HMR

**When to use each**:
- **useMemo**: Pure computation, nice-to-have optimization, not required for correctness
- **useState**: Computed value must persist across renders, HMR, React optimizations

**Key Rule**: useMemo is optional, useState is required. Use useState when persistence matters.

---

## Summary: All 10 Patterns

| Pattern | When | How |
|---------|------|-----|
| Server-Proof | Using browser APIs | Move to useEffect |
| Hydration-Proof | SSR + client persistence | Inline script + useId |
| Instance-Proof | Global state/IDs | Use useId() |
| Concurrent-Proof | RSC data fetching | React.cache() wrapper |
| Composition-Proof | Passing data down | Context instead of cloneElement |
| Portal-Proof | Global listeners | ownerDocument.defaultView |
| Transition-Proof | Smooth UI transitions | startTransition() |
| Activity-Proof | Injected CSS | useLayoutEffect media toggle |
| Leak-Proof | Server-only data | experimental_taintUniqueValue |
| Future-Proof | Computed persistence | useState, not useMemo |

---

## Decision Framework

Ask these questions in order:

1. **Does it use browser APIs?** → Server-Proof
2. **Server + client rendering conflict?** → Hydration-Proof
3. **Multiple instances with global state?** → Instance-Proof
4. **Server Component with repeated fetches?** → Concurrent-Proof
5. **Passing data through tree?** → Composition-Proof
6. **Global event listeners?** → Portal-Proof
7. **Using ViewTransition?** → Transition-Proof
8. **Injecting global CSS?** → Activity-Proof
9. **Passing sensitive data?** → Leak-Proof
10. **Computed value that must persist?** → Future-Proof

Most components need 2-3 of these patterns. Start with Server-Proof and Hydration-Proof—they're foundational.
