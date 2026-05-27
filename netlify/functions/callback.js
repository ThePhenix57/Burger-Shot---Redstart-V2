exports.handler = async (event) => {
  const { code } = event.queryStringParameters;

  if (!code) {
    return { statusCode: 400, body: "Code manquant" };
  }

  const AUTHORIZED = [
    "280415204477501451",   // Toi - Patron
    "1157333780898529333",  // Direction
    "370510144766738432",   // Direction
  ];

  try {
    // Échange le code contre un token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return {
        statusCode: 302,
        headers: { Location: "/?error=token" },
        body: "",
      };
    }

    // Récupère l'utilisateur Discord
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();

    if (!AUTHORIZED.includes(user.id)) {
      return {
        statusCode: 302,
        headers: { Location: "/?error=unauthorized" },
        body: "",
      };
    }

    // Détermine le rôle
    const DIRECTION = ["280415204477501451", "1157333780898529333", "370510144766738432"];
    const role = DIRECTION.includes(user.id) ? "direction" : "employe";

    // Redirige vers le dashboard avec les infos
    const params = new URLSearchParams({
      id: user.id,
      username: user.username,
      avatar: user.avatar || "",
      role,
    });

    return {
      statusCode: 302,
      headers: { Location: `/dashboard.html?${params}` },
      body: "",
    };

  } catch (err) {
    return {
      statusCode: 302,
      headers: { Location: "/?error=server" },
      body: "",
    };
  }
};
