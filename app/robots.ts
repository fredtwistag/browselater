import type { MetadataRoute } from "next";

// Private app — keep search engines out (PRD §3 launch checklist).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
