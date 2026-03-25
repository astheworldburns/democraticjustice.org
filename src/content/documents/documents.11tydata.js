export default {
  layout: "layouts/document.njk",
  permalink: ({ page }) => `/documents/${page.fileSlug}/index.html`,
  eleventyComputed: {
    file_url: (data) => data.file || "",
    file_type: (data) => {
      const value = (data.file || "").toLowerCase();

      if (value.endsWith(".pdf")) {
        return "pdf";
      }

      if (/\.(png|jpe?g|gif|webp|avif|svg)$/.test(value)) {
        return "image";
      }

      return "file";
    }
  }
};
