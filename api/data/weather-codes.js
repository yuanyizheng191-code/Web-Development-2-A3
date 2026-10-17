/**
 * @module data/weather-codes
 * @description
 * WMO weather interpretation codes returned by the Open-Meteo API, translated
 * into something a human can read (this translation step).
 *
 * IMPORTANT - WHY THE ICONS ARE WRITTEN AS ESCAPE SEQUENCES
 * Each icon is a JavaScript `\u{...}` escape rather than a literal emoji.
 * Emoji live outside the Basic Multilingual Plane, so a literal one occupies
 * several UTF-8 bytes and is easily corrupted by any editor or script that
 * guesses the wrong encoding. Written as escapes the source file stays pure
 * ASCII, is unambiguous in a diff, and still hands the browser a real emoji at
 * run time. (This file was in fact damaged exactly that way during development,
 * which is why the defensive form is used.)
 *
 * This table is published three ways so the same data is reused everywhere:
 *   * `module.exports`                - required by the Node API
 *   * `globalThis.WMO_WEATHER_CODES`  - usable directly from a browser <script>
 *   * copyable into an Angular asset if a page ever needs it
 *
 */
(function (root, factory) {
  const table = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = table;
  }
  if (root) {
    root.WMO_WEATHER_CODES = table;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  /**
   * WMO code -> `{ description, icon }`.
   * Descriptions follow the table given in the assessment brief; the icon is an
   * emoji so the user interface needs no image downloads.
   *
   * @constant {Object<number, {description: string, icon: string}>}
   */
  const CODES = {
    0: { description: 'Clear sky', icon: '\u2600\uFE0F' },
    1: { description: 'Mainly clear', icon: '\u{1F324}\uFE0F' },
    2: { description: 'Partly cloudy', icon: '\u26C5' },
    3: { description: 'Overcast', icon: '\u2601\uFE0F' },
    45: { description: 'Fog', icon: '\u{1F32B}\uFE0F' },
    48: { description: 'Depositing rime fog', icon: '\u{1F32B}\uFE0F' },
    51: { description: 'Drizzle: light', icon: '\u{1F326}\uFE0F' },
    53: { description: 'Drizzle: moderate', icon: '\u{1F326}\uFE0F' },
    55: { description: 'Drizzle: dense', icon: '\u{1F327}\uFE0F' },
    56: { description: 'Freezing drizzle: light', icon: '\u{1F327}\uFE0F' },
    57: { description: 'Freezing drizzle: dense', icon: '\u{1F327}\uFE0F' },
    61: { description: 'Rain: light', icon: '\u{1F326}\uFE0F' },
    63: { description: 'Rain: moderate', icon: '\u{1F327}\uFE0F' },
    65: { description: 'Rain: heavy', icon: '\u{1F327}\uFE0F' },
    66: { description: 'Freezing rain: light', icon: '\u{1F327}\uFE0F' },
    67: { description: 'Freezing rain: heavy', icon: '\u{1F327}\uFE0F' },
    71: { description: 'Snow fall: light', icon: '\u{1F328}\uFE0F' },
    73: { description: 'Snow fall: moderate', icon: '\u{1F328}\uFE0F' },
    75: { description: 'Snow fall: heavy', icon: '\u2744\uFE0F' },
    77: { description: 'Snow grains', icon: '\u{1F328}\uFE0F' },
    80: { description: 'Rain showers: light', icon: '\u{1F326}\uFE0F' },
    81: { description: 'Rain showers: moderate', icon: '\u{1F327}\uFE0F' },
    82: { description: 'Rain showers: violent', icon: '\u26C8\uFE0F' },
    85: { description: 'Snow showers: light', icon: '\u{1F328}\uFE0F' },
    86: { description: 'Snow showers: heavy', icon: '\u2744\uFE0F' },
    95: { description: 'Thunderstorm: slight or moderate', icon: '\u26C8\uFE0F' },
    96: { description: 'Thunderstorm with slight hail', icon: '\u26C8\uFE0F' },
    99: { description: 'Thunderstorm with heavy hail', icon: '\u26C8\uFE0F' },
  };

  /**
   * Turn a raw WMO weather code into a readable description and icon.
   *
   * @param {number} code WMO interpretation code returned by Open-Meteo.
   * @returns {{description: string, icon: string}} Friendly text plus an emoji.
   *   An unknown code returns a safe placeholder rather than throwing, because a
   *   new code appearing upstream must never break the event page.
   */
  function describe(code) {
    return CODES[code] || { description: 'Unknown weather condition', icon: '\u2753' };
  }

  return { CODES, describe };
});
