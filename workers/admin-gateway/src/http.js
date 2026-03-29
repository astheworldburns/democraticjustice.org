import { allowedOrigin } from "./config.js";

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers || {})
    }
  });
}

export function redirect(location, status = 302, headers = {}) {
  return new Response(null, {
    status,
    headers: {
      Location: location,
      ...headers
    }
  });
}

export function withCors(request, response, env) {
  const origin = allowedOrigin(request.headers.get("Origin") || "", env);
  if (!origin) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Vary", "Origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export function handleOptions(request, env) {
  const origin = allowedOrigin(request.headers.get("Origin") || "", env);
  if (!origin) {
    return new Response("", { status: 403 });
  }

  return new Response("", {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      Vary: "Origin"
    }
  });
}
