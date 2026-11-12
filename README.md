# @9in-io/react

Sign users in to your React app with 9in. Built on [`@9in-io/sdk`](https://www.npmjs.com/package/@9in-io/sdk):
authorization code with PKCE, tokens refreshed for you. React is a peer dependency; nothing else is
installed.

```sh
npm install @9in-io/react
```

Create a **single-page application** in the 9in console and add your callback URL
(for example `https://app.example.com/callback`) to its redirect URIs.

```tsx
import { NineProvider, SignedIn, SignedOut, useNine } from "@9in-io/react";

createRoot(document.getElementById("root")!).render(
  <NineProvider issuer="https://acme.9in.io" clientId="YOUR_CLIENT_ID" redirectUri={`${location.origin}/callback`}>
    <App />
  </NineProvider>,
);

function App() {
  const { user, login, logout } = useNine();
  return (
    <>
      <SignedOut>
        <button onClick={() => login()}>Sign in</button>
      </SignedOut>
      <SignedIn>
        <p>Hello {user?.name ?? user?.email}</p>
        <button onClick={() => logout({ returnTo: location.origin })}>Sign out</button>
      </SignedIn>
    </>
  );
}
```

The provider finishes the sign-in when the browser comes back to `redirectUri`, then replaces the
URL with the page the user started from. With a router, pass its navigate function:
`onRedirect={(to) => navigate(to ?? "/", { replace: true })}`.

## useNine()

| Field | |
|---|---|
| `isLoading` | `true` until the stored session is read or the callback is finished |
| `isAuthenticated`, `user` | the signed-in user (ID token claims: `sub`, `email`, `name`, …) |
| `error` | a refused sign-in, e.g. `access_denied` |
| `login(options?)` | goes to the sign-in page; `{ returnTo, screen: "signup", loginHint, prompt }` |
| `signup(options?)` | goes to the registration page |
| `logout(options?)` | signs out here and at 9in; `{ returnTo }`, or `{ local: true }` for here only |
| `getAccessToken()` | a valid access token for your API (refreshed when needed) |
| `fetch(url, init?)` | `fetch` with `Authorization: Bearer …` |

To call your API, pass `audience="https://api.example.com"` (your API's identifier) to the provider.

## Components

- `<SignedIn>` / `<SignedOut>`: render for one state only (nothing while loading).
- `<RequireAuth fallback={<Spinner />}>`: renders its children for signed-in users and sends
  everyone else to the sign-in page, coming back to the current page.

Server rendering (Next.js, Remix) renders the loading state; the session is read in the browser.
For server-side sessions in Next.js, use `@9in-io/nextjs` instead.

Tokens are kept in `localStorage` by default. Pass `storage={sessionStorage}` to forget them when
the tab closes. See the [9in docs](https://9in.io/docs/single-page-apps/).
