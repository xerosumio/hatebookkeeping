const TOKEN_KEY = 'hbk-web-token';

export function getWebToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setWebToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private mode */
  }
}

export function clearWebToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } catch {
    /* private mode */
  }
}

export function shouldRedirectToLogin(pathname: string): boolean {
  return pathname !== '/auth/callback' && pathname !== '/login';
}

export function safeReturnPath(returnTo: string, origin = typeof window !== 'undefined' ? window.location.origin : ''): string {
  try {
    const url = new URL(returnTo, origin || 'http://localhost');
    if (origin && url.origin !== origin) return '/';
    const path = `${url.pathname}${url.search}`;
    if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/auth/')) return '/';
    return path || '/';
  } catch {
    return '/';
  }
}
