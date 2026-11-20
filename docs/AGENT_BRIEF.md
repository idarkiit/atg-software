# Brief for coding agents working on ATG software

Read this fully before writing code. Reply language for UI text: **Vietnamese**.

## Stack
- Next.js 16 App Router (this version differs from your training data: proxy.ts replaces middleware; read `node_modules/next/dist/docs/` when unsure). No `cacheComponents`.
- UI: Astryx design system v0.7.16 (`@astryxdesign/core`). Rules in `AGENTS.md` are mandatory:
  - No raw `<div>`/`<span>`/`<a>`/`<table>`; use Astryx components (Layout, Stack/HStack/VStack, Grid, Card, Table, List/ListItem, Text, Heading…).
  - No hex colors, no px in styles, no CSS files, no Tailwind, no `xstyle`. Use component props, then tokens `var(--color-*)`, `var(--spacing-*)`.
  - Read props before using a component: `npx astryx component <Name>`. Search: `npx astryx search "<words>"`. Templates: `npx astryx template <name>` prints source.
  - Dense data = Table or List. Badge only for counts; status = StatusDot or Token.
  - Imports per component: `import {Button} from '@astryxdesign/core/Button'`.
  - Selector with `hasClear` needs `value: string | null` and `onChange: (v: string | null) => void`.
  - Heading has no `size` prop (use `level`). AlertDialog uses `actionVariant`.
- DB: Drizzle ORM + Postgres. `getDb()` from `@/db` (async). Tables in `src/db/schema.ts`. Do NOT change the schema unless your task says so; if you must, run `npx drizzle-kit generate --name <slug>` afterwards.
- Auth: `requireUser()`, `can(user, featureKey, action)` from `@/lib/auth`. Actions: view | create | edit | delete | propose | approve. Admin role bypasses everything.
- Feature tree: `src/lib/features.ts` (MODULES, featureKey(module, fn) = "module/fn", route = /module/fn).
- Catalog screens are generated from `src/lib/resources/definitions.ts` + `src/server/registry.ts` (generic list + form dialog in `src/components/resource/`). Prefer adding a ResourceDef over writing a new screen.
- Server actions live in `src/server/actions.ts` ('use server'). Business logic in `src/server/*.ts` (server-only).
- A function with its own custom screen gets a static route `src/app/(app)/<module>/<fn>/page.tsx` (server component that loads data and checks permission) + a client component next to it.
- Toast: `const toast = useToast()` from `@astryxdesign/core/Toast`, `toast({body, type: 'info'|'error'})`.
- After mutations call `router.refresh()` client-side (actions already `revalidatePath`).

## Checks before you finish
1. `npx tsc --noEmit` passes.
2. `npx eslint <your files>` has no errors.
3. Self-check against the Astryx rules above (grep your files for `<div`, `<span`, `#`, `px`).
4. Do not run `next build` or start servers on port 3100 (the orchestrator runs one). You may use port 3200+ if you need to look at a page; log in at /dang-nhap with admin / admin123.
5. Do not commit; the orchestrator commits.
