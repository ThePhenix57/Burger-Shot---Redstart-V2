import {
  getOrigin,
  getSupabaseConfig,
  exchangeDiscordCode,
  sessionRedirectHtml,
} from './lib.js';

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.redirect('/point.html?error=no_code');

  const REDIRECT_URI = process.env.REDIRECT_URI_POINTS || `${getOrigin(req)}/api/callback-points`;
  const sb = getSupabaseConfig();

  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !REDIRECT_URI || !sb.url || !sb.key) {
    return res.redirect('/point.html?error=missing_env');
  }

  try {
    const user = await exchangeDiscordCode(code, REDIRECT_URI);
    if (!user) return res.redirect('/point.html?error=no_token');

    const payload = {
      id: user.id,
      username: user.username,
      avatar: user.avatar || '',
    };

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(
      sessionRedirectHtml('bs_points_user', payload, '/point.html', '/point.html?error=storage_error')
    );
  } catch (err) {
    console.error('CALLBACK-POINTS ERROR:', err.message);
    return res.redirect('/point.html?error=server_error');
  }
}
