import { createProofCard, hasMeaningfulValue } from "../../../lib/proof.js";
import { DateTime } from "luxon";

const SITE_TIMEZONE = "America/New_York";

function safeProofCard(data = {}) {
  if (!hasMeaningfulValue(data.proof)) {
    return null;
  }

  try {
    return createProofCard({
      ...data,
      siteTitle: data.siteSettings?.site_title || data.site?.name
    });
  } catch {
    return null;
  }
}

function isPublicArticle(data = {}) {
  const publicationDate = DateTime.fromJSDate(new Date(data.date)).setZone(SITE_TIMEZONE);
  return publicationDate.isValid && publicationDate <= DateTime.now().setZone(SITE_TIMEZONE);
}

export default {
  layout: "layouts/post.njk",
  permalink: (data) => (isPublicArticle(data) ? `/articles/${data.page.fileSlug}/index.html` : false),
  eleventyComputed: {
    author: (data) => data.author || "seth-sturm",
    proofCard: (data) => safeProofCard(data),
    tags: (data) => {
      const tags = Array.isArray(data.tags)
        ? data.tags
        : data.tags
          ? [data.tags]
          : [];

      return Array.from(new Set(["article", ...tags]));
    },
    socialImage: (data) => safeProofCard(data)?.shareImagePath || data.socialImage,
    socialDescription: (data) => safeProofCard(data)?.socialDescription || data.socialDescription
  }
};
