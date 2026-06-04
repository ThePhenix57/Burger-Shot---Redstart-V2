export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.redirect('/?error=no_code');

  // Échanger le code contre un token
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.REDIRECT_URI_GOUV,
    }),
  });
  const token = await tokenRes.json();

  // Récupérer les infos Discord
  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const user = await userRes.json();

  // Rediriger vers gouv.html avec les infos en query params
  res.redirect(`/gouv.html?uid=${user.id}&username=${encodeURIComponent(user.username)}&avatar=${user.avatar || ''}`);
}
