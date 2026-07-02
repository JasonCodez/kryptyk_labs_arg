export async function isValidWordScryGuess(word: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/wordscry/validate?word=${encodeURIComponent(word)}`);
    if (!res.ok) return true; // fail-open: don't block play if the check itself errors
    const data = await res.json();
    return data.valid !== false;
  } catch {
    return true; // fail-open on network errors
  }
}
