/**
 * Post-process Thai speech-recognition output so mixed TH/EN/number speech
 * (e.g. machine serial numbers) keeps Latin letters and digits intact.
 *
 * The Thai recognition engine often renders English letters as Thai letter
 * names ("เอ บี หนึ่ง สอง") and digits as Thai words or Thai numerals.
 * We only convert those tokens when they appear inside a "code-like" run
 * (a space-separated group that already contains a Latin letter or digit),
 * so ordinary Thai prose is never mangled.
 */

const THAI_DIGIT_WORDS: Record<string, string> = {
  "ศูนย์": "0", "หนึ่ง": "1", "สอง": "2", "สาม": "3", "สี่": "4",
  "ห้า": "5", "หก": "6", "เจ็ด": "7", "แปด": "8", "เก้า": "9",
};

const THAI_LETTER_NAMES: Record<string, string> = {
  "เอ": "A", "บี": "B", "ซี": "C", "ดี": "D", "อี": "E", "เอฟ": "F",
  "จี": "G", "เอช": "H", "ไอ": "I", "เจ": "J", "เค": "K", "แอล": "L",
  "เอ็ม": "M", "เอ็น": "N", "โอ": "O", "พี": "P", "คิว": "Q", "อาร์": "R",
  "เอส": "S", "ที": "T", "ยู": "U", "วี": "V", "ดับเบิลยู": "W",
  "เอ็กซ์": "X", "วาย": "Y", "แซด": "Z", "แซดดี้": "Z",
};

const THAI_NUMERALS: Record<string, string> = {
  "๐": "0", "๑": "1", "๒": "2", "๓": "3", "๔": "4",
  "๕": "5", "๖": "6", "๗": "7", "๘": "8", "๙": "9",
};

const isLatinOrDigit = (t: string) => /^[A-Za-z0-9-]+$/.test(t);
const hasThaiNumeral = (t: string) => /[๐-๙]/.test(t);

function convertThaiNumerals(token: string): string {
  return token.replace(/[๐-๙]/g, (c) => THAI_NUMERALS[c] ?? c);
}

/** True when a token can be part of a spoken serial/code sequence. */
function isCodeToken(token: string): boolean {
  return (
    isLatinOrDigit(token) ||
    hasThaiNumeral(token) ||
    token in THAI_DIGIT_WORDS ||
    token in THAI_LETTER_NAMES
  );
}

function convertToken(token: string): string {
  if (hasThaiNumeral(token)) return convertThaiNumerals(token);
  if (token in THAI_DIGIT_WORDS) return THAI_DIGIT_WORDS[token];
  if (token in THAI_LETTER_NAMES) return THAI_LETTER_NAMES[token];
  return token;
}

/**
 * Normalize one recognized phrase.
 * - Thai numerals (๐-๙) always become Arabic digits — they are unambiguous.
 * - Thai digit words and letter names convert only inside a code-like run
 *   (a group of >=2 code tokens with at least one Latin/digit anchor),
 *   which is then joined without spaces: "เอ บี หนึ่ง สอง สาม" -> "AB123".
 * - Everything else is returned untouched.
 */
export function normalizeVoiceTranscript(text: string): string {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";

  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    // Thai numerals are always safe to convert, even standalone.
    if (hasThaiNumeral(tokens[i]) && !/^[0-9]+$/.test(convertThaiNumerals(tokens[i]))) {
      out.push(convertThaiNumerals(tokens[i]));
      i++;
      continue;
    }
    if (!isCodeToken(tokens[i])) {
      out.push(tokens[i]);
      i++;
      continue;
    }
    // Collect the maximal run of code tokens.
    let j = i;
    while (j < tokens.length && isCodeToken(tokens[j])) j++;
    const run = tokens.slice(i, j);
    const anchored = run.some((t) => isLatinOrDigit(t) || hasThaiNumeral(t));
    if (run.length >= 2 && anchored) {
      out.push(run.map(convertToken).join(""));
    } else if (run.length >= 3 && run.every((t) => t in THAI_DIGIT_WORDS || t in THAI_LETTER_NAMES || hasThaiNumeral(t))) {
      // Pure spoken code like "เอ บี หนึ่ง สอง สาม" (3+ tokens) — very likely a serial.
      out.push(run.map(convertToken).join(""));
    } else {
      out.push(...run.map((t) => (hasThaiNumeral(t) ? convertThaiNumerals(t) : t)));
    }
    i = j;
  }
  return out.join(" ");
}
