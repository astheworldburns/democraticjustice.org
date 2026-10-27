const historyFields = ["updated", "update_note", "correction_note"];

function dateValue(value) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : "";
  }
  return value == null ? "" : String(value).trim();
}

function isoTime(value, { allowDateOnly = false } = {}) {
  const text = dateValue(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2}))?$/);
  if (!match || (!match[4] && !allowDateOnly)) return NaN;
  const [, yearText, monthText, dayText, hour, minute, second, , zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > monthDays[month - 1] ||
    Number(hour || 0) > 23 || Number(minute || 0) > 59 || Number(second || 0) > 59) return NaN;
  if (zone && zone !== "Z" && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4, 6)) > 59)) return NaN;
  return Date.parse(text);
}

function normalizedFields(raw) {
  const fields = {};
  for (const field of historyFields) {
    if (!Object.hasOwn(raw, field)) continue;
    fields[field] = field === "updated" ? dateValue(raw[field]) : String(raw[field] || "").replace(/\r\n?/g, "\n").trim();
  }
  return fields;
}

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function normalizeArticleHistory(raw = {}, current = {}) {
  const next = { ...normalizedFields(current), ...normalizedFields(raw) };
  const publication = Object.hasOwn(raw, "date") ? raw.date : current.date;
  if (next.updated) {
    const updatedTime = isoTime(next.updated);
    const publishedTime = isoTime(publication, { allowDateOnly: true });
    if (!Number.isFinite(updatedTime)) {
      throw invalid("Updated date must be a valid ISO date and time with a timezone.");
    }
    if (!Number.isFinite(publishedTime) || updatedTime <= publishedTime) {
      throw invalid("Updated date must be later than the original publication date.");
    }
  }
  if ((next.update_note || next.correction_note) && !next.updated) {
    throw invalid("Add an updated date when entering an update or correction note.");
  }
  return next;
}

export function getArticleHistory(data = {}) {
  const empty = { updated: "", update_note: "", correction_note: "" };
  try {
    const history = normalizeArticleHistory(data);
    return history.updated ? { ...empty, ...history, updated: new Date(isoTime(history.updated)).toISOString() } : empty;
  } catch {
    return empty;
  }
}
