# YouTube Transcript Fetching - Issue Log

## The Goal
Replace the binary-dependent `yt-dlp` with a pure JavaScript solution (`YouTube.js`) and ensure it works through a Zyte proxy, handling TLS verification issues common with residential proxies.

## The Journey

### 1. Switching to YouTube.js
- **Attempted:** Replaced `youtube-dl-exec` with `youtubei.js`.
- **Reasoning:** `yt-dlp` requires binaries which were causing environment issues in Vercel. `youtubei.js` is a pure JS client for InnerTube.
- **Outcome:** Successfully implemented the library, but encountered initial 407 and 403 errors when using the Zyte proxy.

### 2. Fixing Proxy Authentication (407 Error)
- **Attempted:** Switched from `uri: http://user:pass@host:port` to explicit `token` property in `undici.ProxyAgent`.
- **Reasoning:** `undici`'s `ProxyAgent` sometimes fails to extract credentials correctly from the URI when performing HTTP Tunneling (CONNECT).
- **Outcome:** Resolved the 407 Proxy Authentication Required error.

### 3. Handling TLS Verification (UNABLE_TO_VERIFY_LEAF_SIGNATURE)
- **Attempted:** Passed `connect: { rejectUnauthorized: false }` to `undici.fetch`.
- **Reasoning:** Zyte proxies often intercept traffic, presenting their own certificates which Node.js doesn't trust by default.
- **Outcome:** **FAILED** in production. The `connect` option in `fetch` is ignored when a `dispatcher` (like `ProxyAgent`) is provided. The error persists.

### 4. Handling GET/HEAD request bodies
- **Attempted:** Manually deleted `body` from `fetchInit` if method is GET or HEAD.
- **Reasoning:** `youtubei.js` sometimes passes a body in its internal requests which `undici.fetch` rejects for GET requests.
- **Outcome:** Resolved "Request with GET/HEAD method cannot have body" error.

## Current Blocker
The `UNABLE_TO_VERIFY_LEAF_SIGNATURE` error still occurs in production despite passing `connect: { rejectUnauthorized: false }` to both `ProxyAgent` (via `factory`) and `undiFetch`. The error occurs during `Innertube.create`, which suggests that some initialization requests might still be enforcing TLS or the configuration is not being propagated correctly through the proxy.

### Experiment 5: Using `ProxyAgent` factory for TLS bypass
- **Attempted:** Configured `ProxyAgent` with a `factory` that creates `Client` instances with `rejectUnauthorized: false`.
- **Reasoning:** `ProxyAgent` manages the lifecycle of `Client` objects for target origins. Overriding the factory ensures every new client created for a target origin (like `youtube.com`) has the TLS bypass setting.
- **Outcome:** **FAILED** in production. The `UNABLE_TO_VERIFY_LEAF_SIGNATURE` error persisted.

### Experiment 6: Scoped `NODE_TLS_REJECT_UNAUTHORIZED = '0'`
- **Attempted:** Set the global Node.js environment variable `NODE_TLS_REJECT_UNAUTHORIZED = '0'` just before calling `Innertube.create` and restored it after.
- **Reasoning:** Despite passing explicit TLS bypass options to `undici` and `ProxyAgent`, the production environment (possibly due to how Next.js/Vercel bundles and executes requests) continued to throw `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. This global flag is the "nuclear option" to ensure that any request in the process, including those hidden deep within libraries or initialization phases, bypasses TLS verification when a proxy is involved.
- **Outcome:** **SUCCESS** (Pending production verification). This is the most robust way to handle misbehaving or intercepted TLS chains in Node.js.
