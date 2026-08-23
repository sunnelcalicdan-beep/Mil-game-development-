"use strict";

/*
========================================================
PROJECT FILE HUB
SMOOTH ADAPTIVE PARTICLE ENGINE
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


    let quality =
        "medium";


    if (reducedMotion) {

        quality =
            "minimal";

    }
    else if (
        cores <= 2 ||
        memory <= 2
    ) {

        quality =
            "low";

    }
    else if (
        cores >= 8 &&
        memory >= 8
    ) {

        quality =
            "high";

    }


    const presets = {

        minimal: {
            desktop: 8,
            mobile: 5,
            speed: .10,
            connections: 0
        },

        low: {
            desktop: 18,
            mobile: 9,
            speed: .15,
            connections: 55
        },

        medium: {
            desktop: 32,
            mobile: 15,
            speed: .20,
            connections: 75
        },

        high: {
            desktop: 48,
            mobile: 22,
            speed: .24,
            connections: 90
        }

    };


    const preset =
        presets[
            quality
        ];


    let width =
        window.innerWidth;


    let height =
        window.innerHeight;


    let dpr =
        Math.min(
            window.devicePixelRatio || 1,
            1.5
        );


    let particles = [];


    let targetCount =
        mobile
            ? preset.mobile
            : preset.desktop;


    if (
        width * height < 300000
    ) {

        targetCount =
            Math.min(
                targetCount,
                12
            );

    }


    let animationFrame =
        null;


    let running =
        !document.hidden;


    let lastTime =
        0;


    let fpsHistory = [];


    function random(
        min,
        max
    ) {

        return Math.random() *
            (max - min) +
            min;

    }


    function resize() {

        width =
            window.innerWidth;

        height =
            window.innerHeight;


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

    }


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
                    -preset.speed,
                    preset.speed
                ),

            vy:
                random(
                    -preset.speed,
                    preset.speed
                ),

            radius:
                random(
                    .7,
                    1.8
                ),

            alpha:
                random(
                    .25,
                    .72
                )

        };

    }


    function syncParticles() {

        while (
            particles.length <
            targetCount
        ) {

            particles.push(
                createParticle()
            );

        }


        while (
            particles.length >
            targetCount
        ) {

            particles.pop();

        }

    }


    function update(
        delta
    ) {

        const factor =
            delta * .06;


        for (
            const p of particles
        ) {

            p.x +=
                p.vx *
                factor;


            p.y +=
                p.vy *
                factor;


            if (
                p.x < -10
            ) {

                p.x =
                    width + 10;

            }
            else if (
                p.x > width + 10
            ) {

                p.x =
                    -10;

            }


            if (
                p.y < -10
            ) {

                p.y =
                    height + 10;

            }
            else if (
                p.y > height + 10
            ) {

                p.y =
                    -10;

            }

        }

    }


    function draw() {

        ctx.clearRect(
            0,
            0,
            width,
            height
        );


        /*
        Particle dots.
        */

        ctx.fillStyle =
            "rgba(91, 220, 255, .6)";


        for (
            const p of particles
        ) {

            ctx.globalAlpha =
                p.alpha;


            ctx.beginPath();

            ctx.arc(
                p.x,
                p.y,
                p.radius,
                0,
                Math.PI * 2
            );

            ctx.fill();

        }


        /*
        Connections.
        */

        if (
            preset.connections <= 0
        ) {

            ctx.globalAlpha = 1;

            return;

        }


        const limit =
            preset.connections;


        const limitSquared =
            limit * limit;


        let connections =
            0;


        for (
            let i = 0;
            i < particles.length;
            i++
        ) {

            if (
                connections >= 75
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
                    limitSquared
                ) {

                    continue;

                }


                const distance =
                    Math.sqrt(
                        distanceSquared
                    );


                const alpha =
                    (
                        1 -
                        distance / limit
                    ) * .11;


                ctx.strokeStyle =
                    `rgba(110, 130, 255, ${alpha})`;


                ctx.lineWidth =
                    .55;


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


                connections++;

            }

        }


        ctx.globalAlpha =
            1;

    }


    function optimize() {

        if (
            fpsHistory.length < 20
        ) {

            return;

        }


        const average =
            fpsHistory.reduce(
                (
                    total,
                    value
                ) =>
                    total + value,
                0
            ) /
            fpsHistory.length;


        const fps =
            1000 /
            average;


        if (
            fps < 32 &&
            targetCount > 7
        ) {

            targetCount =
                Math.max(
                    7,
                    Math.floor(
                        targetCount * .65
                    )
                );


            syncParticles();

        }
        else if (
            fps < 45 &&
            targetCount > 10
        ) {

            targetCount =
                Math.max(
                    10,
                    Math.floor(
                        targetCount * .82
                    )
                );


            syncParticles();

        }


        fpsHistory =
            [];

    }


    let performanceTimer =
        0;


    function animate(
        timestamp
    ) {

        if (!running) {

            animationFrame =
                null;

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


        delta =
            Math.min(
                delta,
                40
            );


        fpsHistory.push(
            delta
        );


        if (
            fpsHistory.length > 30
        ) {

            fpsHistory.shift();

        }


        update(
            delta
        );


        draw();


        performanceTimer +=
            delta;


        if (
            performanceTimer > 2000
        ) {

            optimize();

            performanceTimer =
                0;

        }


        animationFrame =
            requestAnimationFrame(
                animate
            );

    }


    document.addEventListener(
        "visibilitychange",
        () => {

            running =
                !document.hidden;


            if (
                !running
            ) {

                if (
                    animationFrame
                ) {

                    cancelAnimationFrame(
                        animationFrame
                    );

                }

                animationFrame =
                    null;

                return;

            }


            lastTime =
                0;


            fpsHistory =
                [];


            animationFrame =
                requestAnimationFrame(
                    animate
                );

        }
    );


    let resizeTimer;


    window.addEventListener(
        "resize",
        () => {

            clearTimeout(
                resizeTimer
            );


            resizeTimer =
                setTimeout(
                    () => {

                        resize();

                    },
                    150
                );

        },
        {
            passive: true
        }
    );


    resize();

    syncParticles();


    if (
        reducedMotion
    ) {

        draw();

        return;

    }


    animationFrame =
        requestAnimationFrame(
            animate
        );

})();
