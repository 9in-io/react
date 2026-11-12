import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { NineProvider, RequireAuth, SignedIn, SignedOut, useNine } from "../src/index";

function Status() {
  const { isLoading } = useNine();
  return <span>{isLoading ? "loading" : "ready"}</span>;
}

describe("server rendering", () => {
  it("renders the loading state without a browser (Next.js, Remix)", () => {
    const html = renderToString(
      <NineProvider issuer="https://acme.9in.test" clientId="app_1" redirectUri="https://app.acme.test/callback">
        <Status />
        <SignedIn>in</SignedIn>
        <SignedOut>out</SignedOut>
        <RequireAuth fallback={<p>checking</p>}>secret</RequireAuth>
      </NineProvider>,
    );
    expect(html).toContain("loading");
    expect(html).toContain("checking");
    expect(html).not.toContain("secret");
    expect(html).not.toContain(">in<");
    expect(html).not.toContain(">out<");
  });

  it("explains a missing provider", () => {
    expect(() => renderToString(<Status />)).toThrow("inside <NineProvider>");
  });
});
