import { json } from "./http.js";
import { loadSessionFromRequest } from "./sessions.js";

function unauthorized() {
  return json({ error: "Unauthorized" }, { status: 401 });
}

export async function handleCmsGithubToken(request, env) {
  const loaded = await loadSessionFromRequest(request, env);
  if (!loaded) {
    return unauthorized();
  }

  const token = loaded.session.githubToken || env.GITHUB_PAT;
  if (!token) {
    return json({ error: "GitHub token is not configured" }, { status: 500 });
  }

  return json({ token });
}
