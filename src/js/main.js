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
let activeTypingSources = new Set();

const navigationEntry = performance.getEntriesByType('navigation')[0];
const isPageRefresh = navigationEntry?.type === 'reload';
const entranceWasSeen = sessionStorage.getItem(entranceSeenKey) === 'true';

if (isPageRefresh) sessionStorage.removeItem(entranceSeenKey);

if (entranceScreen && entranceWasSeen && !isPageRefresh) {
    entranceScreen.classList.add('hidden');
    mainWebsite?.classList.remove('hidden');
}
// ============================================================
// ENTRANCE TYPING SOUND

// Create and play typing sound
const playTypingSound = () => {
    try {
        typingAudioContext ??= new (
            window.AudioContext ||
            window.webkitAudioContext
        )();

        // Try to resume the audio context
        if (typingAudioContext.state === 'suspended') {
            typingAudioContext.resume().catch(() => {});
        }

        // Don't try to play if the browser hasn't unlocked audio
        if (typingAudioContext.state !== 'running') {
            return;
        }

        const now = typingAudioContext.currentTime;


        // --------------------------------------------------------
        // Keyboard click
        // --------------------------------------------------------

        const click = typingAudioContext.createBufferSource();

        const clickBuffer = typingAudioContext.createBuffer(
            1,
            Math.floor(typingAudioContext.sampleRate * 0.035),
            typingAudioContext.sampleRate
        );

        const noise = clickBuffer.getChannelData(0);

        for (let index = 0; index < noise.length; index += 1) {
            noise[index] =
                (Math.random() * 2 - 1) *
                (1 - index / noise.length);
        }

        click.buffer = clickBuffer;


        const filter = typingAudioContext.createBiquadFilter();

        filter.type = 'bandpass';
        filter.frequency.value = 1800;
        filter.Q.value = 1.2;


        const clickGain = typingAudioContext.createGain();

        clickGain.gain.setValueAtTime(0.11, now);

        clickGain.gain.exponentialRampToValueAtTime(
            0.001,
            now + 0.035
        );


        click
            .connect(filter)
            .connect(clickGain)
            .connect(typingAudioContext.destination);


        // --------------------------------------------------------
        // Small tone
        // --------------------------------------------------------

        const tone = typingAudioContext.createOscillator();

        const toneGain = typingAudioContext.createGain();


        tone.type = 'triangle';

        tone.frequency.setValueAtTime(
            160 + Math.random() * 30,
            now
        );

        tone.frequency.exponentialRampToValueAtTime(
            85,
            now + 0.07
        );


        toneGain.gain.setValueAtTime(
            0.045,
            now
        );

        toneGain.gain.exponentialRampToValueAtTime(
            0.001,
            now + 0.07
        );


        tone
            .connect(toneGain)
            .connect(typingAudioContext.destination);


        // --------------------------------------------------------
        // Track active sounds
        // --------------------------------------------------------

        activeTypingSources.add(click);
        activeTypingSources.add(tone);


        click.onended = () => {
            activeTypingSources.delete(click);
        };

        tone.onended = () => {
            activeTypingSources.delete(tone);
        };


        // Start sounds
        click.start(now);
        click.stop(now + 0.05);


        tone.start(now);
        tone.stop(now + 0.075);

    } catch {
        // Ignore audio errors
    }
};



// ============================================================
// UNLOCK TYPING AUDIO
// ============================================================

const unlockTypingSound = () => {
    try {
        typingAudioContext ??= new (
            window.AudioContext ||
            window.webkitAudioContext
        )();

        if (typingAudioContext.state === 'suspended') {
            typingAudioContext.resume().catch(() => {});
        }

    } catch {
        // Ignore audio errors
    }
};



// ============================================================
// STOP TYPING SOUND IMMEDIATELY
// ============================================================

const stopTypingSound = () => {
    try {

        activeTypingSources.forEach((source) => {
            try {
                source.stop();
            } catch {
                // Already stopped
            }
        });

        activeTypingSources.clear();


        if (typingAudioContext) {
            typingAudioContext.suspend().catch(() => {});
        }

    } catch {
        // Ignore audio errors
    }
};



// ============================================================
// ENTRANCE TYPING EFFECT
// ============================================================

