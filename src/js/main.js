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
// TYPING AUDIO
// ============================================================

const getTypingAudioContext = () => {
    try {
        if (!typingAudioContext) {
            const AudioContextClass =
                window.AudioContext ||
                window.webkitAudioContext;

            if (!AudioContextClass) return null;

            typingAudioContext = new AudioContextClass();
        }

        return typingAudioContext;

    } catch {
        return null;
    }
};


const playTypingSound = async () => {
    try {

        typingAudioContext ??= new (
            window.AudioContext ||
            window.webkitAudioContext
        )();

        const audioContext = getTypingAudioContext();

        if (!audioContext || typingStopped) return;

        // Wait until the AudioContext is running
        if (audioContext.state === 'suspended') {
            try {
                await audioContext.resume();
            } catch {
                return;
            }
        }

        if (
            audioContext.state !== 'running' ||
            typingStopped
        ) {
            return;
        }

        const now = audioContext.currentTime;


        // ========================================================
        // KEYBOARD CLICK
        // ========================================================

        const click = audioContext.createBufferSource();

        const clickBuffer = audioContext.createBuffer(
            1,
            Math.floor(audioContext.sampleRate * 0.035),
            audioContext.sampleRate
        );

        const noise = clickBuffer.getChannelData(0);

        for (let index = 0; index < noise.length; index += 1) {
            noise[index] =
                (Math.random() * 2 - 1) *
                (1 - index / noise.length);
        }

        click.buffer = clickBuffer;


        const filter = audioContext.createBiquadFilter();

        filter.type = 'bandpass';
        filter.frequency.value = 1800;
        filter.Q.value = 1.2;


        const clickGain = audioContext.createGain();

        clickGain.gain.setValueAtTime(
            0.11,
            now
        );

        clickGain.gain.exponentialRampToValueAtTime(
            0.001,
            now + 0.035
        );


        click
            .connect(filter)
            .connect(clickGain)
            .connect(audioContext.destination);


        // ========================================================
        // SMALL TONE
        // ========================================================

        const tone = audioContext.createOscillator();

        const toneGain = audioContext.createGain();


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
            .connect(audioContext.destination);


        // ========================================================
        // TRACK ACTIVE SOUNDS
        // ========================================================

        activeTypingSources.add(click);
        activeTypingSources.add(tone);


        click.onended = () => {
            activeTypingSources.delete(click);
        };

        tone.onended = () => {
            activeTypingSources.delete(tone);
        };


        // ========================================================
        // PLAY
        // ========================================================

        click.start(now);
        click.stop(now + 0.05);

        tone.start(now);
        tone.stop(now + 0.075);

    } catch {
        // Never interrupt the typing animation because of audio
    }
};



// ============================================================
// UNLOCK AUDIO
// ============================================================

const unlockTypingSound = () => {
    try {
        const audioContext = getTypingAudioContext();

        if (!audioContext) return;

        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }

    } catch {
        // Ignore audio errors
    }
};



// ============================================================
// STOP AUDIO
// ============================================================

const stopTypingSound = () => {

    try {

        // Stop every active oscillator / buffer source
        activeTypingSources.forEach((source) => {

            try {
                source.stop();
            } catch {
                // Already stopped
            }

        });


        activeTypingSources.clear();


        // Suspend context
        if (typingAudioContext) {
            typingAudioContext
                .suspend()
                .catch(() => {});
        }

    } catch {
        // Ignore audio errors
    }

};



// ============================================================
// TYPING EFFECT
// ============================================================

const startEntranceSequence = () => {
    if (!entranceParagraph || typingStarted) return;

    unlockTypingSound();
    typeEntranceText();
};

const typeEntranceText = () => {

    if (
        !entranceParagraph ||
        typingStarted ||
        (entranceWasSeen && !isPageRefresh)
    ) {
        return;
    }


    typingStarted = true;
    typingStopped = false;


    let characterIndex = 0;


    const typeNextCharacter = () => {

        // Stop immediately when entering the website
        if (typingStopped) {
            return;
        }


        if (characterIndex >= entranceText.length) {
            return;
        }


        // Add next character
        entranceParagraph.textContent +=
            entranceText[characterIndex];


        // Play sound
        if (
            entranceText[characterIndex] !== ' ' &&
            entranceText[characterIndex] !== '\n'
        ) {
            playTypingSound();
        }


        characterIndex += 1;


        // Continue
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


    // Initial delay
    typingTimeout = setTimeout(
        typeNextCharacter,
        2400
    );

};



// ============================================================
// START TYPING
// ============================================================

// Start automatically on first real interaction so audio can unlock safely
window.addEventListener('pointerdown', startEntranceSequence, { once: true });
window.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        startEntranceSequence();
        enterWebsite();
    } else {
        unlockTypingSound();
        if (!typingStarted) startEntranceSequence();
    }
}, { passive: true });

