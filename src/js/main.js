// ============================================
// ENTRANCE SCREEN - Press ENTER to continue
// ============================================
const entranceScreen = document.getElementById('entranceScreen');
const mainWebsite = document.getElementById('mainWebsite');
const entranceSeenKey = 'experience-rp-entrance-seen-v2';
const entranceParagraph = document.getElementById('entranceParagraph');
const entranceText = 'This is a Strict Roleplay server.\nWe expect nothing but the highest quality of immersion.';
let typingAudioContext;
let typingStarted = false;
let typingStopped = false;
let typingTimeout;

const navigationEntry = performance.getEntriesByType('navigation')[0];
const isPageRefresh = navigationEntry?.type === 'reload';
const entranceWasSeen = sessionStorage.getItem(entranceSeenKey) === 'true';

if (isPageRefresh) sessionStorage.removeItem(entranceSeenKey);

if (entranceScreen && entranceWasSeen && !isPageRefresh) {
    entranceScreen.classList.add('hidden');
    mainWebsite?.classList.remove('hidden');
}

const playTypingSound = () => {
    try {
        typingAudioContext ??= new AudioContext();
        if (typingAudioContext.state === 'suspended') typingAudioContext.resume();
        const now = typingAudioContext.currentTime;
        const click = typingAudioContext.createBufferSource();
        const clickBuffer = typingAudioContext.createBuffer(1, typingAudioContext.sampleRate * 0.035, typingAudioContext.sampleRate);
        const noise = clickBuffer.getChannelData(0);
        for (let index = 0; index < noise.length; index += 1) {
            noise[index] = (Math.random() * 2 - 1) * (1 - index / noise.length);
        }
        click.buffer = clickBuffer;
        const filter = typingAudioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1800;
        filter.Q.value = 1.2;
        const clickGain = typingAudioContext.createGain();
        clickGain.gain.setValueAtTime(0.11, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
        click.connect(filter).connect(clickGain).connect(typingAudioContext.destination);
        click.start(now);

        const tone = typingAudioContext.createOscillator();
        const toneGain = typingAudioContext.createGain();
        tone.type = 'triangle';
        tone.frequency.setValueAtTime(160 + Math.random() * 30, now);
        tone.frequency.exponentialRampToValueAtTime(85, now + 0.07);
        toneGain.gain.setValueAtTime(0.045, now);
        toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        tone.connect(toneGain).connect(typingAudioContext.destination);
        tone.start(now);
        tone.stop(now + 0.075);
        click.stop(now + 0.05);
    } catch {
    }
};

const typeEntranceText = () => {
    if (!entranceParagraph || typingStarted || (entranceWasSeen && !isPageRefresh)) return;
    typingStarted = true;
    let characterIndex = 0;
    const typeNextCharacter = () => {
        if (typingStopped) return;
        entranceParagraph.textContent += entranceText[characterIndex];
        if (entranceText[characterIndex] !== ' ' && entranceText[characterIndex] !== '\n') playTypingSound();
        characterIndex += 1;
        if (characterIndex < entranceText.length) typingTimeout = setTimeout(typeNextCharacter, 42);
    };
    typingTimeout = setTimeout(typeNextCharacter, 2400);
};

const unlockTypingSound = () => {
    try {
        typingAudioContext ??= new AudioContext();
        typingAudioContext.resume();
    } catch {
    }
};

typeEntranceText();
document.addEventListener('pointerdown', unlockTypingSound, { once: true });
document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') unlockTypingSound();
});

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || !entranceScreen || entranceScreen.classList.contains('hidden')) return;
    sessionStorage.setItem(entranceSeenKey, 'true');
    typingStopped = true;
    clearTimeout(typingTimeout);
    typingAudioContext?.suspend();
    entranceScreen.style.opacity = '0';
    entranceScreen.style.transition = 'opacity 0.8s ease';
    setTimeout(() => {
        entranceScreen.classList.add('hidden');
        mainWebsite?.classList.remove('hidden');
        document.getElementById('bgVideo')?.play().catch(() => {});
    }, 800);
});

const discordLoginBtn = document.getElementById('discordLoginBtn');
const discordAccountMenu = document.getElementById('discordAccountMenu');
const discordSignOut = document.getElementById('discordSignOut');

const discordAuthUrl =
    'https://exp-rp-backend.onrender.com/auth/discord';

const discordApiUrl =
    'https://exp-rp-backend.onrender.com';

    const discordProfileStorageKey =
    'experience-rp-discord-profile';

