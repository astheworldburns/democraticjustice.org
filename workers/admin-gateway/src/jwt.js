import { decodeText, encodeBase64url } from "./crypto.js";

export async function signHs256(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = encodeBase64url(JSON.stringify(header));
  const encodedPayload = encodeBase64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    decodeText(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, decodeText(signingInput));
  return `${signingInput}.${encodeBase64url(new Uint8Array(signature))}`;
}
