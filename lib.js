import {
  getOrigin,
  getSupabaseConfig,
  supabaseQuery,
  exchangeDiscordCode,
  sessionRedirectHtml,
} from './lib.js';

const DIR_IDS = ['280415204477501451', '1157333780898529333', '370510144766738432'];

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.redirect('/?error=no_code');

  const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `${getOrigin(req)}/api/callback`;
  const sb = getSupabaseConfig();

  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !REDIRECT_URI || !sb.url || !sb.key) {
    return res.redirect('/?error=missing_env');
  }

  try {
    const du = await exchangeDiscordCode(code, REDIRECT_URI);
    if (!du) return res.redirect('/?error=no_token');

    const isPriv = DIR_IDS.includes(du.id);
    let empRow = null;

    if (!isPriv) {
      const empResult = await supabaseQuery(`employes?discord_id=eq.${du.id}&select=*`, sb);
      if (empResult.error) return res.redirect('/?error=server_error');

      if (!empResult.data.length) {
        const gouvResult = await supabaseQuery(
          `gouvernement_comptes?discord_id=eq.${du.id}&select=*`,
          sb
        );
        if (gouvResult.error) return res.redirect('/?error=server_error');

        if (gouvResult.data.length) {
          const compte = gouvResult.data[0];
          if (compte.statut === 'revoque') return res.redirect('/gouv.html?error=revoque');
          if (compte.statut === 'suspendu') return res.redirect('/gouv.html?error=suspendu');

          const gouvPayload = {
            id: du.id,
            username: du.username,
            avatar: du.avatar || '',
            nom: compte.nom,
            prenom: compte.prenom,
            fonction: compte.fonction,
            role: 'gouvernement',
          };

          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.status(200).send(
            sessionRedirectHtml('bs_gouv_user', gouvPayload, '/dashboard.html', '/gouv.html?error=storage_error')
          );
        }

        return res.redirect('/?error=not_registered');
      }

      empRow = empResult.data[0];
      if (!empRow.actif) return res.redirect('/?error=inactive');
    }

    const payload = {
      id: du.id,
      username: du.username,
      avatar: du.avatar || '',
      nom: empRow?.nom || '',
      prenom: empRow?.prenom || '',
    };

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(
      sessionRedirectHtml('bs_user', payload, '/dashboard.html', '/?error=storage_error')
    );
  } catch (err) {
    console.error('CALLBACK ERROR:', err.message);
    return res.redirect('/?error=server_error');
  }
}