const renderDiscordProfile = (profile) => {
    if (!profile?.username || !discordLoginBtn) return;

    discordLoginBtn.classList.add('is-connected');

    const avatar = document.createElement('img');

    avatar.className = 'discord-avatar';

    avatar.src =
        profile.avatar?.startsWith('https://cdn.discordapp.com/')
            ? profile.avatar
            : '/images/logoex.png';

    avatar.alt = '';

    const username = document.createElement('span');
    username.textContent = profile.username;

    const arrow = document.createElement('i');

    arrow.className =
        'fas fa-chevron-down discord-login-arrow';

    arrow.setAttribute('aria-hidden', 'true');

    discordLoginBtn.replaceChildren(
        avatar,
        username,
        arrow
    );

    discordLoginBtn.setAttribute(
        'aria-label',
        `Connected as ${profile.username}`
    );
};

const resetDiscordProfile = () => {
    discordAccountMenu?.setAttribute('hidden', '');

    discordLoginBtn?.classList.remove('is-connected');

    if (discordLoginBtn) {
        discordLoginBtn.innerHTML = `
            <i class="fab fa-discord" aria-hidden="true"></i>
            <span>Login with Discord</span>
            <i class="fas fa-arrow-up-right-from-square discord-login-arrow" aria-hidden="true"></i>
        `;

        discordLoginBtn.setAttribute(
            'aria-label',
            'Login with Discord'
        );
    }
};

discordLoginBtn?.addEventListener('click', (event) => {
    event.preventDefault();

    if (discordLoginBtn.classList.contains('is-connected')) {
        discordAccountMenu?.toggleAttribute('hidden');
        return;
    }

    window.location.assign(discordAuthUrl);
});

const checkDiscordSession = async () => {
    // First: check if Discord just redirected us back
    const params = new URLSearchParams(window.location.search);

    const connectedUsername = params.get('username');
    const connectedAvatar = params.get('avatar');

    if (
        params.get('discord') === 'connected' &&
        connectedUsername
    ) {
        const profile = {
            username: connectedUsername,
            avatar: connectedAvatar || ''
        };

        localStorage.setItem(
            discordProfileStorageKey,
            JSON.stringify(profile)
        );

        renderDiscordProfile(profile);

        // Remove ?discord=...&username=...&avatar=...
        // from the URL
        window.history.replaceState(
            {},
            document.title,
            window.location.pathname
        );

        return;
    }

    // Second: use saved profile
    try {
        const savedProfile = JSON.parse(
            localStorage.getItem(discordProfileStorageKey)
        );

        if (savedProfile?.username) {
            renderDiscordProfile(savedProfile);
            return;
        }
    } catch {
        localStorage.removeItem(
            discordProfileStorageKey
        );
    }

    // Third: try backend session
    try {
        const response = await fetch(
            `${discordApiUrl}/auth/me`,
            {
                credentials: 'include',
                cache: 'no-store'
            }
        );

        const data = await response.json();

        console.log('Discord session:', data);

        if (data.authenticated && data.user) {
            const profile = {
                username: data.user.username,
                avatar: data.user.avatar || ''
            };

            localStorage.setItem(
                discordProfileStorageKey,
                JSON.stringify(profile)
            );

            renderDiscordProfile(profile);
        }
    } catch (error) {
        console.error(
            'Discord session check failed:',
            error
        );
    }
};

checkDiscordSession();

discordSignOut?.addEventListener('click', async () => {
    discordAccountMenu?.setAttribute('hidden', '');

    try {
        await fetch(
            `${discordApiUrl}/auth/logout`,
            {
                method: 'POST',
                credentials: 'include'
            }
        );
    } catch (error) {
        console.error('Logout failed:', error);
    }

    localStorage.removeItem(
        discordProfileStorageKey
    );

    resetDiscordProfile();
});

// ============================================
// NAVIGATION TOGGLE (Mobile & Collapse)
// ============================================
const menuBtn = document.getElementById('menuBtn');
const navbar = document.getElementById('navbar');
const collapseBtn = document.getElementById('collapseBtn');
const showNavBtn = document.getElementById('showNavBtn');
let isCollapsed = false;

// Mobile menu toggle
menuBtn?.addEventListener('click', () => {
    navbar.classList.toggle('-translate-x-full');
});

// Close mobile menu on link click
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        if (window.innerWidth < 768) {
            navbar.classList.add('-translate-x-full');
        }
    });
});

