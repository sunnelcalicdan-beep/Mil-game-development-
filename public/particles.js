"use strict";

/*
========================================================
MIL PROJECT • GAME DEVELOPMENT
PROJECT FILE HUB
SMART PARTICLE ENGINE
========================================================

Features:

✓ Automatically detects device capability
✓ Mobile optimization
✓ Desktop optimization
✓ DPR capped
✓ Smooth requestAnimationFrame
✓ Particle networking
✓ Animated particle colors
✓ Screen wrapping
✓ Visibility pause
✓ Reduced-motion support
✓ Automatic FPS adaptation
✓ Resize protection
✓ No DOM particle elements
✓ No per-particle CSS filters
✓ No giant canvas shadows
✓ Limited connection rendering
========================================================
*/

(() => {

    const canvas =
        document.getElementById(
            "particleCanvas"
        );

    if (!canvas) {
        return;
    }


    const ctx =
        canvas.getContext(
            "2d",
            {
                alpha: true,
                desynchronized: true
            }
        );

    if (!ctx) {
        return;
    }


    /* =====================================================
       DEVICE INFORMATION
    ===================================================== */

    const reducedMotion =
        window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;


    const mobile =
        window.matchMedia(
            "(max-width: 700px)"
        ).matches;


    const cores =
        navigator.hardwareConcurrency || 4;


    const memory =
        navigator.deviceMemory || 4;


    const connection =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;


    const slowConnection =
        connection &&
        (
            connection.saveData ||
            connection.effectiveType === "slow-2g" ||
            connection.effectiveType === "2g"
        );


    /* =====================================================
       PERFORMANCE PROFILE
    ===================================================== */

    let performanceLevel = "medium";


    if (reducedMotion) {

        performanceLevel = "minimal";

    }
    else if (
        slowConnection ||
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


    const profiles = {

        minimal: {

            desktop: 8,

            mobile: 5,

            speed: 0.10,

            connectionDistance: 70,

            maxConnections: 20

        },


        low: {

            desktop: 20,

            mobile: 10,

            speed: 0.17,

            connectionDistance: 78,

            maxConnections: 35

        },


        medium: {

            desktop: 34,

            mobile: 17,

            speed: 0.24,

            connectionDistance: 92,

            maxConnections: 65

        },


        high: {

            desktop: 50,

            mobile: 25,

            speed: 0.31,

            connectionDistance: 105,

            maxConnections: 90

        }

    };


    const profile =
        profiles[
            performanceLevel
        ];


    /* =====================================================
       CANVAS STATE
    ===================================================== */

    let width = 0;

    let height = 0;

    let dpr = 1;

    let particles = [];

    let animationFrame = null;

    let running = true;

    let lastTime = 0;

    let fpsTimer = 0;

    let fpsFrames = 0;

    let fpsTotal = 0;

    let currentFPS = 60;


    let targetParticles =
        mobile
            ? profile.mobile
            : profile.desktop;


    /* =====================================================
       UTILITY
    ===================================================== */

    function random(min, max) {

        return (
            Math.random() *
            (max - min)
        ) + min;

    }


    function clamp(
        value,
        min,
        max
    ) {

        return Math.max(
            min,
            Math.min(
                max,
                value
            )
        );

    }


    /* =====================================================
       RESIZE
    ===================================================== */

    function resizeCanvas() {

        width =
            window.innerWidth;

        height =
            window.innerHeight;


        /*
        Keep DPR intentionally capped.

        A modern phone may report 2x,
        3x or 4x DPR.

        Rendering the particle canvas
        at full DPR is unnecessary.
        */

        dpr =
            Math.min(
                window.devicePixelRatio || 1,
                mobile ? 1.25 : 1.5
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
        Very small displays need fewer particles.
        */

        const area =
            width * height;


        const areaScale =
            clamp(
                area / 900000,
                0.55,
                1
            );


        const baseCount =
            mobile
                ? profile.mobile
                : profile.desktop;


        targetParticles =
            Math.max(
                performanceLevel === "minimal"
                    ? 5
                    : 8,
                Math.floor(
                    baseCount *
                    areaScale
                )
            );


        adjustParticleCount();

    }


    /* =====================================================
       CREATE PARTICLE
    ===================================================== */

    function createParticle() {

        const colors = [

            {
                r: 47,
                g: 218,
                b: 255
            },

            {
                r: 87,
                g: 130,
                b: 255
            },

            {
                r: 156,
                g: 79,
                b: 255
            }

        ];


        const color =
            colors[
                Math.floor(
                    Math.random() *
                    colors.length
                )
            ];


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
                    -profile.speed,
                    profile.speed
                ),

            vy:
                random(
                    -profile.speed,
                    profile.speed
                ),

            size:
                random(
                    0.7,
                    1.9
                ),

            alpha:
                random(
                    0.22,
                    0.72
                ),

            phase:
                random(
                    0,
                    Math.PI * 2
                ),

            phaseSpeed:
                random(
                    0.0008,
                    0.0022
                ),

            color

        };

    }


    /* =====================================================
       PARTICLE COUNT
    ===================================================== */

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


    /* =====================================================
       UPDATE
    ===================================================== */

    function updateParticles(delta) {

        /*
        Normalize movement.

        16.67ms ≈ 60fps.
        */

        const frameScale =
            Math.min(
                delta / 16.67,
                2
            );


        for (
            let i = 0;
            i < particles.length;
            i++
        ) {

            const p =
                particles[i];


            p.x +=
                p.vx *
                frameScale;


            p.y +=
                p.vy *
                frameScale;


            /*
            Very subtle floating movement.
            */

            p.phase +=
                p.phaseSpeed *
                delta;


            p.y +=
                Math.sin(
                    p.phase
                ) *
                0.035 *
                frameScale;


            /*
            Wrap horizontally.
            */

            if (p.x < -15) {

                p.x =
                    width + 15;

            }
            else if (
                p.x >
                width + 15
            ) {

                p.x = -15;

            }


            /*
            Wrap vertically.
            */

            if (p.y < -15) {

                p.y =
                    height + 15;

            }
            else if (
                p.y >
                height + 15
            ) {

                p.y = -15;

            }

        }

    }


    /* =====================================================
       DRAW PARTICLES
    ===================================================== */

    function drawParticles() {

        ctx.clearRect(
            0,
            0,
            width,
            height
        );


        /*
        Draw connections first.
        */

        if (
            profile.connectionDistance > 0
        ) {

            drawConnections();

        }


        /*
        Draw points.
        */

        for (
            let i = 0;
            i < particles.length;
            i++
        ) {

            const p =
                particles[i];


            const pulse =
                0.86 +
                Math.sin(
                    p.phase
                ) *
                0.14;


            const alpha =
                p.alpha *
                pulse;


            ctx.globalAlpha =
                alpha;


            ctx.fillStyle =
                `rgb(
                    ${p.color.r},
                    ${p.color.g},
                    ${p.color.b}
                )`;


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


        ctx.globalAlpha = 1;

    }


    /* =====================================================
       CONNECTIONS
    ===================================================== */

    function drawConnections() {

        const maxDistance =
            profile.connectionDistance;


        const maxDistanceSquared =
            maxDistance *
            maxDistance;


        let connectionCount = 0;


        /*
        Slightly randomize the limit so
        the network feels organic.
        */

        const connectionLimit =
            profile.maxConnections;


        for (
            let i = 0;
            i < particles.length;
            i++
        ) {

            if (
                connectionCount >=
                connectionLimit
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

                if (
                    connectionCount >=
                    connectionLimit
                ) {

                    break;

                }


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
                    maxDistanceSquared
                ) {

                    continue;

                }


                const distance =
                    Math.sqrt(
                        distanceSquared
                    );


                const strength =
                    1 -
                    distance /
                    maxDistance;


                const opacity =
                    strength *
                    0.16;


                /*
                Blend between cyan and purple
                without using expensive gradients.
                */

                const r =
                    Math.floor(
                        85 +
                        strength * 35
                    );


                const g =
                    Math.floor(
                        140 +
                        strength * 70
                    );


                const bColor =
                    Math.floor(
                        220 +
                        strength * 35
                    );


                ctx.strokeStyle =
                    `rgba(
                        ${r},
                        ${g},
                        ${bColor},
                        ${opacity}
                    )`;


                ctx.lineWidth =
                    0.55;


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

    }


    /* =====================================================
       FPS ADAPTATION
    ===================================================== */

    function monitorPerformance(delta) {

        fpsTimer += delta;

        fpsFrames++;


        if (
            fpsTimer < 2500
        ) {

            return;

        }


        currentFPS =
            (
                fpsFrames /
                fpsTimer
            ) *
            1000;


        fpsTimer = 0;

        fpsFrames = 0;


        /*
        If the device struggles,
        gradually reduce particles.

        Never aggressively increase them again.
        */

        if (
            currentFPS < 30 &&
            targetParticles > 7
        ) {

            targetParticles =
                Math.max(
                    7,
                    Math.floor(
                        targetParticles *
                        0.65
                    )
                );


            adjustParticleCount();

        }
        else if (
            currentFPS < 42 &&
            targetParticles > 10
        ) {

            targetParticles =
                Math.max(
                    10,
                    Math.floor(
                        targetParticles *
                        0.82
                    )
                );


            adjustParticleCount();

        }

    }


    /* =====================================================
       ANIMATION LOOP
    ===================================================== */

    function animate(timestamp) {

        if (!running) {

            animationFrame = null;

            return;

        }


        if (!lastTime) {

            lastTime =
                timestamp;

        }


        let delta =
            timestamp -
            lastTime;


        lastTime =
            timestamp;


        /*
        Prevent huge movement after
        browser suspension.
        */

        delta =
            Math.min(
                delta,
                40
            );


        updateParticles(
            delta
        );


        drawParticles();


        monitorPerformance(
            delta
        );


        animationFrame =
            requestAnimationFrame(
                animate
            );

    }


    /* =====================================================
       VISIBILITY
    ===================================================== */

    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.hidden
            ) {

                running = false;


                if (
                    animationFrame !== null
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

            fpsTimer = 0;

            fpsFrames = 0;


            animationFrame =
                requestAnimationFrame(
                    animate
                );

        }
    );


    /* =====================================================
       RESIZE
    ===================================================== */

    let resizeTimer = null;


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


    /* =====================================================
       REDUCED MOTION
    ===================================================== */

    if (
        reducedMotion
    ) {

        targetParticles =
            mobile
                ? 4
                : 7;

    }


    /* =====================================================
       START
    ===================================================== */

    resizeCanvas();


    animationFrame =
        requestAnimationFrame(
            animate
        );

})();
