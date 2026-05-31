export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.redirect('/?error=no_code');

  const CLIENT_ID     = process.env.DISCORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  const REDIRECT_URI  = process.env.DISCORD_REDIRECT_URI;
  const SUPABASE_URL  = process.env.SUPABASE_URL;
  const SUPABASE_KEY  = process.env.SUPABASE_KEY;

  try {
    // 1) Échange le code contre un token Discord
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    const token = await tokenRes.json();
    if (!token.access_token) throw new Error('no_token');

    // 2) Récupère l'utilisateur Discord
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const du = await userRes.json();

    // 3) Vérifie si l'ID est dans employes OU dans les IDs direction/gouv hardcodés
    const DIR_IDS  = ['280415204477501451','1157333780898529333','370510144766738432'];
    const GOUV_IDS = [];
    const isPriv   = DIR_IDS.includes(du.id) || GOUV_IDS.includes(du.id);

    let empRow = null;
    if (!isPriv) {
      const empRes = await fetch(
        `${SUPABASE_URL}/rest/v1/employes?discord_id=eq.${du.id}&select=*`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const empArr = await empRes.json();
      if (!empArr?.length) return res.redirect('/?error=not_registered');
      empRow = empArr[0];
    }

    // 4) Redirige vers dashboard avec les params en query string (pas d'encodage JSON complexe)
    const params = new URLSearchParams({
      id:       du.id,
      username: du.username,
      avatar:   du.avatar || '',
    });
    if (empRow) {
      params.set('nom',    empRow.nom    || '');
      params.set('prenom', empRow.prenom || '');
    }
    res.redirect(`/dashboard.html?${params.toString()}`);

  } catch (err) {
    console.error(err);
    res.redirect('/?error=server_error');
  }
}
