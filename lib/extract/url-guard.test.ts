import { describe, expect, it } from "vitest";
import { assertPublicUrl, PrivateUrlError } from "./url-guard";

const REJECTED = [
  "http://localhost:3000/x",
  "http://app.localhost/",
  "https://foo.local/",
  "https://svc.internal/",
  "http://127.0.0.1/",
  "http://127.8.9.10/",
  "http://127.1/", // shorthand → normalized to 127.0.0.1 by URL parser
  "http://0.0.0.0/",
  "http://10.1.2.3/",
  "http://100.64.0.1/",
  "http://172.16.0.1/",
  "http://172.31.255.255/",
  "http://192.168.1.1/",
  "http://169.254.169.254/latest/meta-data/",
  "http://198.18.0.1/",
  "http://[::1]/",
  "http://[fc00::1]/",
  "http://[fe80::1]/",
  "http://[::ffff:127.0.0.1]/",
  "file:///etc/passwd",
  "ftp://example.com/",
  "javascript:alert(1)",
  "not a url",
];

const ACCEPTED = [
  "https://example.com/article",
  "http://93.184.216.34/",
  "https://sub.domain.co.uk/path?q=1",
  "https://[2606:2800:220:1:248:1893:25c8:1946]/",
  "https://example.com:8443/x",
  "http://172.32.0.1/", // just outside 172.16.0.0/12
  "http://100.128.0.1/", // just outside 100.64.0.0/10
];

describe("assertPublicUrl", () => {
  it.each(REJECTED)("rejects %s", (url) => {
    expect(() => assertPublicUrl(url)).toThrow(PrivateUrlError);
  });

  it.each(ACCEPTED)("accepts %s", (url) => {
    expect(() => assertPublicUrl(url)).not.toThrow();
  });

  it("throws PrivateUrlError (not a generic Error) for callers to catch", () => {
    let caught: unknown;
    try {
      assertPublicUrl("http://169.254.169.254/");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PrivateUrlError);
  });
});
