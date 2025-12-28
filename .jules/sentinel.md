## 2024-05-23 - Content Security Policy in Next.js
**Vulnerability:** Missing security headers (CSP, HSTS, etc.) can expose the application to XSS, clickjacking, and other attacks.
**Learning:** Implementing a strict CSP in a Next.js application requires careful configuration to allow necessary scripts and styles (often requiring 'unsafe-inline' and 'unsafe-eval' for development/compatibility) while still blocking external threats.
**Prevention:** Use `next.config.ts` headers configuration to inject security headers at the edge/server level. Always audit external domains (like YouTube, Vercel Blob) and add them to the CSP allowlist.
