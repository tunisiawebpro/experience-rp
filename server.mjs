import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import pg from 'pg';
import webpush from 'web-push';

const { Pool } = pg;

const port = process.env.PORT || 3002;

const websiteUrl = process.env.FRONTEND_URL || 'https://exp-rp.netlify.app';
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3002';
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@experience-rp.com';
const pushEnabled = Boolean(vapidPublicKey && vapidPrivateKey);

if (pushEnabled) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

const clientId = process.env.DISCORD_CLIENT_ID;
const clientSecret = process.env.DISCORD_CLIENT_SECRET;
const botToken = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const survivorsRoleId = process.env.DISCORD_SURVIVORS_ROLE_ID;
const survivorsRoleName = (process.env.DISCORD_SURVIVORS_ROLE_NAME || 'Survivors').trim().toLowerCase();
const staffRoleIds = (process.env.DISCORD_STAFF_ROLE_IDS || '')
    .split(',')
    .map((roleId) => roleId.trim())
    .filter(Boolean);
const staffRoleGroups = {
    leadership: (process.env.DISCORD_LEADERSHIP_ROLE_IDS || '').split(',').map((id) => id.trim()).filter(Boolean),
    management: (process.env.DISCORD_MANAGEMENT_ROLE_IDS || '').split(',').map((id) => id.trim()).filter(Boolean),
    community: (process.env.DISCORD_COMMUNITY_ROLE_IDS || '').split(',').map((id) => id.trim()).filter(Boolean)
};
const contentCreatorRoleIds = (process.env.DISCORD_CONTENT_CREATOR_ROLE_ID || process.env.DISCORD_CONTENT_CREATOR_ROLE_IDS || process.env.DISCORD_CONTENT_CREATORS_ROLE_ID || '')
    .split(',')
    .map((roleId) => roleId.trim())
    .filter(Boolean);
const contentCreatorRoleName = (process.env.DISCORD_CONTENT_CREATOR_ROLE_NAME || 'Content Creator').trim().toLowerCase();
const excludedCreatorIds = new Set([
    '691943511674585160',
    ...(process.env.DISCORD_EXCLUDED_CREATOR_IDS || '').split(',').map((id) => id.trim()).filter(Boolean)
]);
const defaultCreatorProfiles = {
    '190563870635589632': { platform: 'Kick', url: 'https://kick.com/axelsharky', slug: 'axelsharky' },
    '252434851209150464': { platform: 'Kick', url: 'https://kick.com/element_tn', slug: 'element_tn' },
    '358497061026398208': { platform: 'TikTok', url: 'https://www.tiktok.com/@ray__1st', slug: 'ray__1st' },
    '1187372118736900160': { platform: 'TikTok', url: 'https://www.tiktok.com/@da7loub_', slug: 'da7loub_' },
    axel: { platform: 'Kick', url: 'https://kick.com/axelsharky', slug: 'axelsharky' },
    ray: { platform: 'TikTok', url: 'https://www.tiktok.com/@ray__1st', slug: 'ray__1st' },
    element: { platform: 'Kick', url: 'https://kick.com/element_tn', slug: 'element_tn' },
    'st@u': { platform: 'TikTok', url: 'https://www.tiktok.com/@da7loub_', slug: 'da7loub_' }
};
let creatorProfiles = defaultCreatorProfiles;
try {
    creatorProfiles = { ...defaultCreatorProfiles, ...JSON.parse(process.env.CONTENT_CREATOR_PROFILES || '{}') };
} catch {
    console.warn('CONTENT_CREATOR_PROFILES must be valid JSON; using built-in creator links.');
}

const redirectUri = `${backendUrl}/auth/discord/callback`;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

let staffCache = { expiresAt: 0, members: null };
let creatorCache = { expiresAt: 0, members: null };

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

