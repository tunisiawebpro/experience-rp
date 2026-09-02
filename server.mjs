import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const port = process.env.PORT || 3002;

const websiteUrl = process.env.FRONTEND_URL || 'https://exp-rp.netlify.app';
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3002';

const clientId = process.env.DISCORD_CLIENT_ID;
const clientSecret = process.env.DISCORD_CLIENT_SECRET;
const botToken = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const survivorsRoleId = process.env.DISCORD_SURVIVORS_ROLE_ID;
const survivorsRoleName = (process.env.DISCORD_SURVIVORS_ROLE_NAME || 'Survivors').trim().toLowerCase();

const redirectUri = `${backendUrl}/auth/discord/callback`;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

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

const sendJson = (response, status, data) => {
    response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': websiteUrl,
        'Access-Control-Allow-Credentials': 'true'
    });

    response.end(JSON.stringify(data));
};

const send = (response, status, body) => {
    response.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8'
    });

    response.end(body);
};

const resolveSurvivorsRoleId = async () => {
    if (survivorsRoleId) return survivorsRoleId;
    if (!guildId || !botToken) return null;

    try {
        const response = await fetch(
            `https://discord.com/api/guilds/${guildId}/roles`,
            {
                headers: {
                    Authorization: `Bot ${botToken}`
                }
            }
        );

        if (!response.ok) return null;

        const roles = await response.json();
        const match = roles.find((role) =>
            (role.name || '').trim().toLowerCase() === survivorsRoleName
        );

        return match?.id || null;
    } catch (error) {
        console.warn('Could not resolve Survivors role id:', error);
        return null;
    }
};

const userHasSurvivorsRole = async (userId) => {
    if (!guildId || !botToken || !userId) return false;

    const resolvedRoleId = await resolveSurvivorsRoleId();
    if (!resolvedRoleId) return false;

    try {
        const response = await fetch(
            `https://discord.com/api/guilds/${guildId}/members/${userId}`,
            {
                headers: {
                    Authorization: `Bot ${botToken}`
                }
            }
        );

        if (!response.ok) return false;

        const member = await response.json();
        return Array.isArray(member.roles) && member.roles.includes(resolvedRoleId);
    } catch (error) {
        console.warn('Could not read guild member roles:', error);
        return false;
    }
};