const typeEntranceText = () => {

    if (
        !entranceParagraph ||
        typingStarted ||
        (entranceWasSeen && !isPageRefresh)
    ) {
        return;
    }


    typingStarted = true;


    let characterIndex = 0;


    const typeNextCharacter = () => {

        // Stop immediately when entering the website
        if (typingStopped) {
            return;
        }


        // Make sure the character exists
        if (characterIndex >= entranceText.length) {
            return;
        }


        // Add character
        entranceParagraph.textContent +=
            entranceText[characterIndex];


        // Play typing sound
        if (
            entranceText[characterIndex] !== ' ' &&
            entranceText[characterIndex] !== '\n'
        ) {
            playTypingSound();
        }


        characterIndex += 1;


        // Continue typing
        if (
            characterIndex < entranceText.length &&
            !typingStopped
        ) {
            typingTimeout = setTimeout(
                typeNextCharacter,
                42
            );
        }
    };


    // Delay before typing starts
    typingTimeout = setTimeout(
        typeNextCharacter,
        2400
    );
};



// ============================================================
// START ENTRANCE TYPING
// ============================================================

// IMPORTANT:
// Start typing on both PC and mobile.
// Do NOT use ontouchstart detection here.
typeEntranceText();



// ============================================================
// ENTER WEBSITE
// ============================================================

const enterWebsite = () => {

    if (
        !entranceScreen ||
        entranceScreen.classList.contains('hidden')
    ) {
        return;
    }


    // Remember that entrance was seen
    sessionStorage.setItem(
        entranceSeenKey,
        'true'
    );


    // Stop typing immediately
    typingStopped = true;


    // Cancel pending typing timeout
    clearTimeout(typingTimeout);


    // Stop every currently playing typing sound
    stopTypingSound();


    // Fade out entrance
    entranceScreen.style.opacity = '0';

    entranceScreen.style.transition =
        'opacity 0.8s ease';


    // Show main website
    setTimeout(() => {

        entranceScreen.classList.add('hidden');

        mainWebsite?.classList.remove('hidden');


        // Start background video
        document
            .getElementById('bgVideo')
            ?.play()
            .catch(() => {});

    }, 800);
};



// ============================================================
// PC — ENTER KEY
// ============================================================

document.addEventListener('keydown', (event) => {

    if (event.key === 'Enter') {

        enterWebsite();

    } else {

        unlockTypingSound();

    }

});



// ============================================================
// PHONE — TAP
// ============================================================

// One tap = enter website
// The typing text/sound is stopped immediately.
entranceScreen?.addEventListener(
    'touchstart',
    () => {

        enterWebsite();

    },
    { passive: true }
);



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


// =========================
// MOBILE OPEN
// =========================

menuBtn?.addEventListener('click', () => {
    if (window.innerWidth >= 768) return;

    // Open navbar
    navbar.classList.remove('-translate-x-full');

    // Hide menu button while navbar is open
    menuBtn.classList.add('hidden');
});


// =========================
// COLLAPSE NAVBAR
// =========================

collapseBtn?.addEventListener('click', () => {

    const main = document.querySelector('main');

    // =====================
    // MOBILE
    // =====================
    if (window.innerWidth < 768) {

        // Close navbar
        navbar.classList.add('-translate-x-full');

        // Show menu button again
        menuBtn?.classList.remove('hidden');

        return;
    }


    // =====================
    // DESKTOP
    // =====================

    // Remove the class that forces navbar visible on desktop
    navbar.classList.remove('md:translate-x-0');

    // Hide navbar on desktop
    navbar.classList.add('md:-translate-x-full');

    // Move main content
    main?.classList.remove('md:ml-64');
    main?.classList.add('md:ml-0');

    // Show the > button
    showNavBtn?.classList.remove('hidden');
});


// =========================
// SHOW NAVBAR DESKTOP
// =========================

showNavBtn?.addEventListener('click', () => {

    if (window.innerWidth < 768) return;

    const main = document.querySelector('main');

    // Remove desktop hidden state
    navbar.classList.remove('md:-translate-x-full');

    // Make navbar visible
    navbar.classList.add('md:translate-x-0');

    // Restore main content
    main?.classList.remove('md:ml-0');
    main?.classList.add('md:ml-64');

    // Hide > button
    showNavBtn?.classList.add('hidden');
});


// =========================
// MOBILE LINK CLICK
// =========================

document.querySelectorAll('.nav-link').forEach(link => {

    link.addEventListener('click', () => {

        if (window.innerWidth < 768) {

            navbar.classList.add('-translate-x-full');

            menuBtn?.classList.remove('hidden');
        }

    });

});

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