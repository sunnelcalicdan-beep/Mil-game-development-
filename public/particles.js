"use strict";

/*
========================================================
PROJECT FILE HUB
OPTIMIZED PARTICLE ENGINE
========================================================

Features:
- Automatically detects device performance
- Low-end devices = fewer particles
- High-end devices = more particles
- Caps devicePixelRatio
- Pauses when tab is hidden
- Pauses when page is not visible
- Uses requestAnimationFrame
- No DOM particle elements
- No per-frame CSS filters
- No expensive shadows per particle
- Automatically adapts to FPS
- Respects prefers-reduced-motion
========================================================
*/

(() => {

    const canvas =
        document.getElementById("particleCanvas");

    if (!canvas) {
        return;
    }

    const ctx =
        canvas.getContext("2d", {
            alpha: true,
            desynchronized: true
        });

    if (!ctx) {
        return;
    }


    /*
    ========================================================
    DEVICE DETECTION
    ========================================================
    */

    const connection =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;

    const reducedMotion =
        window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

    const cores =
        navigator.hardwareConcurrency || 4;

    const memory =
        navigator.deviceMemory || 4;

    const mobile =
        window.matchMedia(
            "(max-width: 700px)"
        ).matches;


    /*
    ========================================================
    PERFORMANCE LEVEL
    ========================================================
    */

    let performanceLevel = "medium";


    if (reducedMotion) {

        performanceLevel = "minimal";

    }
    else if (
        cores <= 2 ||
        memory <= 2
    ) {

        performanceLevel = "low";

    }
    else if (
        cores >= 8 &&
        memory >= 8
    ) {

        performanceLevel = "high";

    }


    /*
    ========================================================
    PARTICLE COUNTS
    ========================================================
    */

    const particleSettings = {

        minimal: {
            desktop: 12,
            mobile: 7,
            speed: 0.12,
            connectionDistance: 0,
            glow: false
        },

        low: {
            desktop: 22,
            mobile: 12,
            speed: 0.20,
            connectionDistance: 75,
            glow: false
        },

        medium: {
            desktop: 38,
            mobile: 18,
            speed: 0.27,
            connectionDistance: 95,
            glow: false
        },

        high: {
            desktop: 58,
            mobile: 28,
            speed: 0.34,
            connectionDistance: 110,
            glow: false
        }

    };


    const settings =
        particleSettings[
            performanceLevel
        ];


    let targetParticles =
        mobile
            ? settings.mobile
            : settings.desktop;


    /*
    ========================================================
    CANVAS STATE
    ========================================================
    */

    let width = 0;
    let height = 0;
    let dpr = 1;

    let particles = [];

    let animationFrame = null;

    let running = true;

    let lastTime = 0;

    let fpsSamples = [];

    let performanceCheckTimer = 0;


    /*
    ========================================================
    RANDOM
    ========================================================
    */

    function random(
        min,
        max
    ) {

        return Math.random() *
            (max - min) +
            min;

    }


    /*
    ========================================================
    RESIZE
    ========================================================
    */

    function resizeCanvas() {

        width =
            window.innerWidth;

        height =
            window.innerHeight;


        /*
        Never allow a huge DPR.

        1.5 is much cheaper than
        using a phone's full 3x/4x DPR.
        */

        dpr =
            Math.min(
                window.devicePixelRatio || 1,
                1.5
            );


        canvas.width =
            Math.floor(
                width * dpr
            );

        canvas.height =
            Math.floor(
                height * dpr
            );


        canvas.style.width =
            width + "px";

        canvas.style.height =
            height + "px";


        ctx.setTransform(
            dpr,
            0,
            0,
            dpr,
            0,
            0
        );


        /*
        Recalculate particles for
        very small screens.
        */

        const area =
            width * height;


        if (
            area < 300000
        ) {

            targetParticles =
                Math.min(
                    targetParticles,
                    14
                );

        }


        adjustParticleCount();

    }


    /*
    ========================================================
    PARTICLE
    ========================================================
    */

    function createParticle() {

        return {

            x:
                random(
                    0,
                    width
                ),

            y:
                random(
                    0,
                    height
                ),

            vx:
                random(
                    -settings.speed,
                    settings.speed
                ),

            vy:
                random(
                    -settings.speed,
                    settings.speed
                ),

            size:
                random(
                    0.7,
                    1.8
                ),

            alpha:
                random(
                    0.25,
                    0.8
                ),

            phase:
                random(
                    0,
                    Math.PI * 2
                )

        };

    }


    /*
    ========================================================
    PARTICLE COUNT
    ========================================================
    */

    function adjustParticleCount() {

        while (
            particles.length <
            targetParticles
        ) {

            particles.push(
                createParticle()
            );

        }


        while (
            particles.length >
            targetParticles
        ) {

            particles.pop();

        }

    }


    /*
    ========================================================
    UPDATE
    ========================================================
    */

    function updateParticles(
        delta
    ) {

        const movement =
            delta * 0.06;


        for (
            let i = 0;
            i < particles.length;
            i++
        ) {

            const particle =
                particles[i];


            particle.x +=
                particle.vx *
                movement;

            particle.y +=
                particle.vy *
                movement;


            /*
            Gentle floating motion.

            This is intentionally tiny so
            the CPU/GPU doesn't have to work
            hard.
            */

            particle.phase +=
                0.002 * delta;


            particle.y +=
                Math.sin(
                    particle.phase
                ) *
                0.025;


            /*
            Wrap around screen.
            */

            if (
                particle.x < -10
            ) {

                particle.x =
                    width + 10;

            }
            else if (
                particle.x >
                width + 10
            ) {

                particle.x = -10;

            }


            if (
                particle.y < -10
            ) {

                particle.y =
                    height + 10;

            }
            else if (
                particle.y >
                height + 10
            ) {

                particle.y = -10;

            }

        }

    }


    /*
    ========================================================
    DRAW PARTICLES
    ========================================================
    */

    function drawParticles() {

        /*
        Clear only the canvas.

        No expensive background repaint.
        */

        ctx.clearRect(
            0,
            0,
            width,
            height
        );


        /*
        Draw particles.
        */

        ctx.fillStyle =
            "rgba(105, 225, 255, 0.55)";


        for (
            let i = 0;
            i < particles.length;
            i++
        ) {

            const p =
                particles[i];


            ctx.globalAlpha =
                p.alpha;


            ctx.beginPath();

            ctx.arc(
                p.x,
                p.y,
                p.size,
                0,
                Math.PI * 2
            );

            ctx.fill();

        }


        /*
        Connections only on
        medium/high performance.

        And only a limited number.
        */

        if (
            settings.connectionDistance <= 0
        ) {

            ctx.globalAlpha = 1;

            return;

        }


        const distanceLimit =
            settings.connectionDistance;

        const distanceLimitSquared =
            distanceLimit *
            distanceLimit;


        let connectionCount = 0;


        for (
            let i = 0;
            i < particles.length;
            i++
        ) {

            /*
            Prevent excessive line rendering.
            */

            if (
                connectionCount > 100
            ) {

                break;

            }


            const a =
                particles[i];


            for (
                let j = i + 1;
                j < particles.length;
                j++
            ) {

                const b =
                    particles[j];


                const dx =
                    a.x - b.x;

                const dy =
                    a.y - b.y;

                const distanceSquared =
                    dx * dx +
                    dy * dy;


                if (
                    distanceSquared >
                    distanceLimitSquared
                ) {

                    continue;

                }


                const distance =
                    Math.sqrt(
                        distanceSquared
                    );


                const opacity =
                    (
                        1 -
                        distance /
                        distanceLimit
                    ) *
                    0.13;


                ctx.strokeStyle =
                    `rgba(120, 150, 255, ${opacity})`;

                ctx.lineWidth =
                    0.6;


                ctx.beginPath();

                ctx.moveTo(
                    a.x,
                    a.y
                );

                ctx.lineTo(
                    b.x,
                    b.y
                );

                ctx.stroke();


                connectionCount++;

            }

        }


        ctx.globalAlpha = 1;

    }


    /*
    ========================================================
    FRAME LOOP
    ========================================================
    */

    function animate(
        timestamp
    ) {

        if (!running) {

            animationFrame = null;

            return;

        }


        /*
        Prevent giant jumps when the
        browser resumes from sleep.
        */

        if (!lastTime) {

            lastTime =
                timestamp;

        }


        let delta =
            timestamp -
            lastTime;


        lastTime =
            timestamp;


        delta =
            Math.min(
                delta,
                40
            );


        /*
        FPS monitoring.
        */

        fpsSamples.push(
            delta
        );


        if (
            fpsSamples.length >
            30
        ) {

            fpsSamples.shift();

        }


        updateParticles(
            delta
        );

        drawParticles();


        performanceCheckTimer +=
            delta;


        /*
        Check performance roughly
        every 2 seconds.
        */

        if (
            performanceCheckTimer >
            2000
        ) {

            optimizeForPerformance();

            performanceCheckTimer =
                0;

        }


        animationFrame =
            requestAnimationFrame(
                animate
            );

    }


    /*
    ========================================================
    AUTO PERFORMANCE OPTIMIZATION
    ========================================================
    */

    function optimizeForPerformance() {

        if (
            fpsSamples.length <
            15
        ) {

            return;

        }


        const averageDelta =
            fpsSamples.reduce(
                (
                    total,
                    value
                ) =>
                    total + value,
                0
            ) /
            fpsSamples.length;


        const fps =
            1000 /
            averageDelta;


        /*
        If FPS drops heavily,
        reduce particles.

        Never increase particles
        automatically during a session.
        This prevents oscillation.
        */

        if (
            fps < 35 &&
            targetParticles > 8
        ) {

            targetParticles =
                Math.max(
                    8,
                    Math.floor(
                        targetParticles *
                        0.70
                    )
                );


            adjustParticleCount();

        }
        else if (
            fps < 45 &&
            targetParticles > 12
        ) {

            targetParticles =
                Math.max(
                    12,
                    Math.floor(
                        targetParticles *
                        0.85
                    )
                );


            adjustParticleCount();

        }


        fpsSamples = [];

    }


    /*
    ========================================================
    VISIBILITY OPTIMIZATION
    ========================================================
    */

    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.hidden
            ) {

                running = false;

                if (
                    animationFrame
                ) {

                    cancelAnimationFrame(
                        animationFrame
                    );

                    animationFrame =
                        null;

                }

                return;

            }


            running = true;

            lastTime = 0;

            fpsSamples = [];

            animationFrame =
                requestAnimationFrame(
                    animate
                );

        }
    );


    /*
    ========================================================
    RESIZE OBSERVER
    ========================================================
    */

    let resizeTimer =
        null;


    window.addEventListener(
        "resize",
        () => {

            clearTimeout(
                resizeTimer
            );


            resizeTimer =
                setTimeout(
                    resizeCanvas,
                    150
                );

        },
        {
            passive: true
        }
    );


    /*
    ========================================================
    START
    ========================================================
    */

    resizeCanvas();

    animationFrame =
        requestAnimationFrame(
            animate
        );


})();
