export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.redirect('/gouv.html?error=no_code');

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

  if (!token.access_token) return res.redirect('/gouv.html?error=token_error');

  // Récupérer les infos Discord
  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const user = await userRes.json();

  if (!user.id) return res.redirect('/gouv.html?error=user_error');

  // Vérifier si c'est un employé Burger Shot
  const empCheck = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/employes?discord_id=eq.${user.id}`,
    {
      headers: {
        apikey: process.env.SUPABASE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
      },
    }
  );
  const employes = await empCheck.json();
  if (employes?.length) {
    return res.redirect('/gouv.html?error=est_employe');
  }

  // OK → rediriger vers gouv.html avec les infos
  res.redirect(
    `/gouv.html?uid=${user.id}&username=${encodeURIComponent(user.username)}&avatar=${user.avatar || ''}`
  );
}