const readJsonBody = async (request) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    if (!chunks.length) return {};
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const getAuthenticatedSession = async (request) => {
    const cookies = parseCookies(request.headers.cookie || '');
    return getSession(cookies.session_id);
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
    if (!guildId || !botToken || !userId) {
        console.log('Survivors check skipped:', { guildId: !!guildId, botToken: !!botToken, userId: !!userId });
        return false;
    }

    const resolvedRoleId = await resolveSurvivorsRoleId();
    if (!resolvedRoleId) {
        console.log('Survivors role not resolved:', { guildId, survivorsRoleId, survivorsRoleName });
        return false;
    }

    try {
        const response = await fetch(
            `https://discord.com/api/guilds/${guildId}/members/${userId}`,
            {
                headers: {
                    Authorization: `Bot ${botToken}`
                }
            }
        );

        const text = await response.text();

        if (!response.ok) {
            console.log('Guild member fetch failed:', {
                status: response.status,
                guildId,
                userId,
                responseText: text.slice(0, 500)
            });
            return false;
        }

        const member = JSON.parse(text);
        const hasRole = Array.isArray(member.roles) && member.roles.includes(resolvedRoleId);

        console.log('Guild member check:', {
            guildId,
            userId,
            resolvedRoleId,
            memberRoles: member.roles || [],
            hasRole
        });

        return hasRole;
    } catch (error) {
        console.warn('Could not read guild member roles:', error);
        return false;
    }
};

const discordRequest = async (path) => {
    const response = await fetch(`https://discord.com/api${path}`, {
        headers: { Authorization: `Bot ${botToken}` }
    });

    if (!response.ok) {
        throw new Error(`Discord API returned ${response.status} for ${path}`);
    }

    return response.json();
};

const getStaffMembers = async () => {
    if (!guildId || !botToken || !staffRoleIds.length) return null;
    if (staffCache.members && staffCache.expiresAt > Date.now()) return staffCache.members;

    const roles = await discordRequest(`/guilds/${guildId}/roles`);
    const staffRoles = roles
        .filter((role) => staffRoleIds.includes(role.id))
        .sort((left, right) => right.position - left.position);
    const staffRoleMap = new Map(staffRoles.map((role) => [role.id, role]));
    const getCategory = (role) => {
        if (staffRoleGroups.leadership.includes(role.id)) return 'leadership';
        if (staffRoleGroups.management.includes(role.id)) return 'management';
        if (staffRoleGroups.community.includes(role.id)) return 'community';

        const roleName = role.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim()
            .replace(/\s+/g, ' ');
        if (['founder', 'co founder', 'cofounder'].includes(roleName)) return 'leadership';
        if (['supervisor', 'staff manager', 'developer', 'dev', 'discord manager', 'storyline director', 'storyline directors'].includes(roleName)) return 'management';
        return 'community';
    };

    const members = [];
    let after = '0';
    do {
        const page = await discordRequest(`/guilds/${guildId}/members?limit=1000&after=${after}`);
        members.push(...page);
        if (page.length < 1000) break;
        after = page[page.length - 1].user.id;
    } while (members.length < 10000);

    const result = members
        .map((member) => {
            const role = staffRoles.find((staffRole) => member.roles.includes(staffRole.id));
            if (!role || !member.user) return null;

            const user = member.user;
            const avatarHash = member.avatar || user.avatar;
            const avatar = avatarHash
                ? member.avatar
                    ? `https://cdn.discordapp.com/guilds/${guildId}/users/${user.id}/avatars/${avatarHash}.png?size=128`
                    : `https://cdn.discordapp.com/avatars/${user.id}/${avatarHash}.png?size=128`
                : `https://cdn.discordapp.com/embed/avatars/${Number(user.discriminator || 0) % 5}.png`;

            return {
                id: user.id,
                name: member.nick || user.global_name || user.username,
                role: role.name,
                category: getCategory(role),
                avatar
            };
        })
        .filter(Boolean);

    staffCache = { members: result, expiresAt: Date.now() + 60_000 };
    return result;
};

const normalizeCreatorKey = (value = '') => value.toLowerCase().replace(/[^a-z0-9@]+/g, '').trim();

const getCreatorProfile = (member, role) => {
    const userId = normalizeCreatorKey(member.user?.id);
    const idProfile = creatorProfiles[userId];
    if (idProfile) return idProfile;

    const keys = [member.nick, member.user?.global_name, member.user?.username]
        .filter(Boolean)
        .map(normalizeCreatorKey);
    const match = Object.entries(creatorProfiles).find(([key]) => {
        const normalizedKey = normalizeCreatorKey(key);
        if (/^\d+$/.test(normalizedKey)) return false;
        return keys.includes(normalizedKey);
    });
    return match?.[1] || null;
};

