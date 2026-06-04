import querystring from 'querystring';

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.redirect('/gouv.html?error=no_code');

  const CLIENT_ID     = process.env.DISCORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  const REDIRECT_URI  = process.env.REDIRECT_URI_GOUV;
  const SUPABASE_URL  = process.env.SUPABASE_URL;
  const SUPABASE_KEY  = process.env.SUPABASE_KEY;

  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI || !SUPABASE_URL || !SUPABASE_KEY) {
    return res.redirect('/gouv.html?error=missing_env');
  }

  try {
    // Échanger le code contre un token
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
    if (!token.access_token) return res.redirect('/gouv.html?error=token_error');

    // Récupérer les infos Discord
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const user = await userRes.json();
    if (!user.id) return res.redirect('/gouv.html?error=user_error');

    // Vérifier si c'est un employé Burger Shot
    const empRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employes?discord_id=eq.${user.id}&select=*`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const employes = await empRes.json();
    if (Array.isArray(employes) && employes.length) {
      return res.redirect('/gouv.html?error=est_employe');
    }

    // OK → passer les infos via page intermédiaire (même méthode que callback.js)
    const payload = JSON.stringify({
      id:       user.id,
      username: user.username,
      avatar:   user.avatar || '',
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<script>
try {
  localStorage.setItem('bs_gouv_user', ${JSON.stringify(payload)});
  window.location.replace('/gouv.html');
} catch(e) {
  window.location.replace('/gouv.html?error=storage_error');
}
</script>
</body></html>`);

  } catch (err) {
    console.error('CALLBACK-GOUV ERROR:', err.message);
    return res.redirect('/gouv.html?error=server_error');
  }
  // Vérifier si un compte gouvernement existe déjà
const gouvRes = await fetch(
  `${SUPABASE_URL}/rest/v1/gouvernement_comptes?discord_id=eq.${user.id}&select=*`,
  { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
);
  const gouvArr = await gouvRes.json();
  
  if (Array.isArray(gouvArr) && gouvArr.length) {
    const compte = gouvArr[0];
    if (compte.statut === 'revoque') return res.redirect('/gouv.html?error=revoque');
    if (compte.statut === 'suspendu') return res.redirect('/gouv.html?error=suspendu');
  
    // Compte existant → écrire la session et rediriger au dashboard
    const payload = JSON.stringify({
      id: user.id,
      username: user.username,
      avatar: user.avatar || '',
      nom: compte.nom,
      prenom: compte.prenom,
      fonction: compte.fonction,
      role: 'gouvernement'
    });
  
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
  <script>
  try {
    localStorage.setItem('bs_gouv_user', ${JSON.stringify(payload)});
    window.location.replace('/');
  } catch(e) {
    window.location.replace('/gouv.html?error=storage_error');
  }
  </script>
  </body></html>`);
  }
}

