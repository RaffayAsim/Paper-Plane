# Frontend Codebase Guide (Where Things Are)

This document explains the **frontend architecture**, where files live, and how to safely add new pages, components, or integrations.

## 1) High-level structure

- [`frontend/src/App.tsx`](frontend/src/App.tsx) is the root component: sets up providers, router, and global UI.
- [`frontend/src/main.tsx`](frontend/src/main.tsx) is the entrypoint: mounts `<App />` into `#root`.
- [`frontend/src/pages/*`](frontend/src/pages) contains route-level page components.
- [`frontend/src/components/*`](frontend/src/components) contains reusable UI components.
- [`frontend/src/contexts/*`](frontend/src/contexts) contains React context providers (Auth, Settings).
- [`frontend/src/hooks/*`](frontend/src/hooks) contains custom hooks.
- [`frontend/src/lib/*`](frontend/src/lib) contains shared utilities (API client, billing, voice, utils).
- [`frontend/src/index.css`](frontend/src/index.css) and [`frontend/src/App.css`](frontend/src/App.css) contain global styles.

## 2) Routing (React Router v6)

The router is defined in [`frontend/src/App.tsx`](frontend/src/App.tsx:46).

Key routes:

| Path | Page Component | Protected | Notes |
|------|----------------|-----------|-------|
| `/` | `LandingPage` | ❌ | Public landing |
| `/auth` | `AuthPage` | ❌ | Login/register |
| `/dashboard` | `OverviewPage` | ✅ | Dashboard |
| `/create` | `CreateLeadsPage` | ✅ | Lead campaign creation |
| `/leads` | `LeadsTablePage` | ✅ | Lead list |
| `/email` | `EmailPage` | ✅ | Email inbox |
| `/settings` | `SettingsPage` | ✅ | App settings |
| `/users` | `UsersPage` | ✅ | Admin-only user management |

Protected routes use `<ProtectedRoute>` from [`frontend/src/components/ProtectedRoute.tsx`](frontend/src/components/ProtectedRoute.tsx), which reads the auth state from `AuthContext`.

## 3) State management

### Auth

- [`frontend/src/contexts/AuthContext.tsx`](frontend/src/contexts/AuthContext.tsx) holds:
  - `user`: current user object (id, email, roles, plan)
  - `accessToken`: short-lived JWT
  - `signIn`, `signOut`, `refreshUser` methods
- Uses `localStorage` for persistence.
- Exposes `useAuth()` hook for components.

### Settings

- [`frontend/src/contexts/SettingsContext.tsx`](frontend/src/contexts/SettingsContext.tsx) holds:
  - `settings`: app settings fetched from backend
  - `updateSettings`: method to update settings
- Exposes `useSettings()` hook.

### Server state (TanStack Query)

- [`frontend/src/App.tsx`](frontend/src/App.tsx) creates a `QueryClient` and wraps the app in `<QueryClientProvider>`.
- Queries are defined in page components using `useQuery`, mutations with `useMutation`.
- The API client is [`frontend/src/lib/api.ts`](frontend/src/lib/api.ts).

## 4) API client

- [`frontend/src/lib/api.ts`](frontend/src/lib/api.ts) exports:
  - `request()` – generic HTTP client
  - `login()`, `register()`, `logout()` – auth helpers
  - `API_BASE_URL` – configured via `VITE_API_URL`

Usage:
```tsx
import { request } from "@/lib/api";

const { data } = useQuery({
  queryKey: ["leads"],
  queryFn: () => request<Lead[]>("GET", "/leads"),
});
```

## 5) UI components

### shadcn/ui

