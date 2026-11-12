import { describe, expect, it, vi } from "vitest";
import { NineError, type NineAuth } from "@9in-io/sdk";
import { NineStore } from "../src/store";

/** The part of NineAuth the store uses. */
function fakeClient(overrides: Partial<Record<keyof NineAuth, unknown>> = {}) {
  return {
    handleRedirect: vi.fn(async () => ({ user: { sub: "usr_1", email: "jane@acme.test" }, returnTo: "/orders?tab=open" })),
    getUser: vi.fn(async () => null),
    isAuthenticated: vi.fn(() => false),
    login: vi.fn(async () => undefined),
    signup: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
    getAccessToken: vi.fn(async () => "at-1"),
    ...overrides,
  } as unknown as NineAuth & Record<string, ReturnType<typeof vi.fn>>;
}

const REDIRECT = "https://app.acme.test/callback";

describe("NineStore", () => {
  it("finishes the sign-in on the callback once and hands returnTo to onRedirect", async () => {
    const client = fakeClient();
    const onRedirect = vi.fn();
    const store = new NineStore(client, REDIRECT, { location: () => `${REDIRECT}?code=c&state=s`, onRedirect });
    const seen: boolean[] = [];
    store.subscribe(() => seen.push(store.getSnapshot().isLoading));
    expect(store.getSnapshot()).toMatchObject({ isLoading: true, isAuthenticated: false });
    await Promise.all([store.start(), store.start()]); // React StrictMode runs effects twice
    expect(client.handleRedirect).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toMatchObject({ isLoading: false, isAuthenticated: true, user: { sub: "usr_1" }, error: null });
    expect(onRedirect).toHaveBeenCalledWith("/orders?tab=open");
    expect(seen).toEqual([false]);
  });

  it("reads the stored session on other pages", async () => {
    const client = fakeClient({ getUser: vi.fn(async () => ({ sub: "usr_2" })), isAuthenticated: vi.fn(() => true) });
    const store = new NineStore(client, REDIRECT, { location: () => "https://app.acme.test/orders?code=not-ours&state=x" });
    await store.start();
    expect(client.handleRedirect).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toMatchObject({ isLoading: false, isAuthenticated: true, user: { sub: "usr_2" } });
  });

  it("keeps a refused sign-in as the error and still leaves the callback URL", async () => {
    const client = fakeClient({ handleRedirect: vi.fn(async () => Promise.reject(new NineError("access_denied", "No"))) });
    const onRedirect = vi.fn();
    const store = new NineStore(client, REDIRECT, { location: () => `${REDIRECT}?error=access_denied&state=s`, onRedirect });
    await store.start();
    expect(store.getSnapshot()).toMatchObject({ isLoading: false, isAuthenticated: false });
    expect((store.getSnapshot().error as NineError).code).toBe("access_denied");
    expect(onRedirect).toHaveBeenCalledWith(undefined);
    await store.login();
    expect(store.getSnapshot().error).toBeNull();
  });

  it("signs out on logout and when the session can't be refreshed", async () => {
    const client = fakeClient({ getUser: vi.fn(async () => ({ sub: "usr_1" })), isAuthenticated: vi.fn(() => true), getAccessToken: vi.fn(async () => Promise.reject(new NineError("login_required"))) });
    const store = new NineStore(client, REDIRECT, { location: () => "https://app.acme.test/" });
    await store.start();
    await expect(store.getAccessToken()).rejects.toMatchObject({ code: "login_required" });
    expect(store.getSnapshot().isAuthenticated).toBe(false);

    const other = new NineStore(fakeClient({ getUser: vi.fn(async () => ({ sub: "usr_1" })), isAuthenticated: vi.fn(() => true) }), REDIRECT, { location: () => "https://app.acme.test/" });
    await other.start();
    await other.logout({ returnTo: "/" });
    expect(other.getSnapshot()).toMatchObject({ isAuthenticated: false, user: null });
  });

  it("recognises only its own redirect URI as the callback", () => {
    const store = new NineStore(fakeClient(), "/callback", {});
    expect(store.isCallback("https://app.acme.test/callback?code=1&state=2")).toBe(true);
    expect(store.isCallback("https://app.acme.test/callback?code=1")).toBe(false);
    expect(store.isCallback("https://app.acme.test/other?code=1&state=2")).toBe(false);
  });
});
