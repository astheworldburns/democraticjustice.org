const encoder = new TextEncoder();

function base64ToBytes(base64) {
  const normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4 || 4)) % 4;
  const padded = normalized + "=".repeat(padding);
  const binary = atob(padded);
  const output = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }

  return output;
}

export function encodeBase64url(input) {
  const bytes = input instanceof Uint8Array ? input : encoder.encode(input);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeStoredHash(hash) {
  if (!hash) {
    return new Uint8Array();
  }

  if (/^[a-fA-F0-9]+$/.test(hash) && hash.length % 2 === 0) {
    const output = new Uint8Array(hash.length / 2);
    for (let index = 0; index < hash.length; index += 2) {
      output[index / 2] = Number.parseInt(hash.slice(index, index + 2), 16);
    }
    return output;
  }

  return base64ToBytes(hash);
}

export async function pbkdf2Sha256(password, saltBytes, iterations = 100000, keyLengthBits = 256) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes,
      iterations
    },
    baseKey,
    keyLengthBits
  );

  return new Uint8Array(derived);
}

export function constantTimeEquals(a, b) {
  const aBytes = a instanceof Uint8Array ? a : new Uint8Array(a || []);
  const bBytes = b instanceof Uint8Array ? b : new Uint8Array(b || []);
  const maxLength = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;

  for (let index = 0; index < maxLength; index += 1) {
    const left = index < aBytes.length ? aBytes[index] : 0;
    const right = index < bBytes.length ? bBytes[index] : 0;
    diff |= left ^ right;
  }

  return diff === 0;
}

export function randomId(bytes = 24) {
  return encodeBase64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function decodeText(value) {
  return encoder.encode(value);
}
