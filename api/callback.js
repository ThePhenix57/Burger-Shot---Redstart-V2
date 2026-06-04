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
    return res.redirect('/?error=missing_env');
  }

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: querystring.stringify({
        client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI,
      }),
    });
    const token = await tokenRes.json();
    if (!token.access_token) return res.redirect('/?error=no_token');

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const du = await userRes.json();

    const DIR_IDS = ['280415204477501451','1157333780898529333','370510144766738432'];
    const isPriv  = DIR_IDS.includes(du.id);

    let empRow = null;

    if (!isPriv) {
      const empRes = await fetch(
        `${SUPABASE_URL}/rest/v1/employes?discord_id=eq.${du.id}&select=*`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const empArr = await empRes.json();

      if (!Array.isArray(empArr) || !empArr.length) {
        // Pas un employé → vérifier si c'est un compte gouvernement
        const gouvRes = await fetch(
          `${SUPABASE_URL}/rest/v1/gouvernement_comptes?discord_id=eq.${du.id}&statut=eq.actif&select=id`,
          { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        );
        const gouvArr = await gouvRes.json();
        if (Array.isArray(gouvArr) && gouvArr.length) {
          return res.redirect('/gouv.html');
        }
        return res.redirect('/?error=not_registered');
      }

      empRow = empArr[0];
    }

    const payload = JSON.stringify({
      id:     du.id,
      username: du.username,
      avatar: du.avatar || '',
      nom:    empRow?.nom    || '',
      prenom: empRow?.prenom || '',
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<script>
try {
  localStorage.setItem('bs_user', ${JSON.stringify(payload)});
  window.location.replace('/dashboard.html');
} catch(e) {
  window.location.replace('/?error=storage_error');
}
</script>
</body></html>`);

  } catch (err) {
    console.error('CALLBACK ERROR:', err.message);
    return res.redirect('/?error=server_error');
  }
}
