import { createProofCard } from "../../../lib/proof.js";

export default {
  layout: "layouts/post.njk",
  permalink: ({ page }) => `/articles/${page.fileSlug}/index.html`,
  eleventyComputed: {
    author: (data) => data.author || "seth-sturm",
    proofCard: (data) =>
      createProofCard({
        ...data,
        siteTitle: data.siteSettings?.site_title || data.site?.name
      }),
    tags: (data) => {
      const tags = Array.isArray(data.tags)
        ? data.tags
        : data.tags
          ? [data.tags]
          : [];

      return Array.from(new Set(["article", ...tags]));
    },
    socialImage: (data) =>
      createProofCard({
        ...data,
        siteTitle: data.siteSettings?.site_title || data.site?.name
      })?.shareImagePath || data.socialImage,
    socialDescription: (data) =>
      createProofCard({
        ...data,
        siteTitle: data.siteSettings?.site_title || data.site?.name
      })?.socialDescription || data.socialDescription
  }
};
