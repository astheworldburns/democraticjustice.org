import { createProofCard, hasMeaningfulValue } from "../../../lib/proof.js";
import { DateTime } from "luxon";

const SITE_TIMEZONE = "America/New_York";

function isPublicArticle(data = {}) {
  if (!hasMeaningfulValue(data.proof)) {
    return false;
  }

  const proofCard = createProofCard({
    ...data,
    siteTitle: data.siteSettings?.site_title || data.site?.name
  });

  if (!proofCard) {
    return false;
  }

  const publicationDate = DateTime.fromJSDate(new Date(data.date)).setZone(SITE_TIMEZONE);
  return publicationDate.isValid && publicationDate <= DateTime.now().setZone(SITE_TIMEZONE);
}

export default {
  layout: "layouts/post.njk",
  permalink: (data) => (isPublicArticle(data) ? `/articles/${data.page.fileSlug}/index.html` : false),
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
