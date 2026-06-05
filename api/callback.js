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

    // ── Direction hardcodée (accès total sans vérif BDD) ──
    if (DIR_IDS.includes(du.id)) {
      const payload = {
        id: du.id,
        username: du.username,
        avatar: du.avatar || '',
        nom: '',
        prenom: '',
        role: 'direction',
      };
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(
        sessionRedirectHtml('bs_user', payload, '/dashboard.html', '/?error=storage_error')
      );
    }

    // ── Vérifier dans comptes_dashboard ──
    const compteResult = await supabaseQuery(
      `comptes_dashboard?discord_id=eq.${du.id}&select=*`,
      sb
    );

    if (compteResult.error) return res.redirect('/?error=server_error');

    if (!compteResult.data.length) {
      return res.redirect('/?error=not_registered');
    }

    const compte = compteResult.data[0];

    // Vérifier statut
    if (!compte.actif || compte.statut === 'revoque') {
      return res.redirect('/?error=revoque');
    }
    if (compte.statut === 'suspendu') {
      return res.redirect('/?error=suspendu');
    }

    // ── Gouvernement ──
    if (compte.role === 'gouvernement') {
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
        sessionRedirectHtml('bs_gouv_user', gouvPayload, '/dashboard.html', '/?error=storage_error')
      );
    }

    // ── Tous les autres rôles (employe / chef_equipe / responsable / direction) ──
    const payload = {
      id: du.id,
      username: du.username,
      avatar: du.avatar || '',
      nom: compte.nom || '',
      prenom: compte.prenom || '',
      role: compte.role,
      poste: compte.poste || '',
      contrat: compte.contrat || 'CDD',
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
