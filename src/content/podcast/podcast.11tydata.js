export default {
  layout: "layouts/podcast-episode.njk",
  tags: ["podcast"],
  permalink: ({ page }) => `/podcast/${page.fileSlug}/index.html`,
  eleventyComputed: {
    date: (data) => data.publish_date || data.date || new Date().toISOString()
  }
};
