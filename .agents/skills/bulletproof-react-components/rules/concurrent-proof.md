---
title: Make It Concurrent-Proof
impact: HIGH
impactDescription: deduplicates async calls in Server Components to avoid redundant work
tags: server-components, cache, concurrent, deduplication, async
---

## Make It Concurrent-Proof

A Server Component that fetches data may be rendered in multiple places, causing duplicate database queries. Wrap the query in `React.cache` to deduplicate within a single request.

**Incorrect (duplicate queries):**

```tsx
async function ThemeProvider({ children }: { children: ReactNode }) {
  const prefs = await db.preferences.get(userId)

  return <div className={prefs.theme}>{children}</div>
}
```

Rendering this component in two places triggers two identical database queries.

**Correct (deduplicated with React.cache):**

```tsx
import { cache } from 'react'

const getPreferences = cache(
  (userId: string) => db.preferences.get(userId)
)

async function ThemeProvider({ children }: { children: ReactNode }) {
  const prefs = await getPreferences(userId)

  return <div className={prefs.theme}>{children}</div>
}
```

`React.cache` deduplicates concurrent calls with the same arguments within a single server request. Same query, called from anywhere, hits the database once.
