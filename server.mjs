import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const port = process.env.PORT || 3002;

const websiteUrl = 'https://exp-rp.netlify.app';
const backendUrl = process.env.BACKEND_URL;

const clientId = process.env.DISCORD_CLIENT_ID;
const clientSecret = process.env.DISCORD_CLIENT_SECRET;
const botToken = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const databaseUrl = process.env.DATABASE_URL;

const redirectUri = `${backendUrl}/auth/discord/callback`;

if (!databaseUrl) {
    console.error('DATABASE_URL is missing.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
        rejectUnauthorized: false
    }
});

const SESSION_DAYS = 30;
const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

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

const hashToken = token =>
    crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

const createSessionToken = () =>
    crypto.randomBytes(32).toString('hex');

const send = (response, status, body) => {
    response.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': websiteUrl,
        'Access-Control-Allow-Credentials': 'true'
    });

    response.end(body);
};

const sendJson = (response, status, data) => {
    response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': websiteUrl,
        'Access-Control-Allow-Credentials': 'true',
        'Cache-Control': 'no-store'
    });

    response.end(JSON.stringify(data));
};

const setCookie = (response, name, value, maxAge) => {
    response.setHeader(
        'Set-Cookie',
        `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${maxAge}`
    );
};

const clearCookie = (response, name) => {
    response.setHeader(
        'Set-Cookie',
        `${name}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`
    );
};

async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            discord_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            avatar TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            discord_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    await pool.query(`
        DELETE FROM sessions
        WHERE expires_at < NOW();
    `);

    console.log('Database initialized successfully.');
}

