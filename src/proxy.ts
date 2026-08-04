import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

export async function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';
  const searchParams = req.nextUrl.searchParams.toString();
  const path = `${url.pathname}${searchParams.length > 0 ? `?${searchParams}` : ''}`;

  let baseDomain = '';
  try {
    const baseUrl = `${url.protocol}//${hostname}`;
    const res = await fetch(`${baseUrl}/api/settings/base-domain`);
    if (res.ok) {
      const json = await res.json();
      baseDomain = json.data || '';
    }
  } catch (error) {
    console.error('Proxy base-domain fetch error:', error);
  }

  const currentHost = hostname.split(':')[0];
  const baseDomainWithoutPort = baseDomain.split(':')[0];

  let isSubdomain = false;
  let subdomain = '';
  let matchedSlug = '';

  try {
    const baseUrl = `${url.protocol}//${hostname}`;
    const lpRes = await fetch(`${baseUrl}/api/landing-pages`);
    if (lpRes.ok) {
      const json = await lpRes.json();
      const pages = json.data || [];
      const matchedPage = pages.find((page: { domain?: string; domain_status?: string; slug?: string }) => {
        return page.domain === currentHost && page.domain_status === 'active';
      });

      if (matchedPage?.slug) {
        matchedSlug = matchedPage.slug;
      }
    }
  } catch (error) {
    console.error('Proxy landing-page fetch error:', error);
  }

  if (matchedSlug) {
    return NextResponse.rewrite(new URL(`/lp/${matchedSlug}${path === '/' ? '' : path}`, req.url));
  }

  if (baseDomainWithoutPort && currentHost !== baseDomainWithoutPort) {
    if (currentHost.endsWith(`.${baseDomainWithoutPort}`)) {
      isSubdomain = true;
      subdomain = currentHost.replace(`.${baseDomainWithoutPort}`, '');
    }
  } else if (!baseDomainWithoutPort && currentHost.endsWith('.lvh.me')) {
    isSubdomain = true;
    subdomain = currentHost.replace('.lvh.me', '');
  }

  if (isSubdomain && subdomain !== 'www' && subdomain !== '') {
    return NextResponse.rewrite(new URL(`/lp/${subdomain}${path === '/' ? '' : path}`, req.url));
  }

  return NextResponse.next();
}
