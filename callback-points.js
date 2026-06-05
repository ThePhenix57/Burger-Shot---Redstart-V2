import {
  getOrigin,
  getSupabaseConfig,
  supabaseQuery,
  exchangeDiscordCode,
  sessionRedirectHtml,
} from './lib.js';

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.redirect('/gouv.html?error=no_code');

  const REDIRECT_URI = process.env.REDIRECT_URI_GOUV || `${getOrigin(req)}/api/callback-gouv`;
  const sb = getSupabaseConfig();

  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !REDIRECT_URI || !sb.url || !sb.key) {
    return res.redirect('/gouv.html?error=missing_env');
  }

  try {
    const user = await exchangeDiscordCode(code, REDIRECT_URI);
    if (!user) return res.redirect('/gouv.html?error=token_error');

    const empResult = await supabaseQuery(`employes?discord_id=eq.${user.id}&select=id`, sb);
    if (empResult.error) return res.redirect('/gouv.html?error=server_error');
    if (empResult.data.length) return res.redirect('/gouv.html?error=est_employe');

    const gouvResult = await supabaseQuery(
      `gouvernement_comptes?discord_id=eq.${user.id}&select=*`,
      sb
    );
    if (gouvResult.error) return res.redirect('/gouv.html?error=server_error');

    if (gouvResult.data.length) {
      const compte = gouvResult.data[0];

      if (compte.statut === 'revoque') return res.redirect('/gouv.html?error=revoque');
      if (compte.statut === 'suspendu') return res.redirect('/gouv.html?error=suspendu');

      const payload = {
        id: user.id,
        username: user.username,
        avatar: user.avatar || '',
        nom: compte.nom,
        prenom: compte.prenom,
        fonction: compte.fonction,
        role: 'gouvernement',
      };

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(
        sessionRedirectHtml('bs_gouv_user', payload, '/dashboard.html', '/gouv.html?error=storage_error')
      );
    }

    const payload = {
      id: user.id,
      username: user.username,
      avatar: user.avatar || '',
    };

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(
      sessionRedirectHtml('bs_gouv_user', payload, '/gouv.html', '/gouv.html?error=storage_error')
    );
  } catch (err) {
    console.error('CALLBACK-GOUV ERROR:', err.message);
    return res.redirect('/gouv.html?error=server_error');
  }
}
