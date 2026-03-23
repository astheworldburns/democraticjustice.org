export default {
  layout: "layouts/post.njk",
  permalink: ({ page }) => `/articles/${page.fileSlug}/index.html`,
  eleventyComputed: {
    author: (data) => data.author || data.site.author,
    tags: (data) => {
      const tags = Array.isArray(data.tags)
        ? data.tags
        : data.tags
          ? [data.tags]
          : [];

      return Array.from(new Set(["article", ...tags]));
    }
  }
};