// Collapse sidebar on desktop
collapseBtn?.addEventListener('click', () => {
    isCollapsed = !isCollapsed;
    const main = document.querySelector('main');
    const navLinks = document.querySelectorAll('.nav-link span');
    const navTexts = document.querySelectorAll('.nav-link .text-sm');
    const brandText = document.querySelector('.nav-brand-text');
    const collapseSpan = collapseBtn.querySelector('span');
    const collapseIcon = collapseBtn.querySelector('i');
    
    if (isCollapsed) {
        navbar.style.transform = 'translateX(-100%)';
        main.classList.remove('md:ml-64');
        main.classList.add('md:ml-0');
        showNavBtn?.classList.remove('hidden');
    } else {
        navbar.style.transform = '';
        main.classList.remove('md:ml-20');
        main.classList.remove('md:ml-0');
        main.classList.add('md:ml-64');
        showNavBtn?.classList.add('hidden');
    }
});

showNavBtn?.addEventListener('click', () => collapseBtn?.click());

// ============================================
// SMOOTH SCROLL FOR NAV LINKS
// ============================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId && targetId !== '#') {
            e.preventDefault();
            const target = document.querySelector(targetId);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });
});

// ============================================
// VIDEO BACKGROUND - Auto play when visible
// ============================================
const bgVideo = document.getElementById('bgVideo');
if (bgVideo) {
    // Try to play when user interacts
    document.addEventListener('click', () => {
        if (bgVideo.paused) {
            bgVideo.play().catch(() => {});
        }
    }, { once: true });

}

// rules

const rulesData = [
    {
        title: "Vehicle DeathMatch",
        definition: "Using a vehicle to intentionally hit, injure, or kill another player, with or without a valid roleplay reason."
    },
    {
        title: "Power Gaming",
        definition: "Forcing actions onto your character, like falling from a high place and acting like nothing happened."
    },
    {
        title: "Mass RP",
        definition: "Always keep in mind that the city is crowded."
    },
    {
        title: "Mix RP",
        definition: "Insulting someone on Discord because of a situation that happened with them in-game, or having a problem with someone on Discord and going after them in-game."
    },
    {
        title: "Combat Logging",
        definition: "Leaving the game by using Alt+F4 during an active RP scene to avoid the situation."
    },
    {
        title: "Value Of Life",
        definition: "You must always fear for your character and value their life."
    }
];

const rulesContainer = document.getElementById('rulesContainer');

if (rulesContainer) {
rulesData.forEach((rule, index) => {
    const num = String(index + 1).padStart(2, '0');

    const flipCard = document.createElement('div');
    flipCard.className = 'flip-card';

    const inner = document.createElement('div');
    inner.className = 'flip-card-inner';

    // ===== FRONT =====
    const front = document.createElement('div');
    front.className = 'flip-card-front';

    const numberSpan = document.createElement('span');
    numberSpan.className = 'rule-number';
    numberSpan.textContent = num;

    const title = document.createElement('h3');
    title.textContent = rule.title;

    front.appendChild(numberSpan);
    front.appendChild(title);

    // ===== BACK (sans icône) =====
    const back = document.createElement('div');
    back.className = 'flip-card-back';

    const backLabel = document.createElement('div');
    backLabel.className = 'back-label';
    backLabel.textContent = 'DEFINITION'; // Sans icône

    const backTitle = document.createElement('h4');
    backTitle.textContent = rule.title;

    const definitionText = document.createElement('p');
    definitionText.className = 'definition-text';
    definitionText.textContent = rule.definition;

    back.appendChild(backLabel);
    back.appendChild(backTitle);
    back.appendChild(definitionText);

    inner.appendChild(front);
    inner.appendChild(back);
    flipCard.appendChild(inner);
    rulesContainer.appendChild(flipCard);
});
}

// ===== PARTICLES =====
const particlesContainer = document.getElementById('particles');

if (particlesContainer) {
for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.width = (Math.random() * 4 + 2) + 'px';
    particle.style.height = particle.style.width;
    particle.style.animationDuration = (Math.random() * 12 + 8) + 's';
    particle.style.animationDelay = (Math.random() * 10) + 's';
    particle.style.opacity = Math.random() * 0.5 + 0.2;
    particlesContainer.appendChild(particle);
}
}

// Reveal homepage sections as they enter the viewport.
const revealItems = document.querySelectorAll('.home-section-heading, .home-reveal-grid > *');

if (revealItems.length) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

    revealItems.forEach((item) => revealObserver.observe(item));
}