const getCreatorLiveStatus = async (profile) => {
    if (!profile?.platform || !profile.slug) return false;

    try {
        if (profile.platform.toLowerCase() === 'kick') {
            const response = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(profile.slug)}`);
            if (!response.ok) return false;
            const data = await response.json();
            return Boolean(data.livestream?.is_live || data.livestream);
        }

        if (profile.platform.toLowerCase() === 'tiktok') {
            const response = await fetch(`https://www.tiktok.com/@${encodeURIComponent(profile.slug)}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!response.ok) return false;
            const page = await response.text();
            return /"isLive"\s*:\s*true|"is_live"\s*:\s*true/i.test(page);
        }
    } catch (error) {
        console.warn(`Could not read ${profile.platform} status for ${profile.slug}:`, error.message);
    }

    return false;
};

const getContentCreators = async () => {
    if (!guildId || !botToken) return null;
    if (creatorCache.members && creatorCache.expiresAt > Date.now()) return creatorCache.members;

    const roles = await discordRequest(`/guilds/${guildId}/roles`);
    const creatorRoles = roles.filter((role) =>
        contentCreatorRoleIds.includes(role.id) ||
        (role.name || '').trim().toLowerCase() === contentCreatorRoleName
    );
    if (!creatorRoles.length) return [];

    const members = [];
    let after = '0';
    do {
        const page = await discordRequest(`/guilds/${guildId}/members?limit=1000&after=${after}`);
        members.push(...page);
        if (page.length < 1000) break;
        after = page[page.length - 1].user.id;
    } while (members.length < 10000);

    const creators = members.map((member) => {
        const role = creatorRoles.find((creatorRole) => member.roles.includes(creatorRole.id));
        if (!role || !member.user) return null;
        if (excludedCreatorIds.has(member.user.id)) return null;

        const user = member.user;
        const profile = getCreatorProfile(member, role);
        if (!profile?.url) return null;
        const avatarHash = member.avatar || user.avatar;
        const avatar = avatarHash
            ? member.avatar
                ? `https://cdn.discordapp.com/guilds/${guildId}/users/${user.id}/avatars/${avatarHash}.png?size=256`
                : `https://cdn.discordapp.com/avatars/${user.id}/${avatarHash}.png?size=256`
            : `https://cdn.discordapp.com/embed/avatars/${Number(user.discriminator || 0) % 5}.png`;

        return { id: user.id, name: member.nick || user.global_name || user.username, avatar, platform: profile.platform, url: profile.url, slug: profile.slug };
    }).filter(Boolean);

    const result = await Promise.all(creators.map(async (creator) => ({ ...creator, isLive: await getCreatorLiveStatus(creator) })));
    creatorCache = { members: result, expiresAt: Date.now() + 30_000 };
    return result;
};

const savePushSubscription = async (userId, subscription) => {
    await pool.query(
        `
        INSERT INTO push_subscriptions (discord_id, endpoint, subscription, updated_at)
        VALUES ($1, $2, $3::jsonb, NOW())
        ON CONFLICT (endpoint)
        DO UPDATE SET discord_id = EXCLUDED.discord_id, subscription = EXCLUDED.subscription, updated_at = NOW()
        `,
        [userId, subscription.endpoint, JSON.stringify(subscription)]
    );
};

const removePushSubscription = async (userId, endpoint) => {
    await pool.query(
        'DELETE FROM push_subscriptions WHERE discord_id = $1 AND endpoint = $2',
        [userId, endpoint]
    );
};

const sendCreatorPush = async (creator) => {
    if (!pushEnabled) return;

    const result = await pool.query(
        'SELECT discord_id, endpoint, subscription FROM push_subscriptions'
    );
    const payload = JSON.stringify({
        title: `${creator.name} is live now`,
        body: `${creator.name} is streaming on ${creator.platform}.`,
        url: creator.url,
        creatorId: creator.id,
        tag: `creator-live-${creator.id}`
    });

    await Promise.all(result.rows.map(async (row) => {
        try {
            await webpush.sendNotification(row.subscription, payload);
        } catch (error) {
            if (error.statusCode === 404 || error.statusCode === 410) {
                await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [row.endpoint]);
            } else {
                console.warn(`Push delivery failed for ${row.discord_id}:`, error.message);
            }
        }
    }));
};

