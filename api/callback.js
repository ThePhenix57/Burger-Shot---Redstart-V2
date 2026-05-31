import querystring from 'querystring';

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.redirect('/?error=no_code');

  const CLIENT_ID     = process.env.DISCORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  const REDIRECT_URI  = process.env.DISCORD_REDIRECT_URI;
  const SUPABASE_URL  = process.env.SUPABASE_URL;
  const SUPABASE_KEY  = process.env.SUPABASE_KEY;

  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('MISSING ENV VARS:', { CLIENT_ID:!!CLIENT_ID, CLIENT_SECRET:!!CLIENT_SECRET, REDIRECT_URI:!!REDIRECT_URI, SUPABASE_URL:!!SUPABASE_URL, SUPABASE_KEY:!!SUPABASE_KEY });
    return res.redirect('/?error=missing_env');
  }

  try {
    // 1) Échange le code contre un token Discord
    const body = querystring.stringify({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  REDIRECT_URI,
    });

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const token = await tokenRes.json();
    console.log('Token response:', JSON.stringify(token));
    if (!token.access_token) {
      console.error('No access_token, discord said:', JSON.stringify(token));
      return res.redirect('/?error=no_token');
    }

    // 2) Récupère l'utilisateur Discord
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const du = await userRes.json();
    console.log('Discord user:', du.id, du.username);

    // 3) IDs direction & gouvernement (accès direct sans Supabase)
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
      console.log('Supabase result:', JSON.stringify(empArr));
      if (!Array.isArray(empArr) || !empArr.length) {
        return res.redirect('/?error=not_registered');
      }
      empRow = empArr[0];
    }

    // 4) Redirige vers dashboard
    const params = querystring.stringify({
      id:       du.id,
      username: du.username,
      avatar:   du.avatar || '',
      nom:      empRow?.nom    || '',
      prenom:   empRow?.prenom || '',
    });

    console.log('Redirecting to dashboard');
    res.redirect(`/dashboard.html?${params}`);

  } catch (err) {
    console.error('CALLBACK ERROR:', err.message, err.stack);
    res.redirect('/?error=server_error');
  }
}
