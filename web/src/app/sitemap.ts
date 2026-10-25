import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const PAGES = ["", "/es", "/pt", "/overview", "/buyer", "/farmer", "/pool", "/validator", "/agent", "/admin"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "weekly",
    priority: ["", "/es", "/pt"].includes(path) ? 1 : 0.6,
  }));
}