async function getCurrentUser(request) {
    const cookies = parseCookies(request.headers.cookie || '');
    const sessionToken = cookies.session_token;

    if (!sessionToken) {
        return null;
    }

    const tokenHash = hashToken(sessionToken);

    const result = await pool.query(
        `
        SELECT
            u.discord_id,
            u.username,
            u.avatar
        FROM sessions s
        INNER JOIN users u
            ON u.discord_id = s.discord_id
        WHERE s.token_hash = $1
          AND s.expires_at > NOW()
        LIMIT 1;
        `,
        [tokenHash]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}

const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(
        request.url,
        `http://${request.headers.host}`
    );

    // CORS preflight
    if (request.method === 'OPTIONS') {
        response.writeHead(204, {
            'Access-Control-Allow-Origin': websiteUrl,
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });

        response.end();
        return;
    }

    // --------------------------------------------
    // DISCORD LOGIN
    // --------------------------------------------

    if (
        request.method === 'GET' &&
        requestUrl.pathname === '/auth/discord'
    ) {
        if (
            !clientId ||
            !clientSecret ||
            !botToken ||
            !guildId ||
            !backendUrl
        ) {
            send(
                response,
                500,
                'Discord OAuth is missing server configuration.'
            );
            return;
        }

        const state = crypto.randomBytes(24).toString('hex');

        setCookie(response, 'oauth_state', state, 600);

        const params = new URLSearchParams({
            client_id: clientId,
            response_type: 'code',
            redirect_uri: redirectUri,
            scope: 'identify guilds.join',
            state
        });

        response.writeHead(302, {
            Location:
                `https://discord.com/oauth2/authorize?${params.toString()}`
        });

        response.end();
        return;
    }

    // --------------------------------------------
    // DISCORD CALLBACK
    // --------------------------------------------

    if (
        request.method === 'GET' &&
        requestUrl.pathname === '/auth/discord/callback'
    ) {
        const { code, state, error } =
            Object.fromEntries(requestUrl.searchParams);

        const cookies = parseCookies(
            request.headers.cookie || ''
        );

        const savedState = cookies.oauth_state;

        if (
            error ||
            !code ||
            !state ||
            !savedState ||
            state !== savedState
        ) {
            send(
                response,
                400,
                'Discord authorization was cancelled or the state was invalid.'
            );

            return;
        }

        try {
            // --------------------------------------------
            // Exchange OAuth code for Discord token
            // --------------------------------------------

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

            // --------------------------------------------
            // Get Discord user
            // --------------------------------------------

            const userResponse = await fetch(
                'https://discord.com/api/users/@me',
                {
                    headers: {
                        Authorization:
                            `Bearer ${tokenData.access_token}`
                    }
                }
            );

            const user = await userResponse.json();

            if (!userResponse.ok) {
                throw new Error(
                    'Could not read the Discord account'
                );
            }

            // --------------------------------------------
            // Add user to Discord server
            // --------------------------------------------

            const joinResponse = await fetch(
                `https://discord.com/api/guilds/${guildId}/members/${user.id}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bot ${botToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        access_token:
                            tokenData.access_token
                    })
                }
            );

            if (
                !joinResponse.ok &&
                joinResponse.status !== 204
            ) {
                const joinError =
                    await joinResponse.text();

                throw new Error(
                    `Could not add the account to the server: ${joinError}`
                );
            }

            // --------------------------------------------
            // Prepare user data
            // --------------------------------------------

            const username =
                user.global_name || user.username;

            const avatar = user.avatar
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=96`
                : '';

            // --------------------------------------------
            // Save / update user
            // --------------------------------------------

            await pool.query(
                `
                INSERT INTO users (
                    discord_id,
                    username,
                    avatar
                )
                VALUES ($1, $2, $3)
                ON CONFLICT (discord_id)
                DO UPDATE SET
                    username = EXCLUDED.username,
                    avatar = EXCLUDED.avatar;
                `,
                [
                    user.id,
                    username,
                    avatar
                ]
            );

            // --------------------------------------------
            // Create persistent session
            // --------------------------------------------

            const sessionToken =
                createSessionToken();

            const tokenHash =
                hashToken(sessionToken);

            await pool.query(
                `
                INSERT INTO sessions (
                    token_hash,
                    discord_id,
                    expires_at
                )
                VALUES (
                    $1,
                    $2,
                    NOW() + INTERVAL '30 days'
                );
                `,
                [
                    tokenHash,
                    user.id
                ]
            );

            // Delete old OAuth state cookie
            response.setHeader(
                'Set-Cookie',
                [
                    `oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
                    `session_token=${encodeURIComponent(sessionToken)}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${SESSION_MAX_AGE}`
                ]
            );

            // --------------------------------------------
            // Return to website
            // --------------------------------------------

            response.writeHead(302, {
                Location:
                    `${websiteUrl}?discord=connected`
            });

            response.end();

        } catch (error) {
            console.error(
                'Discord OAuth error:',
                error.message
            );

            send(
                response,
                502,
                'Discord authorization could not be completed.'
            );
        }

        return;
    }

    // --------------------------------------------
    // CHECK CURRENT SESSION
    // --------------------------------------------

    if (
        request.method === 'GET' &&
        requestUrl.pathname === '/auth/me'
    ) {
        try {
            const user =
                await getCurrentUser(request);

            if (!user) {
                sendJson(response, 401, {
                    authenticated: false
                });

                return;
            }

            sendJson(response, 200, {
                authenticated: true,
                user: {
                    discordId: user.discord_id,
                    username: user.username,
                    avatar: user.avatar
                }
            });

        } catch (error) {
            console.error(
                'Session check error:',
                error.message
            );

            sendJson(response, 500, {
                authenticated: false,
                error: 'Could not check session.'
            });
        }

        return;
    }

    // --------------------------------------------
    // LOGOUT
    // --------------------------------------------

    if (
        request.method === 'POST' &&
        requestUrl.pathname === '/auth/logout'
    ) {
        try {
            const cookies =
                parseCookies(
                    request.headers.cookie || ''
                );

            const sessionToken =
                cookies.session_token;

            if (sessionToken) {
                await pool.query(
                    `
                    DELETE FROM sessions
                    WHERE token_hash = $1;
                    `,
                    [hashToken(sessionToken)]
                );
            }

            clearCookie(
                response,
                'session_token'
            );

            sendJson(response, 200, {
                success: true
            });

        } catch (error) {
            console.error(
                'Logout error:',
                error.message
            );

            sendJson(response, 500, {
                success: false
            });
        }

        return;
    }

    // --------------------------------------------
    // HEALTH CHECK
    // --------------------------------------------

    if (
        request.method === 'GET' &&
        requestUrl.pathname === '/health'
    ) {
        try {
            await pool.query('SELECT 1');

            sendJson(response, 200, {
                status: 'ok',
                database: 'connected'
            });

        } catch (error) {
            sendJson(response, 500, {
                status: 'error',
                database: 'disconnected'
            });
        }

        return;
    }

    send(
        response,
        404,
        'Not found'
    );
});

async function startServer() {
    try {
        await initializeDatabase();

        server.listen(
            port,
            '0.0.0.0',
            () => {
                console.log(
                    `Discord OAuth backend running on port ${port}`
                );

                console.log(
                    `Redirect URI: ${redirectUri}`
                );
            }
        );

    } catch (error) {
        console.error(
            'Failed to initialize server:',
            error
        );

        process.exit(1);
    }
}

startServer();