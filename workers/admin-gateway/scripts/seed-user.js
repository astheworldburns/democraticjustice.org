import { pbkdf2Sha256 } from "../src/crypto.js";

const USER_RECORD = {
  email: "sethsturm@gmail.com",
  displayName: "Seth Sturm",
  roles: ["admin"]
};

const ITERATIONS = 210000;
const SALT_BYTES = 16;
const KEY_LENGTH_BITS = 256;

function bytesToBase64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

async function buildSeedValue(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hashBytes = await pbkdf2Sha256(password, saltBytes, ITERATIONS, KEY_LENGTH_BITS);

  return {
    ...USER_RECORD,
    passwordHash: bytesToBase64(hashBytes),
    passwordSalt: bytesToBase64(saltBytes)
  };
}

function renderPromptForm(message = "") {
  const banner = message ? `<p>${message}</p>` : "";

  return `<!doctype html>
<html>
  <body>
    <h1>Seed admin user</h1>
    ${banner}
    <form method="post">
      <label>
        Password
        <input type="password" name="password" required />
      </label>
      <button type="submit">Seed ADMIN_USERS</button>
    </form>
    <p>You can also run with SEED_PASSWORD set via <code>--var SEED_PASSWORD:...</code>.</p>
  </body>
</html>`;
}

async function resolvePassword(request, env) {
  if (env.SEED_PASSWORD) {
    return env.SEED_PASSWORD;
  }

  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const password = formData.get("password");

      if (typeof password === "string" && password.length > 0) {
        return password;
      }
    }

    try {
      const body = await request.json();
      if (typeof body?.password === "string" && body.password.length > 0) {
        return body.password;
      }
    } catch {
      // Ignore invalid JSON payloads and continue to prompt.
    }
  }

  return null;
}

export async function seedAdminUser(env, password) {
  if (!env.ADMIN_USERS) {
    throw new Error("Missing ADMIN_USERS KV binding");
  }

  if (!password) {
    throw new Error("Missing password");
  }

  const value = await buildSeedValue(password);
  const key = `user:${USER_RECORD.email}`;

  await env.ADMIN_USERS.put(key, JSON.stringify(value));

  return { key, value };
}

export default {
  async fetch(request, env) {
    const password = await resolvePassword(request, env);

    if (!password) {
      return new Response(renderPromptForm("Enter a password to seed the admin user."), {
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    }

    const { key, value } = await seedAdminUser(env, password);

    return new Response(
      JSON.stringify({ ok: true, key, email: value.email, displayName: value.displayName, roles: value.roles }),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }
};
