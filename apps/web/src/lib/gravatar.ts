/**
 * Gravatar image URL from email (SHA-256 of trimmed lowercase email).
 * @see https://docs.gravatar.com/general/hash/
 */
export async function getGravatarUrl(
  email: string,
  sizePx = 160,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const msgBuffer = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const params = new URLSearchParams({
    s: String(sizePx),
    d: "404",
    r: "g",
  });
  return `https://www.gravatar.com/avatar/${hashHex}?${params.toString()}`;
}
