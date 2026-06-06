import querystring from 'querystring';

const DIR_IDS = ['280415204477501451', '1157333780898529333', '370510144766738432'];

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function supabaseGet(endpoint) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  return res.json();
}

function sessionHtml(key, payload, redirect) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<script>
try {
  localStorage.setItem('${key}', ${JSON.stringify(JSON.stringify(payload))});
  window.location.replace('${redirect}');
} catch(e) { window.location.replace('/?error=storage_error'); }
</script></body></html>`;
}

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.redirect('/?error=no_code');

  const CLIENT_ID     = process.env.DISCORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  const REDIRECT_URI  = process.env.DISCORD_REDIRECT_URI;

  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI || !SUPABASE_URL || !SUPABASE_KEY) {
    return res.redirect('/?error=missing_env');
  }

  try {
    // 1. Échanger le code Discord contre un token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: querystring.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    const token = await tokenRes.json();
    if (!token.access_token) return res.redirect('/?error=token_error');

    // 2. Récupérer l'utilisateur Discord
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const du = await userRes.json();
    if (!du.id) return res.redirect('/?error=user_error');

    // 3. Direction hardcodée
    if (DIR_IDS.includes(du.id)) {
      const payload = { id: du.id, username: du.username, avatar: du.avatar || '', nom: '', prenom: '', role: 'direction' };
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(sessionHtml('bs_user', payload, '/dashboard.html'));
    }

    // 4. Vérifier dans comptes_dashboard
    const comptes = await supabaseGet(`comptes_dashboard?discord_id=eq.${du.id}&select=*`);
    if (!Array.isArray(comptes) || !comptes.length) return res.redirect('/?error=not_registered');

    const compte = comptes[0];
    if (!compte.actif || compte.statut === 'revoque') return res.redirect('/?error=revoque');
    if (compte.statut === 'suspendu') return res.redirect('/?error=suspendu');

    // 5. Gouvernement
    if (compte.role === 'gouvernement') {
      const payload = { id: du.id, username: du.username, avatar: du.avatar || '', nom: compte.nom, prenom: compte.prenom, fonction: compte.fonction, role: 'gouvernement' };
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(sessionHtml('bs_gouv_user', payload, '/dashboard.html'));
    }

    // 6. Employé / autres rôles
    const payload = { id: du.id, username: du.username, avatar: du.avatar || '', nom: compte.nom || '', prenom: compte.prenom || '', role: compte.role, poste: compte.poste || '', contrat: compte.contrat || 'CDD' };
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(sessionHtml('bs_user', payload, '/dashboard.html'));

  } catch (err) {
    console.error('CALLBACK ERROR:', err.message);
    return res.redirect('/?error=server_error');
  }
}