// Keep the original auto-start for first load if the browser allows it
if (!entranceWasSeen || isPageRefresh) {
    startEntranceSequence();
}


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


    // Mark entrance as seen
    sessionStorage.setItem(
        entranceSeenKey,
        'true'
    );


    // Stop typing
    typingStopped = true;


    // Cancel typing timer
    clearTimeout(typingTimeout);


    // Stop all sounds immediately
    stopTypingSound();


    // Fade out entrance
    entranceScreen.style.opacity = '0';

    entranceScreen.style.transition =
        'opacity 0.8s ease';


    // Show main website
    setTimeout(() => {

        entranceScreen.classList.add('hidden');

        mainWebsite?.classList.remove('hidden');


        document
            .getElementById('bgVideo')
            ?.play()
            .catch(() => {});

    }, 800);

};



// ============================================================
// PHONE — TAP
// ============================================================

entranceScreen?.addEventListener(
    'touchstart',
    () => {
        unlockTypingSound();
        if (!typingStarted) startEntranceSequence();
        enterWebsite();
    },
    { passive: true }
);



const discordLoginBtn = document.getElementById('discordLoginBtn');
const discordAccountMenu = document.getElementById('discordAccountMenu');
const discordSignOut = document.getElementById('discordSignOut');
const serverConnectBtn = document.getElementById('serverConnectBtn');
const serverAccessNotice = document.getElementById('serverAccessNotice');
const serverIpBtn = document.getElementById('serverIpBtn');
const serverIpNotice = document.getElementById('serverIpNotice');
const serverIpHref = serverIpBtn?.dataset.href;

const discordAuthUrl =
    'https://exp-rp-backend.onrender.com/auth/discord';

const discordApiUrl =
    'https://exp-rp-backend.onrender.com';

const staffDirectory = document.querySelector('[data-staff-directory]');

const renderStaffDirectory = (members) => {
    if (!staffDirectory || !Array.isArray(members) || !members.length) return;

    const groups = new Map();
    members.forEach((member) => {
        if (!groups.has(member.role)) groups.set(member.role, []);
        groups.get(member.role).push(member);
    });

    staffDirectory.replaceChildren(...Array.from(groups, ([role, roleMembers], index) => {
        const group = document.createElement('section');
        group.className = 'staff-group';
        group.innerHTML = `
            <div class="staff-group-heading">
                <span class="staff-group-index">${String(index + 1).padStart(2, '0')}</span>
                <div><span class="staff-group-kicker">Discord role</span><h3>${role}</h3></div>
                <span class="staff-group-count">${roleMembers.length} member${roleMembers.length === 1 ? '' : 's'}</span>
            </div>
            <div class="staff-directory"></div>
        `;

        const directory = group.querySelector('.staff-directory');
        roleMembers.forEach((member) => {
            const card = document.createElement('article');
            card.className = 'staff-member';
            card.innerHTML = '<img class="staff-member-avatar" alt=""><div><h4></h4><span></span></div>';
            card.querySelector('img').src = member.avatar;
            card.querySelector('img').alt = member.name;
            card.querySelector('h4').textContent = member.name;
            card.querySelector('span').textContent = role;
            directory.append(card);
        });
        return group;
    }));

    const count = document.querySelector('.staff-live');
    if (count) count.innerHTML = `<span></span> ${members.length} staff member${members.length === 1 ? '' : 's'}`;
};

