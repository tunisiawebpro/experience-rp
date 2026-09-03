const discordServerId = '1531222351918927983';
const discordInviteCode = 'PSyquaZek';
const fivemServerAddress = 'experiencechiirp.prime-filter.com:30120';

function updateServerStatus(isOnline) {
    const statusText = document.getElementById('serverStatusText');
    const statusLabel = document.getElementById('serverStatusLabel');
    const statusBadge = document.getElementById('serverStatusBadge');
    const statusIcon = document.getElementById('serverStatusIcon');
    const statusDot = document.getElementById('serverStatusDot');
    const statusPing = document.getElementById('serverStatusPing');
    const footerStatus = document.getElementById('footerServerStatus');
    const online = isOnline === true;

    if (statusText) {
        statusText.textContent = online ? 'Online' : 'Offline';
        statusText.className = online
            ? 'text-green-500 text-xs uppercase tracking-wider'
            : 'text-red-400 text-xs uppercase tracking-wider';
    }

    if (statusLabel) statusLabel.textContent = online ? 'Operational' : 'Offline';
    if (footerStatus) {
        footerStatus.textContent = online ? 'Online' : 'Offline';
        footerStatus.className = online ? 'text-emerald-400' : 'text-red-400';
    }
    if (statusBadge) {
        statusBadge.className = online
            ? 'px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-bold'
            : 'px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold';
    }
    if (statusIcon) {
        statusIcon.className = online
            ? 'fas fa-check-circle mr-1'
            : 'fas fa-times-circle mr-1';
    }
    if (statusDot) {
        statusDot.className = online
            ? 'relative inline-flex rounded-full h-2 w-2 bg-green-500'
            : 'relative inline-flex rounded-full h-2 w-2 bg-red-500';
    }
    if (statusPing) {
        statusPing.className = online
            ? 'animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75'
            : 'animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75';
    }
}

async function fetchFiveMServerStatus() {
    try {
        const response = await fetch(`http://${fivemServerAddress}/info.json`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(8000)
        });
        if (!response.ok) throw new Error(`FiveM status returned ${response.status}`);

        await response.json();
        updateServerStatus(true);
    } catch (error) {
        updateServerStatus(false);
        console.log('FiveM server is offline or unavailable');
    }
}

async function fetchDiscordMemberCount() {
    const memberCountEl = document.getElementById('discordMemberCount');

    if (!memberCountEl || !discordInviteCode) return;

    try {
        const response = await fetch(`https://discord.com/api/v10/invites/${discordInviteCode}?with_counts=true`);
        if (!response.ok) throw new Error(`Discord invite returned ${response.status}`);
        const data = await response.json();

        memberCountEl.textContent = data.approximate_member_count ?? '--';
    } catch (error) {
        memberCountEl.textContent = '--';
        console.log('Discord member count unavailable');
    }
}

async function fetchDiscordStaffAvatars() {
    const staffCards = document.querySelectorAll('[data-discord-id]');
    if (!staffCards.length) return;

    try {
        const response = await fetch(`https://discord.com/api/guilds/${discordServerId}/widget.json`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Discord widget returned ${response.status}`);
        const data = await response.json();
        const members = data.members || [];

        staffCards.forEach((card) => {
            const member = members.find((item) => item.id === card.dataset.discordId);
            if (member?.avatar_url) {
                const avatar = card.querySelector('.staff-member-avatar');
                if (avatar) avatar.src = member.avatar_url;
            }
        });
    } catch (error) {
        console.log('Discord staff avatars unavailable');
    }
}

fetchDiscordMemberCount();
setInterval(fetchDiscordMemberCount, 60000);
fetchDiscordStaffAvatars();
setInterval(fetchDiscordStaffAvatars, 60000);
fetchFiveMServerStatus();
setInterval(fetchFiveMServerStatus, 30000);