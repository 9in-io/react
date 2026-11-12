import { NineError, type LoginOptions, type NineAuth, type User } from "@9in-io/sdk";

/** What components see. */
export interface NineState {
  /** True until the provider has read the stored session (or finished a sign-in callback). */
  isLoading: boolean;
  isAuthenticated: boolean;
  /** The signed-in user (claims of the ID token), or null. */
  user: User | null;
  /** A failed sign-in or refresh, e.g. `access_denied`; cleared by the next sign-in. */
  error: Error | null;
}

export interface NineStoreOptions {
  /**
   * Called after a sign-in callback with the `returnTo` passed to `login()`. Default: replace
   * the URL with `returnTo` (or the callback URL without its query) using the History API.
   * Pass your router's navigate function instead, e.g. `(to) => navigate(to ?? "/", { replace: true })`.
   */
  onRedirect?: (returnTo: string | undefined) => void;
  /** The current URL (default: `window.location.href`). */
  location?: () => string;
}

const INITIAL: NineState = { isLoading: true, isAuthenticated: false, user: null, error: null };

/**
 * The sign-in state of one NineAuth client, outside React: subscribe/getSnapshot for
 * `useSyncExternalStore`, and actions that keep the state current.
 */
export class NineStore {
  private state: NineState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private started: Promise<void> | null = null;

  constructor(
    readonly client: NineAuth,
    private readonly redirectUri: string,
    private readonly options: NineStoreOptions = {},
  ) {}

  readonly getSnapshot = (): NineState => this.state;
  static readonly serverSnapshot: NineState = INITIAL;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<NineState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  /** Is this URL the sign-in callback (the redirect URI with code/error and state)? */
  isCallback(href: string): boolean {
    let url: URL;
    let target: URL;
    try {
      url = new URL(href);
      target = new URL(this.redirectUri, url);
    } catch {
      return false;
    }
    const params = url.searchParams;
    return url.origin === target.origin && url.pathname === target.pathname && params.has("state") && (params.has("code") || params.has("error"));
  }

  /** Reads the stored session, or finishes the sign-in when the page is the callback. Runs once. */
  start(): Promise<void> {
    this.started ??= this.load();
    return this.started;
  }

  private async load(): Promise<void> {
    const href = this.options.location?.() ?? (typeof window !== "undefined" ? window.location.href : "");
    try {
      if (href && this.isCallback(href)) {
        const { user, returnTo } = await this.client.handleRedirect(href);
        this.set({ isLoading: false, isAuthenticated: true, user, error: null });
        this.afterRedirect(href, returnTo);
        return;
      }
      const user = await this.client.getUser();
      this.set({ isLoading: false, isAuthenticated: !!user && this.client.isAuthenticated(), user: user ?? null });
    } catch (error) {
      this.set({ isLoading: false, isAuthenticated: false, user: null, error: error as Error });
      if (href && this.isCallback(href)) this.afterRedirect(href, undefined);
    }
  }

  private afterRedirect(href: string, returnTo: string | undefined) {
    if (this.options.onRedirect) {
      this.options.onRedirect(returnTo);
      return;
    }
    if (typeof window === "undefined" || !window.history) return;
    const url = new URL(href);
    window.history.replaceState(window.history.state, "", returnTo ?? url.pathname);
  }

  /** Goes to the 9in sign-in page (the page unloads). */
  readonly login = (options: LoginOptions = {}): Promise<void> => {
    this.set({ error: null });
    return this.client.login(options);
  };

  /** Goes to the 9in registration page. */
  readonly signup = (options: Omit<LoginOptions, "screen"> = {}): Promise<void> => {
    this.set({ error: null });
    return this.client.signup(options);
  };

  /** Signs out here and at 9in (`local: true` only here). */
  readonly logout = async (options: { returnTo?: string; local?: boolean } = {}): Promise<void> => {
    this.set({ isAuthenticated: false, user: null });
    await this.client.logout(options);
  };

  /** A valid access token, refreshed when needed. A dead session signs the user out here. */
  readonly getAccessToken = async (): Promise<string> => {
    try {
      return await this.client.getAccessToken();
    } catch (error) {
      if (error instanceof NineError && (error.code === "login_required" || error.code === "invalid_grant")) {
        this.set({ isAuthenticated: false, user: null });
      }
      throw error;
    }
  };

  /** fetch() with the access token. */
  readonly fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${await this.getAccessToken()}`);
    return fetch(input, { ...init, headers });
  };
}
