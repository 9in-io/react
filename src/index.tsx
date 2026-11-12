"use client";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { NineAuth, type LoginOptions, type NineAuthOptions, type User } from "@9in-io/sdk";
import { NineStore, type NineState, type NineStoreOptions } from "./store.js";

export { NineStore, type NineState, type NineStoreOptions } from "./store.js";
export { NineAuth, NineError, type LoginOptions, type NineAuthOptions, type User } from "@9in-io/sdk";

const NineContext = createContext<NineStore | null>(null);

/**
 * Either the client options (issuer, clientId, redirectUri, …) or an existing `client` (shared
 * with non-React code) with its `redirectUri`.
 */
export type NineProviderProps = NineStoreOptions & { children?: ReactNode } & (
    | (NineAuthOptions & { client?: undefined })
    | { client: NineAuth; redirectUri: string }
  );

/**
 * Makes 9in sign-in available to its children. Put it at the root of your app; on the
 * redirect URI it finishes the sign-in and then replaces the URL (see `onRedirect`).
 *
 *   <NineProvider issuer="https://acme.9in.io" clientId="…" redirectUri={`${location.origin}/callback`}>
 */
export function NineProvider(props: NineProviderProps) {
  const { children, onRedirect, location } = props;
  // One store for the provider's lifetime (the options are read once, like a client's).
  const [store] = useState(() => {
    if (props.client) return new NineStore(props.client, props.redirectUri, { onRedirect, location });
    const { children: _children, onRedirect: _onRedirect, location: _location, client: _client, ...options } = props;
    return new NineStore(new NineAuth(options), options.redirectUri, { onRedirect, location });
  });
  useEffect(() => {
    void store.start();
  }, [store]);
  return <NineContext.Provider value={store}>{children}</NineContext.Provider>;
}

export interface UseNine extends NineState {
  login: (options?: LoginOptions) => Promise<void>;
  signup: (options?: Omit<LoginOptions, "screen">) => Promise<void>;
  logout: (options?: { returnTo?: string; local?: boolean }) => Promise<void>;
  /** A valid access token for your API, refreshed when needed. */
  getAccessToken: () => Promise<string>;
  /** fetch() with the access token. */
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /** The underlying client. */
  client: NineAuth;
}

/** The sign-in state and actions. Must be used inside <NineProvider>. */
export function useNine(): UseNine {
  const store = useContext(NineContext);
  if (!store) throw new Error("useNine() must be used inside <NineProvider>");
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, () => NineStore.serverSnapshot);
  return {
    ...state,
    login: store.login,
    signup: store.signup,
    logout: store.logout,
    getAccessToken: store.getAccessToken,
    fetch: store.fetch,
    client: store.client,
  };
}

/** The signed-in user, or null. */
export function useUser(): User | null {
  return useNine().user;
}

/** Shows its children only to signed-in users (nothing while loading). */
export function SignedIn({ children }: { children?: ReactNode }) {
  const { isLoading, isAuthenticated } = useNine();
  return !isLoading && isAuthenticated ? <>{children}</> : null;
}

/** Shows its children only to signed-out users (nothing while loading). */
export function SignedOut({ children }: { children?: ReactNode }) {
  const { isLoading, isAuthenticated } = useNine();
  return !isLoading && !isAuthenticated ? <>{children}</> : null;
}

export interface RequireAuthProps {
  children?: ReactNode;
  /** Shown while loading and while going to the sign-in page. */
  fallback?: ReactNode;
  /** Passed to login(); `returnTo` defaults to the current page. */
  loginOptions?: LoginOptions;
}

/**
 * Renders its children for signed-in users and sends everyone else to the sign-in page,
 * coming back to the current page. A failed sign-in (`error`) is not retried in a loop.
 */
export function RequireAuth({ children, fallback = null, loginOptions }: RequireAuthProps) {
  const { isLoading, isAuthenticated, error, login } = useNine();
  useEffect(() => {
    if (isLoading || isAuthenticated || error) return;
    const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined;
    void login({ returnTo: here, ...loginOptions });
  }, [isLoading, isAuthenticated, error, login, loginOptions]);
  return isAuthenticated ? <>{children}</> : <>{fallback}</>;
}
