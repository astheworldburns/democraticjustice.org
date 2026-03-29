window.CMS_MANUAL_INIT = true;

const statusNode = document.getElementById("cms-bootstrap-status");

function setStatus(message) {
  if (statusNode) {
    statusNode.textContent = message;
  }
}

function createNetlifyIdentityShim({ token, sessionUser }) {
  const listeners = new Map();

  const cmsUser = {
    id: sessionUser?.id || sessionUser?.email || "admin-user",
    email: sessionUser?.email || "",
    full_name: sessionUser?.name || sessionUser?.email || "Admin User",
    user_metadata: {
      full_name: sessionUser?.name || ""
    },
    token: {
      access_token: token,
      token_type: "Bearer"
    },
    jwt: () => Promise.resolve(token)
  };

  const emit = (event, payload = cmsUser) => {
    const handlers = listeners.get(event);

    if (!handlers) {
      return;
    }

    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (error) {
        console.error("netlifyIdentity listener error", error);
      }
    }
  };

  const shim = {
    init() {
      queueMicrotask(() => {
        emit("init", cmsUser);
        emit("login", cmsUser);
      });
      return shim;
    },
    on(event, callback) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event).add(callback);

      if ((event === "init" || event === "login") && callback) {
        queueMicrotask(() => callback(cmsUser));
      }
    },
    off(event, callback) {
      listeners.get(event)?.delete(callback);
    },
    open() {
      emit("login", cmsUser);
    },
    close() {},
    currentUser() {
      return cmsUser;
    },
    refresh() {
      return Promise.resolve(cmsUser);
    },
    logout() {
      return fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      }).finally(() => {
        emit("logout", null);
        window.location.assign("/admin/");
      });
    }
  };

  return shim;
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
      const [config, sessionPayload] = await Promise.all([
        cmsConfigPromise,
        fetchJson("/api/auth/session")
      ]);

      const sessionUser = sessionPayload?.user;

      if (!sessionUser) {
        window.location.assign("/admin/");
        return;
      }

      const tokenPayload = await fetchJson("/api/cms/github-token");
      const token = tokenPayload?.token;

      if (!token) {
        window.location.assign("/admin/");
        return;
      }

      window.netlifyIdentity = createNetlifyIdentityShim({ token, sessionUser });
      window.netlifyIdentity.init();

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
      console.error(error);
      setStatus("Content Desk could not load its configuration. Check the browser console for details.");
    }
  },
  { once: true }
);
