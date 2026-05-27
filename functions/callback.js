export async function onRequest(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return Response.redirect(new URL('/?error=nocode', url.origin), 302);
  }

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: "1508986297660870806",
        client_secret: "rFN9iOo-41wG8kO6zWy80CrXcqoJZRae",
        grant_type: "authorization_code",
        code,
        redirect_uri: "https://burger-shot-redstart-v2.thephenix5759.workers.dev/functions/callback",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return Response.redirect(new URL(`/?error=${encodeURIComponent(JSON.stringify(tokenData))}`, url.origin), 302);
    }

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();

    const AUTHORIZED = ["280415204477501451", "1157333780898529333", "370510144766738432"];

    if (!AUTHORIZED.includes(user.id)) {
      return Response.redirect(new URL('/?error=unauthorized', url.origin), 302);
    }

    const DIRECTION = ["280415204477501451", "1157333780898529333", "370510144766738432"];
    const role = DIRECTION.includes(user.id) ? "direction" : "employe";

    const params = new URLSearchParams({
      id: user.id,
      username: user.username,
      avatar: user.avatar || "",
      role,
    });

    return Response.redirect(new URL(`/dashboard.html?${params}`, url.origin), 302);

  } catch (err) {
    return Response.redirect(new URL(`/?error=${encodeURIComponent(err.message)}`, url.origin), 302);
  }
}
