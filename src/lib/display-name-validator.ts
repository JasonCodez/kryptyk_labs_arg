// Attempt to use the external blacklist package when available; fall back to a small internal list.
let externalBannedWords: string[] | null = null;
try {
  // try common CJS/ESM shapes
   
  const lib = require('the-big-username-blacklist');
  if (Array.isArray(lib)) externalBannedWords = lib as string[];
  else if (Array.isArray((lib as any).default)) externalBannedWords = (lib as any).default as string[];
  else if (typeof (lib as any).getList === 'function') {
    const maybe = (lib as any).getList();
    if (Array.isArray(maybe)) externalBannedWords = maybe;
  }
} catch {
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

// Reserved names that could impersonate staff, the platform, or system accounts.
const reservedNames: string[] = [
  // Platform / brand
  'puzzlewarz', 'puzzle_warz', 'puzzlewarz_', 'puzzlwarz',
  'admin', 'administrator', 'mod', 'moderator',
  'support', 'helpdesk', 'help',
  'staff', 'team', 'official', 'verified',
  'system', 'sysadmin', 'root', 'superuser',
  // Common impersonation targets
  'owner', 'founder', 'ceo', 'developer', 'dev',
  'webmaster', 'postmaster', 'noreply', 'no_reply',
  'info', 'contact', 'abuse', 'security',
  // Generic reserved
  'null', 'undefined', 'anonymous', 'unknown',
  'deleted', 'banned', 'suspended',
  'bot', 'robot', 'automod',
  'test', 'testing', 'debug',
];

export function isAllowedDisplayName(name: string) {
  if (!name || typeof name !== 'string') return { ok: false, reason: 'Name required' };
  const trimmed = name.trim();
  const re = /^[A-Za-z0-9]{3,16}$/;
  if (!re.test(trimmed)) return { ok: false, reason: 'Name must be 3-16 characters and contain only letters and numbers' };

  const lower = trimmed.toLowerCase();

  // Check reserved / impersonation names (exact match)
  if (reservedNames.includes(lower)) return { ok: false, reason: 'This name is reserved and cannot be used' };

  // Check if name contains a reserved word as a substring (catches "admin123", "theadmin", etc.)
  for (const reserved of ['admin', 'moderator', 'support', 'staff', 'official', 'puzzlewarz']) {
    if (lower.includes(reserved)) return { ok: false, reason: 'This name is reserved and cannot be used' };
  }

  // Check profanity
  for (const bad of bannedWords) {
    if (lower.includes(bad)) return { ok: false, reason: 'Name contains inappropriate language' };
  }

  return { ok: true };
}

export default isAllowedDisplayName;
