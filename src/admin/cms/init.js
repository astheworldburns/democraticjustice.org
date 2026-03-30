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
