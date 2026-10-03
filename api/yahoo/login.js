// /api/yahoo/login?key=ADMIN_KEY : starts the one-time Yahoo sign-in. The league is private,
// so a league member (Matt) signs in once; after that the saved refresh token keeps it connected.
import { isAdmin, authorizeUrl, redirectUri } from '../_yahoo.js';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!isAdmin(url)) return new Response('Not allowed.', { status: 403 });
    if (!process.env.YAHOO_CLIENT_ID || !process.env.YAHOO_CLIENT_SECRET) return new Response('Set YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET in Vercel first.', { status: 500 });
    // Sign in on the same host Yahoo returns to, so the state cookie comes back with it.
    const home = new URL(redirectUri()).origin;
    if (url.origin != home) return Response.redirect(home + url.pathname + url.search, 302);
    const state = crypto.randomUUID();
    return new Response(null, {
      status: 302,
      headers: {
        location: authorizeUrl(url.origin, state),
        'set-cookie': `yahoo_state=${state}; Path=/api/yahoo; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
        'cache-control': 'no-store'
      }
    });
  }
};
