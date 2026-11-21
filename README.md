9in React SDK
=============

<img src="docs/img/logo.png" width="160" alt="9in"/>

Official React SDK for [9in](https://9in.io), built on [`@9in-io/sdk`](https://github.com/9in-io/sdk).

`@9in-io/react` signs users in to your single-page React app with 9in's hosted login:
authorization code flow with PKCE against your tenant, tokens kept and refreshed for you, and the
sign-in state in a hook.

- **`<NineProvider>`**: put it at the root of your app. It reads the stored session, and finishes
  the sign-in when the browser comes back to your callback URL.
- **`useNine()` and `useUser()`**: the signed-in user, the loading and error state, and `login`,
  `signup`, `logout`, `getAccessToken` and `fetch`.
- **`<SignedIn>`, `<SignedOut>` and `<RequireAuth>`**: show parts of the page to one state only, or
  send signed-out visitors to the sign-in page and back.
- **`NineStore`**: the same state outside React, for code that shares the client.

Requires React 18 or later (a peer dependency). Nothing else is installed besides `@9in-io/sdk`.

```bash
npm install @9in-io/react
```

Using Next.js with sessions on the server? Use [`@9in-io/nextjs`](https://github.com/9in-io/nextjs).
Not using React? Use `NineAuth` from [`@9in-io/sdk`](https://github.com/9in-io/sdk) directly.

## Sign users in

Create a **single-page application** in the 9in console and add your callback URL
(for example `https://app.example.com/nine/callback`) to its redirect URIs.

```tsx
import { NineProvider, SignedIn, SignedOut, useNine } from "@9in-io/react";

createRoot(document.getElementById("root")!).render(
  <NineProvider issuer="https://acme.9in.io" clientId="YOUR_CLIENT_ID" redirectUri={`${location.origin}/nine/callback`}>
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
| `client` | the underlying `NineAuth` client |

`useUser()` returns only the user (or `null`). A refresh that fails with `login_required` or
`invalid_grant` signs the user out.

## Call your API

Pass your API's identifier as `audience` and use `fetch` (or `getAccessToken`) from `useNine()`:

```tsx
<NineProvider issuer="https://acme.9in.io" clientId="YOUR_CLIENT_ID" redirectUri={`${location.origin}/nine/callback`} audience="https://api.example.com">
```

```tsx
const { fetch } = useNine();
const orders = await fetch("https://api.example.com/orders").then((res) => res.json());
```

On the API side, verify the token with `verifyAccessToken` from
[`@9in-io/sdk/server`](https://github.com/9in-io/sdk#protect-your-api-server), `requireAuth` from
[`@9in-io/node`](https://github.com/9in-io/node-sdk), or the [`nine` guard](https://github.com/9in-io/laravel)
in Laravel.

## Components

- `<SignedIn>` / `<SignedOut>`: render for one state only (nothing while loading).
- `<RequireAuth fallback={<Spinner />}>`: renders its children for signed-in users and sends
  everyone else to the sign-in page, coming back to the current page. A refused sign-in is not
  retried in a loop.

## Provider options

`<NineProvider>` takes the [`NineAuth` options](https://9in.io/docs/reference/sdk/#nineauth-9in-io-sdk):
`issuer`, `clientId`, `redirectUri`, and optionally `audience`, `scope`, `storage`, `locale` and
`allowInsecureIssuer`. It also takes `onRedirect(returnTo)` (default: replace the URL with the
History API).

Tokens are kept in `localStorage` by default. Pass `storage={sessionStorage}` to forget them when
the tab closes.

To share one client with code outside React, create it yourself and pass it in:

```tsx
import { NineAuth, NineProvider } from "@9in-io/react";

const client = new NineAuth({ issuer: "https://acme.9in.io", clientId: "YOUR_CLIENT_ID", redirectUri: `${location.origin}/nine/callback` });

<NineProvider client={client} redirectUri={`${location.origin}/nine/callback`}>
  <App />
</NineProvider>;
```

## Server rendering

Server rendering (Next.js, Remix) renders the loading state; the session is read in the browser.
For server-side sessions in Next.js, use [`@9in-io/nextjs`](https://github.com/9in-io/nextjs) instead.

The full guide is [Single-page apps](https://9in.io/docs/single-page-apps/) in the 9in docs, and
every export is in the [SDK reference](https://9in.io/docs/reference/sdk/#9in-io-react).

## Development

```bash
npm install
npm test            # vitest (Node 22.12+)
npm run typecheck
npm run build       # dist/
```

This package is developed in 9in's monorepo and copied here at each release (one commit per
version). Report bugs in [issues](https://github.com/9in-io/react/issues).

## License

The MIT License (MIT). See [LICENSE](LICENSE). 9in and SSOfy are by [Cubelet Ltd](https://cubelet.co.uk).
