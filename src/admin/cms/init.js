window.CMS_MANUAL_INIT = true;

const statusNode = document.getElementById("cms-bootstrap-status");

function setStatus(message) {
  if (statusNode) {
    statusNode.textContent = message;
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}`);
  }

  return response.json();
}

async function fetchGitHubUser(token) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("GitHub user profile fetch failed.");
  }

  return response.json();
}

function encodeUploadPath(path = "") {
  if (!path.startsWith("/assets/images/uploads/")) {
    return path;
  }

  const basePath = "/assets/images/uploads/";
  const rawTail = path.slice(basePath.length);
  const [filename, query = ""] = rawTail.split("?");
  const encodedFilename = filename
    .split("/")
    .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
    .join("/");

  return query ? `${basePath}${encodedFilename}?${query}` : `${basePath}${encodedFilename}`;
}

function normalizeLocalUploadUrls(body = "") {
  const markdownImagePattern = /(!\[[^\]]*\]\()([^\n)]+)(\))/g;

  return body.replace(markdownImagePattern, (fullMatch, prefix, destination, suffix) => {
    const hasTitle = destination.includes(' "');

    if (hasTitle) {
      const [path, ...titleParts] = destination.split(' "');
      const normalizedPath = encodeUploadPath(path.trim());
      return `${prefix}${normalizedPath} "${titleParts.join(' "')}${suffix}`;
    }

    return `${prefix}${encodeUploadPath(destination.trim())}${suffix}`;
  });
}

function normalizeLocalUploadPathValue(value) {
  if (typeof value !== "string" || !value.includes("/assets/images/uploads/")) {
    return value;
  }

  return encodeUploadPath(value.trim());
}

function installLocalUploadPathHook() {
  if (!window.CMS || typeof window.CMS.registerEventListener !== "function") {
    return;
  }

  window.CMS.registerEventListener({
    name: "preSave",
    handler: async ({ data }) => {
      if (!data || typeof data !== "object") {
        return data;
      }

      const normalizedBody =
        typeof data.body === "string" && data.body.includes("/assets/images/uploads/")
          ? normalizeLocalUploadUrls(data.body)
          : data.body;

      const normalizedFeaturedImage = normalizeLocalUploadPathValue(data.featured_image);

      if (normalizedBody === data.body && normalizedFeaturedImage === data.featured_image) {
        return data;
      }

      return {
        ...data,
        body: normalizedBody,
        featured_image: normalizedFeaturedImage
      };
    }
  });
}

function applyEditorLayoutFixes() {
  const style = document.createElement("style");
  style.id = "cms-editor-layout-fixes";
  style.textContent = `
    .nc-entryEditor-pane,
    .nc-entryEditor-editor,
    [role='document'] section,
    [role='document'] [data-testid='editor-pane'] {
      min-height: 70vh;
    }

    .nc-entryEditor-editor textarea,
    .nc-entryEditor-editor .CodeMirror,
    .nc-entryEditor-editor .cm-editor,
    [role='document'] textarea[name='body'],
    [role='document'] [id*='body'] textarea,
    [role='document'] [aria-label='Body'] textarea {
      min-height: 60vh !important;
    }
  `;

  document.head.append(style);
}

function installImageWithCreditEditorComponent() {
  if (!window.CMS || typeof window.CMS.registerEditorComponent !== "function") {
    return;
  }

  const captionCreditSeparator = "||";
  const imageBlockPattern = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/;

  window.CMS.registerEditorComponent({
    id: "image-with-credit",
    label: "Image with Credit",
    fields: [
      { name: "alt", label: "Alt Text", widget: "string", required: false },
      { name: "src", label: "Image", widget: "image" },
      { name: "caption", label: "Caption", widget: "text", required: false },
      { name: "credit", label: "Credit", widget: "string", required: false }
    ],
    pattern: imageBlockPattern,
    fromBlock(match) {
      const [, alt = "", src = "", title = ""] = match;
      const [caption = "", credit = ""] = title
        .split(captionCreditSeparator)
        .map((part) => part.trim());

      return {
        alt,
        src,
        caption,
        credit
      };
    },
    toBlock({ alt = "", src = "", caption = "", credit = "" }) {
      const normalizedSrc = encodeUploadPath(src);
      const captionValue = caption.trim();
      const creditValue = credit.trim();
      const titleValue = [captionValue, creditValue].filter(Boolean).join(` ${captionCreditSeparator} `);
      const escapedTitle = titleValue.replace(/"/g, "&quot;");

      if (titleValue) {
        return `![${alt}](${normalizedSrc} "${escapedTitle}")`;
      }

      return `![${alt}](${normalizedSrc})`;
    },
    toPreview({ alt = "", src = "", caption = "", credit = "" }) {
      const captionValue = caption.trim();
      const creditValue = credit.trim();
      const captionLine = [captionValue, creditValue ? `Photo: ${creditValue}` : ""].filter(Boolean).join(" ");
      const imageAlt = alt || captionValue || "Inline image";

      return `<figure><img src="${encodeUploadPath(src)}" alt="${imageAlt}" />${captionLine ? `<figcaption>${captionLine}</figcaption>` : ""}</figure>`;
    }
  });
}

function loadSveltiaScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/admin/cms/vendor/sveltia-cms-0.150.1.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Sveltia CMS script failed to load."));
    document.head.append(script);
  });
}

const cmsConfigPromise = fetch("/admin/cms/data/config.json", {
  credentials: "same-origin"
}).then(async (response) => {
  if (!response.ok) {
    throw new Error(`Content Desk config request failed with ${response.status}`);
  }

  return response.json();
});

window.addEventListener(
  "DOMContentLoaded",
  async () => {
    try {
      const config = await cmsConfigPromise;

      const sessionPayload = await fetchJson("/api/auth/session");
      const sessionUser = sessionPayload?.user;

      if (!sessionUser) {
        throw new Error("No authenticated admin session found.");
      }

      const tokenPayload = await fetchJson("/api/cms/github-token");
      const token = tokenPayload?.token;

      if (!token) {
        throw new Error("Missing GitHub token for CMS.");
      }

      const githubUser = await fetchGitHubUser(token);

      localStorage.setItem(
        "sveltia-cms.user",
        JSON.stringify({
          backendName: "github",
          id: githubUser.id,
          name: githubUser.name || null,
          login: githubUser.login,
          email: githubUser.email || null,
          avatarURL: githubUser.avatar_url,
          profileURL: githubUser.html_url,
          token
        })
      );

      await loadSveltiaScript();
      applyEditorLayoutFixes();
      installLocalUploadPathHook();
      installImageWithCreditEditorComponent();

      if (typeof window.initCMS !== "function") {
        throw new Error("Sveltia CMS did not finish loading.");
      }

      await window.initCMS({
        config: {
          ...config,
          load_config_file: false
        }
      });

      if (statusNode) {
        statusNode.remove();
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === "No authenticated admin session found." ||
          error.message === "Missing GitHub token for CMS." ||
          error.message === "GitHub user profile fetch failed.")
      ) {
        window.location.assign("/admin/");
        return;
      }

      console.error(error);
      setStatus("Content Desk could not load its configuration. Check the browser console for details.");
    }
  },
  { once: true }
);
