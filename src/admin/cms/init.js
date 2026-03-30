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

const cmsBootstrapPromise = (async () => {
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

  localStorage.setItem("sveltia-cms.user", JSON.stringify({ token }));

  await loadSveltiaScript();
})();

window.addEventListener(
  "DOMContentLoaded",
  async () => {
    try {
      const [config] = await Promise.all([cmsConfigPromise, cmsBootstrapPromise]);

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
          error.message === "Missing GitHub token for CMS.")
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
