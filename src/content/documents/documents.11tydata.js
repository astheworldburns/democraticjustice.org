export default {
  layout: "layouts/document.njk",
  permalink: ({ page }) => `/documents/${page.fileSlug}/index.html`,
  eleventyComputed: {
    primary_source: (data) => {
      const value = data.primary_source;

      if (typeof value === "string") {
        return value.toLowerCase() !== "false";
      }

      return value !== false;
    },
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