- The project uses [shadcn/ui](https://ui.shadcn.com/) for accessible, unstyled-by-default components.
- Components are installed under [`frontend/src/components/ui/*`](frontend/src/components/ui).
- Each component is self-contained and can be customized via Tailwind.

### Custom components

- [`frontend/src/components/DashboardLayout.tsx`](frontend/src/components/DashboardLayout.tsx) – main dashboard layout with sidebar.
- [`frontend/src/components/DashboardSidebar.tsx`](frontend/src/components/DashboardSidebar.tsx) – collapsible sidebar.
- [`frontend/src/components/StatCard.tsx`](frontend/src/components/StatCard.tsx) – reusable stat card.
- [`frontend/src/components/StatusBadge.tsx`](frontend/src/components/StatusBadge.tsx) – lead status badge.

## 6) Styling

- **Tailwind CSS** – utility-first styling.
- **CSS modules** – not used; Tailwind covers most cases.
- Global styles in [`frontend/src/index.css`](frontend/src/index.css) and [`frontend/src/App.css`](frontend/src/App.css).

## 7) Adding a new page

1. **Create the page component**
   - Add a new file under [`frontend/src/pages/`](frontend/src/pages), e.g. `NewFeaturePage.tsx`.

2. **Add the route**
   - Import the component in [`frontend/src/App.tsx`](frontend/src/App.tsx).
   - Add a `<Route path="/new-feature" element={<P><NewFeaturePage /></P>} />`.

3. **Add to sidebar**
   - Update [`frontend/src/components/DashboardSidebar.tsx`](frontend/src/components/DashboardSidebar.tsx) to include a new `<NavLink>`.

4. **Use auth/plan gates**
   - If the page requires a specific plan, check `user.subscriptionPlan` in the component.

## 8) Adding a new reusable component

1. **Create the component**
   - Add a new file under [`frontend/src/components/`](frontend/src/components), e.g. `NewComponent.tsx`.

2. **Use shadcn/ui if possible**
   - Run `npx shadcn-ui@latest add button` to scaffold a new shadcn component.

3. **Export from `index.ts`**
   - Export the component from [`frontend/src/components/index.ts`](frontend/src/components/index.ts) for easy imports.

## 9) Adding a new API integration

1. **Extend the API client**
   - Add a new function in [`frontend/src/lib/api.ts`](frontend/src/lib/api.ts), e.g.
     ```ts
     export async function fetchSomething() {
       return request<Something[]>("GET", "/something");
     }
     ```

2. **Use in a component**
   - Use TanStack Query to call the function:
     ```tsx
     const { data } = useQuery({
       queryKey: ["something"],
       queryFn: fetchSomething,
     });
     ```

## 10) Testing

- Vitest is configured in [`frontend/vitest.config.ts`](frontend/vitest.config.ts).
- Tests live alongside components, e.g. `Component.test.tsx`.
- Run tests with `npm test` or `npm run test:ui`.

## 11) Deployment

- The frontend is a static Vite build.
- Build with `npm run build`.
- Deploy the `dist/` folder to Vercel, Netlify, Cloudflare Pages, S3, etc.
- Ensure `VITE_API_URL` is set in the production environment.

## 12) Common conventions to follow

- Keep page components in `pages/`, reusable components in `components/`.
- Use TanStack Query for server state, context for client state.
- Prefer Tailwind for styling.
- Use TypeScript types for API responses (import from backend-generated types if available).
- Keep components small and focused.

## 13) Where to find things

| Concern | Location |
|---------|----------|
| Routing | [`frontend/src/App.tsx`](frontend/src/App.tsx) |
| Auth state | [`frontend/src/contexts/AuthContext.tsx`](frontend/src/contexts/AuthContext.tsx) |
| Settings state | [`frontend/src/contexts/SettingsContext.tsx`](frontend/src/contexts/SettingsContext.tsx) |
| API client | [`frontend/src/lib/api.ts`](frontend/src/lib/api.ts) |
| Dashboard layout | [`frontend/src/components/DashboardLayout.tsx`](frontend/src/components/DashboardLayout.tsx) |
| Sidebar | [`frontend/src/components/DashboardSidebar.tsx`](frontend/src/components/DashboardSidebar.tsx) |
| UI components | [`frontend/src/components/ui/*`](frontend/src/components/ui) |
| Global styles | [`frontend/src/index.css`](frontend/src/index.css) |
| Vite config | [`frontend/vite.config.ts`](frontend/vite.config.ts) |
