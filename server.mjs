import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';

const port = process.env.PORT || 3002;

const websiteUrl = 'https://exp-rp.netlify.app/';
const backendUrl = process.env.BACKEND_URL;

const clientId = process.env.DISCORD_CLIENT_ID;
const clientSecret = process.env.DISCORD_CLIENT_SECRET;
const botToken = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

const redirectUri = `${backendUrl}/auth/discord/callback`;

console.log('BACKEND_URL =', backendUrl);
console.log('REDIRECT_URI =', redirectUri);
console.log('CLIENT_ID =', clientId);


const parseCookies = (cookieHeader = '') =>
    Object.fromEntries(
        cookieHeader
            .split(';')
            .filter(Boolean)
            .map(cookie => {
                const [key, ...value] = cookie.trim().split('=');
                return [key, decodeURIComponent(value.join('='))];
            })
    );

const send = (response, status, body) => {
    response.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8'
    });
    response.end(body);
};

const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(
        request.url,
        `http://${request.headers.host}`
    );

    if (requestUrl.pathname === '/auth/discord') {
        if (!clientId || !clientSecret || !botToken || !guildId || !backendUrl) {
            send(
                response,
                500,
                'Discord OAuth is missing server configuration.'
            );
            return;
        }

        const state = crypto.randomBytes(24).toString('hex');

response.setHeader('Set-Cookie', [
    `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
]);
        const params = new URLSearchParams({
            client_id: clientId,
            response_type: 'code',
            redirect_uri: redirectUri,
            scope: 'identify guilds.join',
            state
        });
console.log('Discord OAuth URL:', `https://discord.com/oauth2/authorize?${params}`);
        response.writeHead(302, {
            Location: `https://discord.com/oauth2/authorize?${params}`
        });

        response.end();
        return;
    }

    if (requestUrl.pathname === '/auth/discord/callback') {
        const { code, state, error } =
            Object.fromEntries(requestUrl.searchParams);

const cookies = parseCookies(request.headers.cookie || '');
const savedState = cookies.oauth_state;

console.log('CALLBACK STATE:', state);
console.log('SAVED STATE:', savedState);

if (error || !code || !state || !savedState || state !== savedState) {
    send(
        response,
        400,
        'Discord authorization was cancelled or the state was invalid.'
    );
    return;
}

        try {
            const tokenResponse = await fetch(
                'https://discord.com/api/oauth2/token',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':
                            'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        client_id: clientId,
                        client_secret: clientSecret,
                        grant_type: 'authorization_code',
                        code,
                        redirect_uri: redirectUri
                    })
                }
            );

            const tokenData = await tokenResponse.json();

            if (!tokenResponse.ok) {
                throw new Error(
                    tokenData.error_description ||
                        'Token exchange failed'
                );
            }

            const userResponse = await fetch(
                'https://discord.com/api/users/@me',
                {
                    headers: {
                        Authorization: `Bearer ${tokenData.access_token}`
                    }
                }
            );

            const user = await userResponse.json();

            if (!userResponse.ok) {
                throw new Error(
                    'Could not read the Discord account'
                );
            }

            const joinResponse = await fetch(
                `https://discord.com/api/guilds/${guildId}/members/${user.id}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bot ${botToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        access_token: tokenData.access_token
                    })
                }
            );

            if (
                !joinResponse.ok &&
                joinResponse.status !== 204
            ) {
                const joinError = await joinResponse.text();

                throw new Error(
                    `Could not add the account to the test server: ${joinError}`
                );
            }

            const username =
                user.global_name || user.username;

            const avatar = user.avatar
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=96`
                : '';

            const callbackParams = new URLSearchParams({
                discord: 'connected',
                username,
                avatar
            });

            response.writeHead(302, {
                Location: `${websiteUrl}?${callbackParams}`
            });

            response.end();
        } catch (error) {
            console.error(error.message);

            send(
                response,
                502,
                'Discord authorization could not be completed. Check the Bot permissions and environment variables.'
            );
        }

        return;
    }

    send(response, 404, 'Not found');
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Discord OAuth backend running on port ${port}`);
    console.log(`Redirect URI: ${redirectUri}`);
});