function normalizeFilePath(value = "") {
  return value
    .toString()
    .trim()
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/\/+/g, "/");
}

function resolveDocumentFileUrl(value = "") {
  const rawValue = (value || "").toString().trim();

  if (!rawValue) {
    return "";
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(rawValue) || rawValue.startsWith("//")) {
    return rawValue;
  }

  const normalizedPath = `/${rawValue.replace(/^\/+/, "")}`;
  return encodeURI(normalizedPath);
}

function decodePath(value = "") {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

function getManifestPreview(manifest = {}, fileUrl = "", slug = "") {
  if (!manifest || typeof manifest !== "object") {
    return "";
  }

  const normalizedFileUrl = normalizeFilePath(fileUrl);
  const decodedFileUrl = normalizeFilePath(decodePath(fileUrl));
  const encodedFileUrl = encodeURI(decodedFileUrl);

  return (
    manifest[normalizedFileUrl] ||
    manifest[decodedFileUrl] ||
    manifest[encodedFileUrl] ||
    manifest[fileUrl] ||
    (slug ? manifest[slug] : "") ||
    ""
  );
}

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
    file_url: (data) => resolveDocumentFileUrl(data.file),
    video_url: (data) => (data.video_url || "").toString().trim(),
    file_type: (data) => {
      const value = (data.file || "").toLowerCase();

      if (!value) {
        return "";
      }

      if (value.endsWith(".pdf")) {
        return "pdf";
      }

      if (/\.(png|jpe?g|gif|webp|avif|svg)$/.test(value)) {
        return "image";
      }

      return "file";
    },
    preview_image: (data) => {
      if (data.preview_image) {
        return data.preview_image;
      }

      if (data.file_type === "image") {
        return data.file_url;
      }

      const manifestPreview = getManifestPreview(data.documentPreviewManifest, data.file_url, data.page?.fileSlug);
      return manifestPreview || "";
    },
    socialImage: (data) => data.preview_image || data.og_image || ""
  }
};
