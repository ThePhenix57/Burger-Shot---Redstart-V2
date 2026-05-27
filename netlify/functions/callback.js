exports.handler = async (event) => {
  const { code } = event.queryStringParameters;

  if (!code) {
    return {
      statusCode: 302,
      headers: { Location: "/?error=nocode" },
      body: "",
    };
  }

  try {
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
    
    // Si pas de token → on affiche l'erreur exacte
    if (!tokenData.access_token) {
      return {
        statusCode: 302,
        headers: { Location: `/?error=${encodeURIComponent(JSON.stringify(tokenData))}` },
        body: "",
      };
    }

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();

    const AUTHORIZED = [
      "280415204477501451",
      "1157333780898529333",
      "370510144766738432",
    ];

    if (!AUTHORIZED.includes(user.id)) {
      return {
        statusCode: 302,
        headers: { Location: "/?error=unauthorized" },
        body: "",
      };
    }

    const DIRECTION = ["280415204477501451","1157333780898529333","370510144766738432"];
    const role = DIRECTION.includes(user.id) ? "direction" : "employe";

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
      headers: { Location: `/?error=${encodeURIComponent(err.message)}` },
      body: "",
    };
  }
};
