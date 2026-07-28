/**
 * URL Shortener Resolver & Cache Helper
 * Resolves shortener URLs (bit.ly, shorturl.at, s.id, etc.) to their final destination URLs.
 */

const shortenerDomains = new Set([
  'shorturl.at',
  'bit.ly',
  'tinyurl.com',
  's.id',
  'surl.li',
  'tiny.cc',
  'cutt.ly',
  'is.gd',
  'rb.gy',
  't.co',
  'goo.gl',
  'linktr.ee',
  'heylink.me',
  'go.fliplink.me',
  'acesse.one',
  'canva.link',
  'canva.site',
  'my.canva.site'
]);

// In-memory cache for resolved URLs
const resolvedUrlCache = new Map<string, string>();

export function isShortenerUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    for (const sDom of shortenerDomains) {
      if (host === sDom || host.endsWith('.' + sDom)) {
        return true;
      }
    }
  } catch (e) {
    // Ignore invalid URL
  }
  return false;
}

export async function resolveUrl(rawUrl: string): Promise<string> {
  let cleanUrl = rawUrl.trim().replace(/[.,;)]+$/, '');
  if (!isShortenerUrl(cleanUrl)) {
    return cleanUrl;
  }

  if (resolvedUrlCache.has(cleanUrl)) {
    return resolvedUrlCache.get(cleanUrl)!;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout

    // Try HEAD request first
    let response = await fetch(cleanUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    }).catch(() => null);

    clearTimeout(timeoutId);

    // Fallback to GET if HEAD method fails or is forbidden
    if (!response || !response.url || response.status === 405 || response.status === 403) {
      const getController = new AbortController();
      const getTimeoutId = setTimeout(() => getController.abort(), 4000);

      response = await fetch(cleanUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: getController.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }).catch(() => null);

      clearTimeout(getTimeoutId);
    }

    if (response && response.url && response.url !== cleanUrl) {
      const finalUrl = response.url;
      resolvedUrlCache.set(cleanUrl, finalUrl);
      return finalUrl;
    }
  } catch (err: any) {
    console.warn(`[URL Resolver] Could not resolve shortener ${cleanUrl}:`, err?.message || err);
  }

  // Fallback to original URL if resolution failed
  resolvedUrlCache.set(cleanUrl, cleanUrl);
  return cleanUrl;
}

export async function resolveTextUrls(text: string | null | undefined): Promise<string> {
  if (!text) return '';

  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  const matches = text.match(urlRegex) || [];
  const uniqueUrls = Array.from(new Set(matches));

  // Fast-path: if no shortener URLs found, return original text immediately
  const shortenerUrls = uniqueUrls.filter(u => isShortenerUrl(u));
  if (shortenerUrls.length === 0) return text;

  let resolvedText = text;
  for (const rawUrl of shortenerUrls) {
    const resolved = await resolveUrl(rawUrl);
    if (resolved && resolved !== rawUrl) {
      resolvedText = resolvedText.split(rawUrl).join(resolved);
    }
  }

  return resolvedText;
}
