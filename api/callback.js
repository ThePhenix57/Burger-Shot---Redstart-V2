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
    console.error('MISSING ENV VARS');
    return res.redirect('/?error=missing_env');
  }

  try {
    // 1) Échange code → token Discord
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: querystring.stringify({
        client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI,
      }),
    });
    const token = await tokenRes.json();
    if (!token.access_token) {
      console.error('No token:', JSON.stringify(token));
      return res.redirect('/?error=no_token');
    }

    // 2) Info utilisateur Discord
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const du = await userRes.json();

    // 3) Direction / gouvernement ou employé Supabase
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
      if (!Array.isArray(empArr) || !empArr.length) return res.redirect('/?error=not_registered');
      empRow = empArr[0];
    }

    // 4) Encode les données en base64 dans un cookie de session puis redirige proprement
    const userData = Buffer.from(JSON.stringify({
      id:       du.id,
      username: du.username,
      avatar:   du.avatar || '',
      nom:      empRow?.nom    || '',
      prenom:   empRow?.prenom || '',
    })).toString('base64');

    // On passe par /auth.html (page intermédiaire invisible) qui stocke en sessionStorage
    res.redirect(`/auth.html#${userData}`);

  } catch (err) {
    console.error('CALLBACK ERROR:', err.message);
    res.redirect('/?error=server_error');
  }
}
