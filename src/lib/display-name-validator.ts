// Attempt to use the external blacklist package when available; fall back to a small internal list.
let externalBannedWords: string[] | null = null;
try {
  // try common CJS/ESM shapes
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const lib = require('the-big-username-blacklist');
  if (Array.isArray(lib)) externalBannedWords = lib as string[];
  else if (Array.isArray((lib as any).default)) externalBannedWords = (lib as any).default as string[];
  else if (typeof (lib as any).getList === 'function') {
    const maybe = (lib as any).getList();
    if (Array.isArray(maybe)) externalBannedWords = maybe;
  }
} catch (e) {
  // package not installed or import failed - we'll use fallback
}

export const bannedWords: string[] = externalBannedWords || [
  // Expanded conservative fallback list (lowercase). Includes common sexual terms.
  'fuck',
  'fucker',
  'shit',
  'bitch',
  'asshole',
  'dick',
  'penis',
  'vagina',
  'cunt',
  'bollock',
  'damn',
  'bastard',
  'blowjob',
  'handjob',
  'fellatio',
  'pussy',
  'clit',
  'cunnilingus',
  'oral',
  'porn',
  'xxx',
  'anal',
  'orgasm',
  'masturb',
  'tits',
  'tit',
  'boob',
  'whore',
  'slut',
  'skank',
  'hooker',
  'pornhub',
  'xvideo',
  'sex',
];

// If the external list wasn't loaded, surface a debug warning in Node logs to assist diagnosis.
if (!externalBannedWords && typeof console !== 'undefined' && typeof console.warn === 'function') {
  try { console.warn('display-name-validator: external blacklist not loaded; using internal fallback list'); } catch (e) {}
}

export function isAllowedDisplayName(name: string) {
  if (!name || typeof name !== 'string') return { ok: false, reason: 'Name required' };
  const trimmed = name.trim();
  const re = /^[A-Za-z0-9]{3,16}$/;
  if (!re.test(trimmed)) return { ok: false, reason: 'Name must be 3-16 characters and contain only letters and numbers' };

  const lower = trimmed.toLowerCase();
  for (const bad of bannedWords) {
    if (lower.includes(bad)) return { ok: false, reason: 'Name contains inappropriate language' };
  }

  return { ok: true };
}

export default isAllowedDisplayName;