const refreshStaffDirectory = async () => {
    try {
        const response = await fetch(`${discordApiUrl}/api/staff`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        renderStaffDirectory(data.members);
    } catch (error) {
        console.warn('Staff directory refresh failed:', error);
    }
};

refreshStaffDirectory();
setInterval(refreshStaffDirectory, 60_000);

    const discordProfileStorageKey =
    'experience-rp-discord-profile';

const applyServerAccessState = (hasAccess) => {
    if (serverConnectBtn) {
        serverConnectBtn.classList.toggle('hidden', !hasAccess);
    }

    if (serverAccessNotice) {
        serverAccessNotice.classList.toggle('hidden', hasAccess);
    }

    if (serverIpBtn) {
        serverIpBtn.toggleAttribute('aria-disabled', !hasAccess);
        serverIpNotice?.toggleAttribute('hidden', hasAccess);

        if (hasAccess) {
            serverIpBtn.setAttribute('href', serverIpHref);
        } else {
            serverIpBtn.removeAttribute('href');
        }
    }
};

serverIpBtn?.addEventListener('click', (event) => {
    if (serverIpBtn.hasAttribute('aria-disabled')) {
        event.preventDefault();
        serverIpNotice?.removeAttribute('hidden');
    }
});

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
    applyServerAccessState(false);

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
    const hasSurvivorsRole = params.get('survivors') === 'true';

    if (
        params.get('discord') === 'connected' &&
        connectedUsername
    ) {
        const profile = {
            username: connectedUsername,
            avatar: connectedAvatar || '',
            hasSurvivorsRole
        };

        localStorage.setItem(
            discordProfileStorageKey,
            JSON.stringify(profile)
        );

        renderDiscordProfile(profile);
        applyServerAccessState(hasSurvivorsRole);

        // Remove ?discord=...&username=...&avatar=...&survivors=...
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
            applyServerAccessState(!!savedProfile.hasSurvivorsRole);
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
                avatar: data.user.avatar || '',
                hasSurvivorsRole: !!data.user.hasSurvivorsRole
            };

            localStorage.setItem(
                discordProfileStorageKey,
                JSON.stringify(profile)
            );

            renderDiscordProfile(profile);
            applyServerAccessState(!!data.user.hasSurvivorsRole);
        } else {
            applyServerAccessState(false);
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
    applyServerAccessState(false);
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


/* =========================================================
   EXPERIENCE RP — ADVANCED CIRCULAR CURSOR
   ========================================================= */

(() => {

    if (
        window.matchMedia("(hover: none), (pointer: coarse)").matches
    ) {
        return;
    }

    /* =====================================================
       CREATE CURSOR
       ===================================================== */

    const cursor = document.createElement("div");

    cursor.className = "exp-cursor";

    cursor.innerHTML = `
        <div class="exp-cursor-glow"></div>

        <div class="exp-cursor-ring"></div>

        <div class="exp-cursor-arrow">
            <img
                class="exp-cursor-logo"
                src="/images/logodis_cursor.png"
                alt=""
            />
        </div>
    `;

    document.body.appendChild(cursor);


    /* =====================================================
       POSITION
       ===================================================== */

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;

    let cursorX = mouseX;
    let cursorY = mouseY;

    let lastTrail = 0;


    document.addEventListener("mousemove", (e) => {

        mouseX = e.clientX;
        mouseY = e.clientY;

        const now = performance.now();

        if (now - lastTrail > 25) {
            createTrail(mouseX, mouseY);
            lastTrail = now;
        }
    });


    /* =====================================================
       SMOOTH MOVEMENT
       ===================================================== */

    function animateCursor() {

        cursorX += (mouseX - cursorX) * 0.20;
        cursorY += (mouseY - cursorY) * 0.20;

        cursor.style.transform =
            `translate3d(${cursorX}px, ${cursorY}px, 0) translate(-50%, -50%)`;

        requestAnimationFrame(animateCursor);
    }

    animateCursor();


    /* =====================================================
       TRAIL
       ===================================================== */

    function createTrail(x, y) {

        const trail = document.createElement("div");

        trail.className = "exp-trail";

        const size = 3 + Math.random() * 5;

        trail.style.width = `${size}px`;
        trail.style.height = `${size}px`;

        trail.style.left = `${x}px`;
        trail.style.top = `${y}px`;

        document.body.appendChild(trail);

        setTimeout(() => {
            trail.remove();
        }, 700);


        if (Math.random() > 0.72) {
            createParticle(x, y);
        }
    }


    /* =====================================================
       PARTICLES
       ===================================================== */

    function createParticle(x, y) {

        const particle = document.createElement("div");

        particle.className = "exp-particle";

        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;

        particle.style.setProperty(
            "--random-x",
            Math.random()
        );

        particle.style.setProperty(
            "--random-y",
            Math.random()
        );

        document.body.appendChild(particle);

        setTimeout(() => {
            particle.remove();
        }, 750);
    }


    /* =====================================================
       HOVER
       ===================================================== */

    const hoverElements = `
        a,
        button,
        [role="button"],
        input[type="submit"],
        input[type="button"],
        .btn,
        .button,
        .nav-link,
        .card,
        .clickable
    `;


    document.addEventListener("mouseover", (e) => {

        const target = e.target.closest(hoverElements);

        if (target) {
            cursor.classList.add("hover");
            cursor.classList.remove("text-mode");
        }

    });


    document.addEventListener("mouseout", (e) => {

        const target = e.target.closest(hoverElements);

        if (target) {
            cursor.classList.remove("hover");
        }

    });


    /* =====================================================
       TEXT MODE
       ===================================================== */

    const textElements = `
        p,
        span,
        h1,
        h2,
        h3,
        h4,
        h5,
        h6,
        label
    `;


    document.addEventListener("mouseover", (e) => {

        const text = e.target.closest(textElements);

        if (text && !text.closest(hoverElements)) {

            cursor.classList.add("text-mode");

        }

    });


    document.addEventListener("mouseout", (e) => {

        const text = e.target.closest(textElements);

        if (text) {

            cursor.classList.remove("text-mode");

        }

    });


    /* =====================================================
       CLICK
       ===================================================== */

    document.addEventListener("mousedown", (e) => {

        cursor.classList.add("clicking");

        createRipple(
            e.clientX,
            e.clientY
        );

    });


    document.addEventListener("mouseup", () => {

        cursor.classList.remove("clicking");

    });


    /* =====================================================
       RIPPLE
       ===================================================== */

    function createRipple(x, y) {

        const ripple = document.createElement("div");

        ripple.className = "exp-click-ripple";

        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;

        document.body.appendChild(ripple);


        for (let i = 0; i < 5; i++) {

            setTimeout(() => {

                createParticle(x, y);

            }, i * 25);

        }


        setTimeout(() => {

            ripple.remove();

        }, 700);
    }


    /* =====================================================
       WINDOW LEAVE / ENTER
       ===================================================== */

    document.addEventListener("mouseleave", () => {

        cursor.style.opacity = "0";

    });


    document.addEventListener("mouseenter", () => {

        cursor.style.opacity = "1";

    });

})();