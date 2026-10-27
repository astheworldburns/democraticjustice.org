export const MAX_NARRATION_BYTES = 20 * 1024 * 1024;

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function decodedSlice(encoded, start, length) {
  const alignedStart = Math.floor(start / 3) * 3;
  const encodedStart = (alignedStart / 3) * 4;
  const encodedEnd = Math.min(encoded.length, encodedStart + Math.ceil((start - alignedStart + length) / 3) * 4);
  const decoded = atob(encoded.slice(encodedStart, encodedEnd));
  const offset = start - alignedStart;
  const result = new Uint8Array(Math.min(length, Math.max(0, decoded.length - offset)));
  for (let index = 0; index < result.length; index += 1) {
    result[index] = decoded.charCodeAt(offset + index);
  }
  return result;
}

function isMp3(encoded, byteLength) {
  let bytes = decodedSlice(encoded, 0, 10);
  let offset = 0;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    if (bytes.length < 10 || bytes.slice(6, 10).some((byte) => byte & 0x80)) {
      return false;
    }
    offset = 10 + ((bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9]);
    if (bytes[5] & 0x10) offset += 10;
  }

  if (offset >= byteLength) return false;
  bytes = decodedSlice(encoded, offset, 4100);

  // An ID3 label alone is not audio. Require a valid MPEG Layer III frame
  // header after any metadata/padding, including common VBR encodings.
  const end = Math.min(bytes.length - 3, 4096);
  for (let index = 0; index < end; index += 1) {
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    if (bytes[index] === 0xff && (second & 0xe0) === 0xe0 &&
      ((second >> 3) & 3) !== 1 && ((second >> 1) & 3) === 1 &&
      (third >> 4) > 0 && (third >> 4) < 15 && ((third >> 2) & 3) !== 3) {
      return true;
    }
  }
  return false;
}

export function validateNarrationUpload(payload = {}) {
  const fileName = String(payload.file_name || "").trim();
  const mime = String(payload.mime_type || "").trim().toLowerCase();
  const encoded = payload.file_base64;
  if (!/\.mp3$/i.test(fileName) || !["", "audio/mpeg", "audio/mp3", "audio/x-mp3", "application/octet-stream"].includes(mime)) {
    throw invalid("Choose an MP3 audio file.");
  }
  if (typeof encoded !== "string" || !encoded.length) {
    throw invalid("Choose an MP3 audio file before uploading.");
  }
  if (encoded.length > Math.ceil(MAX_NARRATION_BYTES / 3) * 4) {
    throw invalid("Narration files must be 20 MiB or smaller.");
  }
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw invalid("The audio upload was not valid base64 data.");
  }
  const byteLength = (encoded.length / 4) * 3 - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
  if (byteLength > MAX_NARRATION_BYTES) {
    throw invalid("Narration files must be 20 MiB or smaller.");
  }
  if (!isMp3(encoded, byteLength)) {
    throw invalid("This file does not contain MP3 audio. Export the recording as MP3 before uploading.");
  }
  const stem = fileName.replace(/\.mp3$/i, "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "") || "article-narration";
  const name = `${stem}-${crypto.randomUUID()}.mp3`;
  return { file_base64: encoded, audio_file: `/media/narration/${name}`, repoPath: `static/media/narration/${name}` };
}

export function narrationMetadata(raw = {}, current = {}) {
  const next = {};
  for (const field of ["audio_file", "audio_narrator"]) {
    if (Object.hasOwn(raw, field)) {
      const value = String(raw[field] || "");
      next[field] = field === "audio_file" ? value.trim() : value.replace(/\s+/g, " ").trim();
    } else if (Object.hasOwn(current, field)) {
      next[field] = current[field];
    }
  }
  if (next.audio_file && !isNarrationPath(next.audio_file)) {
    throw invalid("Article audio must be an MP3 uploaded to /media/narration/.");
  }
  return next;
}

function isNarrationPath(value) {
  const prefix = "/media/narration/";
  if (!value.startsWith(prefix)) return false;
  const filename = value.slice(prefix.length);
  if (!filename || /[/\\?#\u0000-\u001f\u007f]/.test(filename)) return false;
  let decoded;
  try {
    decoded = decodeURIComponent(filename);
  } catch {
    return false;
  }
  // CMS uploads retain their original names. Accept spaces, Unicode and case,
  // but keep both literal and encoded paths confined to one MP3 filename.
  return !/[/\\?#\u0000-\u001f\u007f]/.test(decoded) &&
    !/%(?:2f|5c)/i.test(decoded) && /\.mp3$/i.test(decoded) &&
    decoded.slice(0, -4).trim().length > 0;
}
