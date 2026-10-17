/**
 * app/core/utils/datetime.ts
 * Conversions between MySQL DATETIME strings and the value format required by
 * <input type="datetime-local">.
 *
 *   MySQL / API : '2026-11-15 08:00:00'
 *   date input  : '2026-11-15T08:00'
 *
 * Getting this wrong is the classic admin-form bug: the date box appears empty
 * and saving wipes the event date, so the conversion is done in one tested place.
 *
 */

/** 'YYYY-MM-DD HH:MM:SS' -> 'YYYY-MM-DDTHH:MM' for a datetime-local input. */
export function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value);
  if (!match) return '';
  const [, y, mo, d, hh, mi] = match;
  return `${y}-${mo}-${d}T${hh}:${mi}`;
}

/**
 * 'YYYY-MM-DDTHH:MM' (from the input) -> 'YYYY-MM-DD HH:MM:SS' for the API.
 * The browser only supplies minutes, so seconds are completed with :00.
 */
export function fromDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return String(value);
  const [, y, mo, d, hh, mi] = match;
  return `${y}-${mo}-${d} ${hh}:${mi}:00`;
}