let previousCreatorLiveState = new Map();
let creatorMonitorStarted = false;

const monitorCreatorStreams = async () => {
    try {
        const creators = await getContentCreators();
        if (!Array.isArray(creators)) return;

        for (const creator of creators) {
            const wasLive = previousCreatorLiveState.get(creator.id);
            if (wasLive === false && creator.isLive === true) {
                await sendCreatorPush(creator);
            }
            previousCreatorLiveState.set(creator.id, creator.isLive);
        }

        const activeIds = new Set(creators.map((creator) => creator.id));
        previousCreatorLiveState = new Map(
            [...previousCreatorLiveState].filter(([id]) => activeIds.has(id))
        );
    } catch (error) {
        console.warn('Creator live monitor failed:', error.message);
    }
};

const startCreatorMonitor = () => {
    if (creatorMonitorStarted) return;
    creatorMonitorStarted = true;
    monitorCreatorStreams();
    setInterval(monitorCreatorStreams, 30_000);
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

    // ============================================
    // WEB PUSH NOTIFICATIONS
    // ============================================

    if (requestUrl.pathname === '/api/push/config' && request.method === 'GET') {
        sendJson(response, 200, { enabled: pushEnabled, publicKey: pushEnabled ? vapidPublicKey : null });
        return;
    }

    if (requestUrl.pathname === '/api/push/subscribe' && request.method === 'POST') {
        try {
            const session = await getAuthenticatedSession(request);
            if (!session) {
                sendJson(response, 401, { error: 'Discord login required.' });
                return;
            }

            const body = await readJsonBody(request);
            if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
                sendJson(response, 400, { error: 'Invalid push subscription.' });
                return;
            }

            await savePushSubscription(session.discord_id, body);
            sendJson(response, 201, { success: true });
        } catch (error) {
            console.error('Push subscription error:', error);
            sendJson(response, 400, { error: 'Could not save push subscription.' });
        }
        return;
    }

    if (requestUrl.pathname === '/api/push/unsubscribe' && request.method === 'POST') {
        try {
            const session = await getAuthenticatedSession(request);
            if (!session) {
                sendJson(response, 401, { error: 'Discord login required.' });
                return;
            }

            const body = await readJsonBody(request);
            if (body.endpoint) await removePushSubscription(session.discord_id, body.endpoint);
            sendJson(response, 200, { success: true });
        } catch (error) {
            console.error('Push unsubscribe error:', error);
            sendJson(response, 400, { error: 'Could not remove push subscription.' });
        }
        return;
    }

    // ============================================
    // STAFF DIRECTORY
    // ============================================

    if (
        requestUrl.pathname === '/api/staff' &&
        request.method === 'GET'
    ) {
        try {
            const members = await getStaffMembers();

            if (!members) {
                sendJson(response, 503, {
                    error: 'Staff roles are not configured.'
                });

                return;
            }

            sendJson(response, 200, { members });
        } catch (error) {
            console.error('Staff fetch error:', error);

            sendJson(response, 502, {
                error: 'Could not read Discord staff.'
            });
        }

        return;
    }

    // ============================================
    // CONTENT CREATOR DIRECTORY
    // ============================================

    if (
        requestUrl.pathname === '/api/creators' &&
        request.method === 'GET'
    ) {
        try {
            const members = await getContentCreators();

            if (!members) {
                sendJson(response, 503, { error: 'Content creator roles are not configured.' });
                return;
            }

            sendJson(response, 200, { members });
        } catch (error) {
            console.error('Content creator fetch error:', error);
            sendJson(response, 502, { error: 'Could not read Discord content creators.' });
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
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            endpoint TEXT PRIMARY KEY,
            discord_id TEXT NOT NULL,
            subscription JSONB NOT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
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

                startCreatorMonitor();
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