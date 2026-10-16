/**
 * app/core/utils/format.ts
 * Small pure helpers shared by every component template.
 *
 * The API returns MySQL style date strings ('2026-11-15 08:00:00'), which must
 * be parsed MANUALLY.  `new Date('2026-11-15 08:00:00')` is not reliable across
 * browsers (Safari rejects it), so the parts are split out by hand - this also
 * keeps the displayed time exactly the time stored in the database, with no
 * timezone shifting.
 *
 */

/** Parse 'YYYY-MM-DD HH:MM:SS' or 'YYYY-MM-DDTHH:MM:SS' into a local Date. */
export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(value);
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const [, y, mo, d, hh = '00', mi = '00', ss = '00'] = match;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mi), Number(ss));
}

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};

/** 'Sat 15 November 2026' */
export function formatDate(value: string | null | undefined): string {
  const date = parseApiDate(value);
  return date ? date.toLocaleDateString('en-AU', DATE_OPTIONS) : '-';
}

/** '08:00 AM' */
export function formatTime(value: string | null | undefined): string {
  const date = parseApiDate(value);
  return date ? date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) : '-';
}

/** 'Sat 15 November 2026, 8:00 am' */
export function formatDateTime(value: string | null | undefined): string {
  const date = parseApiDate(value);
  return date ? `${formatDate(value)}, ${formatTime(value)}` : '-';
}

/** How many days until the event (negative when it is in the past). */
export function daysUntil(value: string | null | undefined): number | null {
  const date = parseApiDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** '$1,234.50' (the case study uses Australian dollars). */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(value);
}

/** 'Free' for a zero price, otherwise the currency amount. */
export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Free';
  return Number(value) === 0 ? 'Free' : formatCurrency(value);
}

/**
 * '$50,000' - currency rounded to whole dollars.
 * Used for fundraising totals where cents are just noise.
 */
export function formatCurrencyWhole(value: number | null | undefined): string {
  if (value === null || value === undefined) return '$0';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Percentage of the fundraising goal reached, capped at 100. */
export function goalPercent(raised: number | null, goal: number | null): number {
  if (!goal || goal <= 0) return 0;
  return Math.min(100, Math.round(((raised ?? 0) / goal) * 100));
}

/** CSS class suffix used to colour a status badge. */
export function statusClass(status: string | null | undefined): string {
  switch (status) {
    case 'active':
      return 'badge--active';
    case 'upcoming':
      return 'badge--upcoming';
    case 'suspended':
      return 'badge--suspended';
    case 'past':
      return 'badge--past';
    default:
      return 'badge--unknown';
  }
}

/**
 * Turn a stored image path into something the browser can load.
 * The A2 seed data references 'images/funrun.jpg'; when that file is missing the
 * <img> onError handler swaps in a generated gradient placeholder, so the site
 * never shows a broken image icon.
 */
export function resolveImage(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url;
  return url.startsWith('/') ? url : `/${url}`;
}
