export default {
  layout: "layouts/author.njk",
  permalink: ({ page }) => `/staff/${page.fileSlug}/index.html`,
  eleventyComputed: {
    slug: ({ page }) => page.fileSlug,
    title: (data) => data.name,
    description: (data) => data.short_bio || data.bio,
    ogType: () => "profile"
  }
};
