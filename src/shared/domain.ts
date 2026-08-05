// TabCraft — Domain extraction, shared by background classification and the
// side panel's domain statistics. Pure, chrome-free.

/** Extract domain from URL (hostname minus the www. prefix). */
export function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    // Remove www. prefix
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
