/* =========================================================
   EXPERIENCE RP — FIELD TEST
   Rules Quiz Controller
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const quizIntro = document.getElementById("quizIntro");
    const quizGame = document.getElementById("quizGame");
    const quizResult = document.getElementById("quizResult");

    const startQuiz = document.getElementById("startQuiz");
    const nextQuestion = document.getElementById("nextQuestion");
    const restartQuiz = document.getElementById("restartQuiz");
    const returnToRules = document.getElementById("returnToRules");

    const currentQuestion = document.getElementById("currentQuestion");
    const scenarioNumber = document.getElementById("scenarioNumber");

    const scenarioRule = document.getElementById("scenarioRule");
    const scenarioIcon = document.getElementById("scenarioIcon");
    const scenarioTitle = document.getElementById("scenarioTitle");
    const scenarioDescription = document.getElementById("scenarioDescription");

    const quizOptions = document.getElementById("quizOptions");

    const quizFeedback = document.getElementById("quizFeedback");
    const feedbackIcon = document.getElementById("feedbackIcon");
    const feedbackTitle = document.getElementById("feedbackTitle");
    const feedbackText = document.getElementById("feedbackText");

    const nextQuestionText = document.getElementById("nextQuestionText");

    const quizProgressBar = document.getElementById("quizProgressBar");
    const progressDots = document.querySelectorAll(".progress-dot");

    const quizScore = document.getElementById("quizScore");
    const quizCombo = document.getElementById("quizCombo");

    const finalScore = document.getElementById("finalScore");
    const resultTitle = document.getElementById("resultTitle");
    const resultSubtitle = document.getElementById("resultSubtitle");
    const resultPercentage = document.getElementById("resultPercentage");
    const resultBarFill = document.getElementById("resultBarFill");
    const resultIcon = document.getElementById("resultIcon");
    const resultRules = document.getElementById("resultRules");


    /* =====================================================
       QUIZ DATA
       ===================================================== */

    const scenarios = [

        {
            rule: "RULE 01 — LORE RP",
            name: "LORE RP",
            icon: "fa-book-open",

            title: "A world with its own story.",

            description:
                "Your character enters a faction with an established history and hierarchy. Someone asks you to ignore the faction's story and invent your own background on the spot. What do you do?",

            options: [
                "Follow the established lore and adapt your character to it.",
                "Ignore the lore because your character is independent.",
                "Replace the faction's history with your own version.",
                "Act as if the established world does not exist."
            ],

            correct: 0,

            feedback: [
                "Your character fits naturally into the existing world and respects its established story.",
                "Being independent does not remove the responsibility to respect the server's established lore.",
                "Replacing established lore breaks the continuity of the world and its factions.",
                "Ignoring the server's world-building prevents coherent roleplay."
            ]
        },

        {
            rule: "RULE 02 — QUALITY RP",
            name: "QUALITY RP",
            icon: "fa-masks-theater",

            title: "The scene is getting serious.",

            description:
                "You're involved in a tense roleplay scene. Another player makes a small mistake. What keeps the scene enjoyable for everyone?",

            options: [
                "Turn the mistake into something your characters can roleplay around.",
                "Break character and make fun of the player.",
                "Use the mistake as an excuse to troll the scene.",
                "Ignore the entire scene and intentionally ruin it."
            ],

            correct: 0,

            feedback: [
                "You keep the interaction inside the roleplay and help the scene continue naturally.",
                "Breaking character to attack another player damages the roleplay experience.",
                "Turning mistakes into trolling lowers the quality of the scene.",
                "Intentionally ruining a scene works against quality roleplay."
            ]
        },

        {
            rule: "RULE 03 — LOGIC RP",
            name: "LOGIC RP",
            icon: "fa-scale-balanced",

            title: "Your character is badly injured.",

            description:
                "After a serious crash, your character is visibly injured and struggling to move. What is the logical RP response?",

            options: [
                "Continue as if nothing happened.",
                "Roleplay the injury and its realistic consequences.",
                "Immediately start another physical confrontation.",
                "Pretend the crash had no effect on your character."
            ],

            correct: 1,

            feedback: [
                "Ignoring a serious injury removes believable consequences from the situation.",
                "The injury should affect your character's actions and create believable consequences.",
                "Starting another confrontation without acknowledging the injury ignores the situation's consequences.",
                "A serious event should have believable effects on your character."
            ]
        },

        {
            rule: "RULE 04 — METAGAMING",
            name: "METAGAMING",
            icon: "fa-user-secret",

            title: "Information from outside the city.",

            description:
                "Your friend tells you on Discord that police are waiting outside your location. Your character has no way of knowing this. What do you do?",

            options: [
                "Use the information and escape immediately.",
                "Warn your character about the police.",
                "Ignore the information because your character never received it.",
                "Tell another player so they can react first."
            ],

            correct: 2,

            feedback: [
                "Using outside information gives your character knowledge they did not obtain through RP.",
                "Your character cannot act on information they never received in-game.",
                "You keep OOC information separate from your character's IC knowledge.",
                "Passing outside information to another player still uses information obtained outside RP."
            ]
        },

        {
            rule: "RULE 05 — NO EXPLOITS",
            name: "NO EXPLOITS",
            icon: "fa-shield-halved",

            title: "You found something that shouldn't exist.",

            description:
                "You discover a bug that can duplicate money. Nobody else seems to know about it. What is the correct move?",

            options: [
                "Use it while the bug still works.",
                "Share the method with your friends.",
                "Keep the exploit secret and use it slowly.",
                "Stop using it and report the exploit to staff."
            ],

            correct: 3,

            feedback: [
                "Using a duplication bug gives an unfair advantage through an exploit.",
                "Sharing an exploit spreads the abuse instead of resolving the problem.",
                "Using the exploit secretly is still exploiting the bug.",
                "Reporting the exploit allows staff to investigate and fix the issue."
            ]
        }

    ];


    /* =====================================================
       STATE
       ===================================================== */

    let questionIndex = 0;
    let score = 0;
    let combo = 0;
    let answered = false;
    let answers = [];


    /* =====================================================
       UTILITIES
       ===================================================== */

    const pad = (number) => {
        return String(number).padStart(2, "0");
    };


    /* =====================================================
       RESET QUIZ
       Completely clears previous test state.
       ===================================================== */

    const resetQuiz = () => {

        questionIndex = 0;
        score = 0;
        combo = 0;
        answered = false;
        answers = [];

        quizScore.textContent = "00";

        quizCombo.innerHTML = `
            <i class="fas fa-bolt"></i>
            <span>COMBO ×0</span>
        `;

        quizCombo.classList.remove("combo-active");

        quizProgressBar.style.width = "0%";

        progressDots.forEach((dot, index) => {

            dot.classList.remove("active");
            dot.classList.remove("complete");

            if (index === 0) {
                dot.classList.add("active");
            }

        });

        /* Clear previous scenario */

        quizOptions.innerHTML = "";

        quizFeedback.hidden = true;
        quizFeedback.classList.remove("feedback-wrong");

        feedbackIcon.innerHTML =
            `<i class="fas fa-check"></i>`;

        feedbackTitle.textContent =
            "GOOD CALL";

        feedbackText.textContent =
            "You made the right decision.";

        nextQuestion.hidden = true;

        nextQuestionText.textContent =
            "NEXT SCENARIO";

        resultBarFill.style.width = "0%";

    };


    /* =====================================================
       SCREEN CONTROL
       ===================================================== */

    const showScreen = (screen) => {

    [quizIntro, quizGame, quizResult].forEach((element) => {

        if (!element) return;

        element.hidden = true;

        element.classList.remove(
            "quiz-show",
            "quiz-hide"
        );
    });

    if (!screen) return;

    screen.hidden = false;

    requestAnimationFrame(() => {
        screen.classList.add("quiz-show");
    });
};


    /* =====================================================
       SCROLL
       ===================================================== */

    const scrollToQuiz = () => {

        const fieldTest =
            document.getElementById("fieldTest");

        if (!fieldTest) {
            return;
        }

        const rect =
            fieldTest.getBoundingClientRect();

        window.scrollTo({
            top: window.scrollY + rect.top - 30,
            behavior: "smooth"
        });

    };


    /* =====================================================
       LOAD QUESTION
       ===================================================== */

    const loadQuestion = () => {

        const scenario =
            scenarios[questionIndex];

        if (!scenario) {
            finishQuiz();
            return;
        }

        /* ---------------------------------------------
           RESET CURRENT QUESTION STATE
           --------------------------------------------- */

        answered = false;

quizFeedback.hidden = true;
quizFeedback.classList.remove("feedback-wrong");

feedbackIcon.innerHTML = `
    <i class="fas fa-check"></i>
`;

feedbackTitle.textContent = "";
feedbackText.textContent = "";

nextQuestion.hidden = true;


        /* ---------------------------------------------
           CLEAR OLD OPTIONS
           --------------------------------------------- */

        quizOptions.innerHTML = "";


        /* ---------------------------------------------
           BASIC SCENARIO DATA
           --------------------------------------------- */

        currentQuestion.textContent =
            pad(questionIndex + 1);

        scenarioNumber.textContent =
            pad(questionIndex + 1);

        scenarioRule.textContent =
            scenario.rule;

        scenarioIcon.className =
            `fas ${scenario.icon}`;

        scenarioTitle.textContent =
            scenario.title;

        scenarioDescription.textContent =
            scenario.description;


        /* ---------------------------------------------
           PROGRESS
           --------------------------------------------- */

        const progress =
            ((questionIndex + 1) /
                scenarios.length) * 100;

        quizProgressBar.style.width =
            `${progress}%`;


        progressDots.forEach((dot, index) => {

            dot.classList.remove("active");

            if (index < questionIndex) {

                dot.classList.add("complete");

            } else {

                dot.classList.remove("complete");

            }

            if (index === questionIndex) {

                dot.classList.add("active");

            }

        });


        /* ---------------------------------------------
           ANSWERS
           --------------------------------------------- */

        const letters = [
            "A",
            "B",
            "C",
            "D"
        ];

        scenario.options.forEach(
            (option, index) => {

                const button =
                    document.createElement("button");

                button.type = "button";

                button.className =
                    "quiz-option";

                button.dataset.index =
                    String(index);

                button.innerHTML = `
                    <span class="option-letter">
                        ${letters[index]}
                    </span>

                    <span class="option-text">
                        ${option}
                    </span>

                    <i class="fas fa-arrow-right option-arrow"></i>
                `;

                button.addEventListener(
                    "click",
                    () => handleAnswer(index)
                );

                quizOptions.appendChild(button);

            }
        );


        /* ---------------------------------------------
           SCENARIO TRANSITION
           --------------------------------------------- */

        const scenarioContainer =
            document.querySelector(
                ".quiz-scenario"
            );

        if (scenarioContainer) {

            scenarioContainer.classList.remove(
                "scenario-changing"
            );

            void scenarioContainer.offsetWidth;

            scenarioContainer.classList.add(
                "scenario-changing"
            );

        }


        /* ---------------------------------------------
           NEXT BUTTON LABEL
           --------------------------------------------- */

        if (
            questionIndex ===
            scenarios.length - 1
        ) {

            nextQuestionText.textContent =
                "VIEW RESULTS";

        } else {

            nextQuestionText.textContent =
                "NEXT SCENARIO";

        }

    };


    /* =====================================================
       HANDLE ANSWER
       ===================================================== */

    const handleAnswer = (selectedIndex) => {

        if (answered) {
            return;
        }

        answered = true;

        const scenario =
            scenarios[questionIndex];

        const isCorrect =
            selectedIndex === scenario.correct;

        answers[questionIndex] =
            isCorrect;


        /* ---------------------------------------------
           ANSWER BUTTONS
           --------------------------------------------- */

        const optionButtons =
            quizOptions.querySelectorAll(
                ".quiz-option"
            );

        optionButtons.forEach(
            (button, index) => {

                button.disabled = true;

                if (
                    index === scenario.correct
                ) {

                    button.classList.add(
                        "correct"
                    );

                }

                if (
                    index === selectedIndex &&
                    index !== scenario.correct
                ) {

                    button.classList.add(
                        "wrong"
                    );

                }

            }
        );


        /* ---------------------------------------------
           SCORE / COMBO
           --------------------------------------------- */

        if (isCorrect) {

            score++;
            combo++;

        } else {

            combo = 0;

        }

        quizScore.textContent =
            pad(score);

        quizCombo.innerHTML = `
            <i class="fas fa-bolt"></i>
            <span>COMBO ×${combo}</span>
        `;


        if (
            isCorrect &&
            combo >= 2
        ) {

            quizCombo.classList.add(
                "combo-active"
            );

            setTimeout(() => {

                quizCombo.classList.remove(
                    "combo-active"
                );

            }, 500);

        }


        /* ---------------------------------------------
           FEEDBACK
           --------------------------------------------- */

        quizFeedback.hidden = false;

        if (isCorrect) {

            quizFeedback.classList.remove(
                "feedback-wrong"
            );

            feedbackIcon.innerHTML =
                `<i class="fas fa-check"></i>`;

            feedbackTitle.textContent =
                combo >= 2
                    ? `GOOD CALL — COMBO ×${combo}`
                    : "GOOD CALL";

        } else {

            quizFeedback.classList.add(
                "feedback-wrong"
            );

            feedbackIcon.innerHTML =
                `<i class="fas fa-xmark"></i>`;

            feedbackTitle.textContent =
                "NOT THIS TIME";

        }

        feedbackText.textContent =
            scenario.feedback[selectedIndex];


        /* ---------------------------------------------
           SHOW NEXT
           --------------------------------------------- */

        nextQuestion.hidden = false;

    };


    /* =====================================================
       NEXT QUESTION
       ===================================================== */

    nextQuestion.addEventListener(
        "click",
        () => {

            if (!answered) {
                return;
            }

            questionIndex++;

            if (
                questionIndex >=
                scenarios.length
            ) {

                finishQuiz();

            } else {

                loadQuestion();

            }

        }
    );


    /* =====================================================
       FINISH QUIZ
       ===================================================== */

    const finishQuiz = () => {

        showScreen(quizResult);

        const percentage =
            Math.round(
                (score / scenarios.length) * 100
            );

        finalScore.textContent =
            pad(score);

        resultPercentage.textContent =
            `${percentage}%`;

        resultBarFill.style.width =
            "0%";


        /* ---------------------------------------------
           RESULT STATE
           --------------------------------------------- */

        let title = "";
        let subtitle = "";
        let icon = "fa-shield-halved";


        if (score === 5) {

            title = "PERFECT RUN";

            subtitle =
                "Your instincts are exactly where they need to be.";

            icon = "fa-crown";

        } else if (score === 4) {

            title = "READY TO PLAY";

            subtitle =
                "Strong instincts. You understand the essentials.";

            icon = "fa-shield-halved";

        } else if (score === 3) {

            title = "REVIEW THE RULEBOOK";

            subtitle =
                "You're close. A quick review will sharpen your instincts.";

            icon = "fa-book-open";

        } else {

            title = "TRAINING REQUIRED";

            subtitle =
                "Take another look at the rules before entering the city.";

            icon = "fa-triangle-exclamation";

        }


        resultTitle.textContent =
            title;

        resultSubtitle.textContent =
            subtitle;

        resultIcon.innerHTML =
            `<i class="fas ${icon}"></i>`;


        /* ---------------------------------------------
           INDIVIDUAL RULE RESULTS
           --------------------------------------------- */

        resultRules.innerHTML = "";

        scenarios.forEach(
            (scenario, index) => {

                const item =
                    document.createElement("div");

                const wasCorrect =
                    answers[index] === true;

                item.className =
                    `result-rule ${
                        wasCorrect
                            ? "correct"
                            : "wrong"
                    }`;

                item.innerHTML = `
                    <span class="result-rule-number">
                        ${pad(index + 1)}
                    </span>

                    <span class="result-rule-name">
                        ${scenario.name}
                    </span>

                    <span class="result-rule-status">
                        <i class="fas ${
                            wasCorrect
                                ? "fa-check"
                                : "fa-xmark"
                        }"></i>
                    </span>
                `;

                resultRules.appendChild(item);

            }
        );


        /* ---------------------------------------------
           RESULT BAR ANIMATION
           --------------------------------------------- */

        requestAnimationFrame(() => {

            setTimeout(() => {

                resultBarFill.style.width =
                    `${percentage}%`;

            }, 120);

        });

    };


    /* =====================================================
       START FIELD TEST
       ===================================================== */

    startQuiz.addEventListener("click", () => {

    resetQuiz();

    showScreen(quizGame);

    loadQuestion();

    setTimeout(() => {
        scrollToQuiz();
    }, 80);

});


    /* =====================================================
       RUN TEST AGAIN
       
       IMPORTANT:
       Does NOT start the quiz directly.
       It returns to the INTRO screen.
       The player must press START FIELD TEST again.
       ===================================================== */

    restartQuiz.addEventListener("click", () => {

    /* Reset quiz state */
    questionIndex = 0;
    score = 0;
    combo = 0;
    answers = [];
    answered = false;

    /* Reset UI */
    quizScore.textContent = "00";

    quizCombo.innerHTML = `
        <i class="fas fa-bolt"></i>
        <span>COMBO ×0</span>
    `;

    quizFeedback.hidden = true;
    nextQuestion.hidden = true;

    quizOptions.innerHTML = "";

    resultBarFill.style.width = "0%";

    /* Go back to START FIELD TEST screen */
    showScreen(quizIntro);

    /* Scroll to Field Test intro */
    setTimeout(() => {
        scrollToQuiz();
    }, 80);

});


    /* =====================================================
       RETURN TO RULES
       ===================================================== */

    returnToRules.addEventListener(
        "click",
        () => {

            resetQuiz();

            showScreen(quizIntro);

            const rulesList =
                document.querySelector(
                    ".rules-list"
                );

            if (!rulesList) {
                return;
            }

            setTimeout(() => {

                rulesList.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

            }, 100);

        }
    );


    /* =====================================================
       KEYBOARD SUPPORT
       A / B / C / D
       ===================================================== */

    document.addEventListener(
        "keydown",
        (event) => {

            if (
                quizGame.hidden ||
                answered
            ) {
                return;
            }

            const key =
                event.key.toLowerCase();

            const keyMap = {
                a: 0,
                b: 1,
                c: 2,
                d: 3
            };

            if (
                Object.prototype.hasOwnProperty.call(
                    keyMap,
                    key
                )
            ) {

                handleAnswer(
                    keyMap[key]
                );

            }

        }
    );

});
