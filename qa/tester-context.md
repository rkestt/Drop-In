# Tester context — Drop-In

- Stack: Next.js 15 App Router, React 19, TypeScript, Tailwind v4
- Backend: DOM/CDP via agent-browser (Chromium). Dev server http://localhost:3002.
- Discovered: 2026-11-05
- Notes: No test framework configured for E2E; agent-browser session. MapLibre canvas renders on home (/). Profile route requires auth (redirects to /?login=required).