const createSession = async (user, hasSurvivorsRole = false) => {
    const sessionId = crypto.randomBytes(32).toString('hex');

    const username = user.global_name || user.username;

    const avatar = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=96`
        : '';

    // ============================================
    // CREATE / UPDATE USER
    // ============================================

    await pool.query(
        `
        INSERT INTO users
        (discord_id, username, avatar, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (discord_id)
        DO UPDATE SET
            username = EXCLUDED.username,
            avatar = EXCLUDED.avatar
        `,
        [
            user.id,
            username,
            avatar
        ]
    );

    // ============================================
    // CREATE LOGIN SESSION
    // ============================================

    await pool.query(
        `
        INSERT INTO discord_sessions
        (session_id, discord_id, username, avatar, has_survivors_role, created_at, expires_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '30 days')
        `,
        [
            sessionId,
            user.id,
            username,
            avatar,
            hasSurvivorsRole
        ]
    );

    return sessionId;
};

const getSession = async (sessionId) => {
    if (!sessionId) return null;

    const result = await pool.query(
        `
        SELECT discord_id, username, avatar, has_survivors_role
        FROM discord_sessions
        WHERE session_id = $1
        AND expires_at > NOW()
        `,
        [sessionId]
    );

    return result.rows[0] || null;
};

const deleteSession = async (sessionId) => {
    if (!sessionId) return;

    await pool.query(
        `
        DELETE FROM discord_sessions
        WHERE session_id = $1
        `,
        [sessionId]
    );
};

const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(
        request.url,
        `http://${request.headers.host}`
    );

    // ============================================
    // CORS
    // ============================================

    if (request.method === 'OPTIONS') {
        response.writeHead(204, {
            'Access-Control-Allow-Origin': websiteUrl,
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });

        response.end();
        return;
    }

    // ============================================
    // DATABASE HEALTH CHECK
    // ============================================

    if (requestUrl.pathname === '/health') {
        try {
            await pool.query('SELECT 1');

            sendJson(response, 200, {
                status: 'ok',
                database: 'connected'
            });
        } catch (error) {
            console.error(error);

            sendJson(response, 500, {
                status: 'error',
                database: 'disconnected'
            });
        }

        return;
    }

    // ============================================
    // DISCORD LOGIN
    // ============================================

    if (requestUrl.pathname === '/auth/discord') {
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

        response.writeHead(302, {
            Location:
                `https://discord.com/oauth2/authorize?${params}`
        });

        response.end();

        return;
    }

    // ============================================
    // DISCORD CALLBACK
    // ============================================

    if (requestUrl.pathname === '/auth/discord/callback') {
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
            // Exchange code for Discord token
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

            const tokenData =
                await tokenResponse.json();

            if (!tokenResponse.ok) {
                throw new Error(
                    tokenData.error_description ||
                    'Token exchange failed'
                );
            }

            // Get Discord user
            const userResponse = await fetch(
                'https://discord.com/api/users/@me',
                {
                    headers: {
                        Authorization:
                            `Bearer ${tokenData.access_token}`
                    }
                }
            );

            const user =
                await userResponse.json();

            if (!userResponse.ok) {
                throw new Error(
                    'Could not read the Discord account'
                );
            }

            const hasSurvivorsRole = await userHasSurvivorsRole(user.id);

            // Add user to Discord server (best effort only)
            if (guildId && botToken) {
                try {
                    const joinResponse = await fetch(
                        `https://discord.com/api/guilds/${guildId}/members/${user.id}`,
                        {
                            method: 'PUT',

                            headers: {
                                Authorization:
                                    `Bot ${botToken}`,

                                'Content-Type':
                                    'application/json'
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

                        console.warn(
                            'Could not auto-add user to Discord guild:',
                            joinResponse.status,
                            joinError
                        );
                    }
                } catch (joinError) {
                    console.warn(
                        'Guild join request failed:',
                        joinError
                    );
                }
            }

            // ============================================
            // CREATE DATABASE SESSION
            // ============================================

            const sessionId =
                await createSession(user, hasSurvivorsRole);

            response.setHeader('Set-Cookie', [
                `session_id=${sessionId}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=2592000`
            ]);

            // Redirect back to website
const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=96`
    : '';

const profileParams = new URLSearchParams({
    discord: 'connected',
    username: user.global_name || user.username,
    avatar: avatarUrl,
    survivors: String(hasSurvivorsRole)
});

response.writeHead(302, {
    Location: `${websiteUrl}?${profileParams.toString()}`
});

response.end();

        } catch (error) {
            console.error(
                'Discord callback error:',
                error
            );

            send(
                response,
                502,
                'Discord authorization could not be completed.'
            );
        }

        return;
    }

    // ============================================
    // CHECK CURRENT LOGIN
    // ============================================

    if (
        requestUrl.pathname === '/auth/me' &&
        request.method === 'GET'
    ) {
        try {
            const cookies = parseCookies(
                request.headers.cookie || ''
            );

            const session =
                await getSession(
                    cookies.session_id
                );

            if (!session) {
                sendJson(response, 200, {
                    authenticated: false
                });

                return;
            }

            sendJson(response, 200, {
                authenticated: true,

                user: {
                    id: session.discord_id,
                    username: session.username,
                    avatar: session.avatar,
                    hasSurvivorsRole: !!session.has_survivors_role
                }
            });

        } catch (error) {
            console.error(
                'Session check error:',
                error
            );

            sendJson(response, 500, {
                authenticated: false
            });
        }

        return;
    }

    // ============================================
    // LOGOUT
    // ============================================

    if (
        requestUrl.pathname === '/auth/logout' &&
        request.method === 'POST'
    ) {
        try {
            const cookies = parseCookies(
                request.headers.cookie || ''
            );

            await deleteSession(
                cookies.session_id
            );

            response.writeHead(200, {
                'Content-Type':
                    'application/json; charset=utf-8',

                'Access-Control-Allow-Origin':
                    websiteUrl,

                'Access-Control-Allow-Credentials':
                    'true',

                'Set-Cookie':
                    'session_id=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0'
            });

            response.end(
                JSON.stringify({
                    success: true
                })
            );

        } catch (error) {
            console.error(
                'Logout error:',
                error
            );

            sendJson(response, 500, {
                success: false
            });
        }

        return;
    }

    send(response, 404, 'Not found');
});

// ============================================
// DATABASE INITIALIZATION
// ============================================

const initializeDatabase = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS discord_sessions (
            session_id TEXT PRIMARY KEY,
            discord_id TEXT NOT NULL,
            username TEXT NOT NULL,
            avatar TEXT,
            has_survivors_role BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMP NOT NULL
        )
    `);

    await pool.query(`
        ALTER TABLE discord_sessions
        ADD COLUMN IF NOT EXISTS has_survivors_role BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await pool.query(`
        DELETE FROM discord_sessions
        WHERE expires_at <= NOW()
    `);

    console.log('Database initialized.');
};

// ============================================
// START SERVER
// ============================================

const startServer = async () => {
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
            'Failed to initialize database:',
            error
        );

        process.exit(1);
    }
};

startServer();