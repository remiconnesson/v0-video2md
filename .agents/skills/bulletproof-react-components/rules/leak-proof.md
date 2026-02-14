---
title: Make It Leak-Proof
impact: HIGH
impactDescription: prevents sensitive server-side data from being serialized to the client
tags: security, taint, server-components, token, serialization
---

## Make It Leak-Proof

Server Components can pass data to other components, but you don't control what those components do with it. A `user` object with a session token might get passed to a Client Component somewhere in the tree, causing the token to be serialized and sent to the client. Use React's `experimental_taintUniqueValue` to mark sensitive values as server-only.

**Incorrect (token may leak to client):**

```tsx
async function Dashboard() {
  const user = await getUser()

  return <UserThemeConfig user={user} />
}
```

You don't control `UserThemeConfig` — it might pass `user.token` to a Client Component, serializing it to the browser.

**Correct (tainted value throws if sent to client):**

```tsx
import { experimental_taintUniqueValue } from 'react'

async function Dashboard() {
  const user = await getUser()

  experimental_taintUniqueValue(
    'Do not pass the user token to the client.',
    user,
    user.token
  )

  return <UserThemeConfig user={user} />
}
```

If any component in the tree tries to pass `user.token` to a Client Component, React throws with your error message. The valid server-side use stays; the token never leaks. To block an entire object, use `experimental_taintObjectReference` instead.
