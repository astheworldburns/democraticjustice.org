const GITHUB_API = "https://api.github.com";

export function createGithubAuthorizeUrl(env, state) {
  const callback = `${env.SITE_URL}/api/auth/github/callback`;
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("scope", "repo");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForToken(env, code) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${env.SITE_URL}/api/auth/github/callback`
    })
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.access_token || null;
}

export async function fetchGithubUser(token) {
  const response = await fetch(`${GITHUB_API}/user`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "admin-gateway"
    }
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}
