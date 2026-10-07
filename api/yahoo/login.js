// /api/yahoo/login : starts the one-time Yahoo sign-in. The league is private, so a league
// member (Matt) signs in once; after that the saved refresh token keeps it connected.
// GET shows a form for the admin key; the form POSTs it here, then we hand off to Yahoo.
import { isAdmin, keyForm, authorizeUrl, redirectUri } from '../_yahoo.js';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    // Sign in on the same host Yahoo returns to, so the state cookie comes back with it.
    const home = new URL(redirectUri()).origin;
    if (url.origin != home) return Response.redirect(home + url.pathname, 302);
    const note = url.searchParams.has('key') ? '<p>Keys in the address bar aren’t accepted any more. Enter it below.</p>' : '';
    if (request.method != 'POST') return keyForm('Connect 9FEAMG to Yahoo', home + url.pathname, 'Continue to Yahoo', note);
    if (!(await isAdmin(request))) return new Response('Not allowed.', { status: 403 });
    if (!process.env.YAHOO_CLIENT_ID || !process.env.YAHOO_CLIENT_SECRET) return new Response('Set YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET in Vercel first.', { status: 500 });
    const state = crypto.randomUUID();
    return new Response(null, {
      status: 303,
      headers: {
        location: authorizeUrl(url.origin, state),
        'set-cookie': `yahoo_state=${state}; Path=/api/yahoo; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
        'cache-control': 'no-store'
      }
    });
  }
};
