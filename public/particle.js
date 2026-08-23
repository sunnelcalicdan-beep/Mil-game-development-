"use strict";

/*
========================================================
PROJECT FILE HUB
SMOOTH PARTICLE ENGINE
========================================================
*/

(() => {

    const canvas =
        document.getElementById("particleCanvas");

    if (!canvas) return;

    const ctx =
        canvas.getContext("2d", {
            alpha: true
        });

    if (!ctx) return;

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

    let particleCount;

    if (reducedMotion) {

        particleCount = mobile ? 5 : 8;

    } else if (
        cores <= 2 ||
        memory <= 2
    ) {

        particleCount = mobile ? 8 : 15;

    } else if (
        cores >= 8 &&
        memory >= 8
    ) {

        particleCount = mobile ? 18 : 34;

    } else {

        particleCount = mobile ? 12 : 24;
    }


    let width = 0;
    let height = 0;
    let dpr = 1;

    let particles = [];

    let animationFrame = null;

    let lastTime = 0;


    function random(min, max) {

        return Math.random() *
            (max - min) +
            min;
    }


    function resize() {

        width =
            window.innerWidth;

        height =
            window.innerHeight;

        /*
        Limit DPR for smoother
        performance on high-DPI phones.
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
    }


    function createParticle() {

        const colors = [
            [50, 231, 255],
            [92, 130, 255],
            [170, 70, 255]
        ];

        const color =
            colors[
                Math.floor(
                    Math.random() *
                    colors.length
                )
            ];

        return {

            x: random(0, width),
            y: random(0, height),

            vx: random(-0.10, 0.10),
            vy: random(-0.10, 0.10),

            radius: random(0.8, 2.0),

            alpha: random(0.20, 0.65),

            color

        };
    }


    function createParticles() {

        particles.length = 0;

        for (
            let i = 0;
            i < particleCount;
            i++
        ) {

            particles.push(
                createParticle()
            );
        }
    }


    function update(delta) {

        /*
        Delta is capped to prevent
        jumps after tab switching.
        */

        const time =
            Math.min(delta, 32);

        for (
            let i = 0;
            i < particles.length;
            i++
        ) {

            const p =
                particles[i];

            p.x +=
                p.vx * time;

            p.y +=
                p.vy * time;


            if (p.x < -20)
                p.x = width + 20;

            if (p.x > width + 20)
                p.x = -20;

            if (p.y < -20)
                p.y = height + 20;

            if (p.y > height + 20)
                p.y = -20;
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
        Draw connections first.
        */

        const distanceLimit =
            mobile ? 90 : 120;

        const limitSquared =
            distanceLimit *
            distanceLimit;


        let lines = 0;


        for (
            let i = 0;
            i < particles.length;
            i++
        ) {

            if (lines >= 60)
                break;

            const a =
                particles[i];

            for (
                let j = i + 1;
                j < particles.length;
                j++
            ) {

                if (lines >= 60)
                    break;

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

                const opacity =
                    (
                        1 -
                        distance /
                        distanceLimit
                    ) * 0.10;

                ctx.beginPath();

                ctx.strokeStyle =
                    `rgba(100,150,255,${opacity})`;

                ctx.lineWidth = 0.5;

                ctx.moveTo(
                    a.x,
                    a.y
                );

                ctx.lineTo(
                    b.x,
                    b.y
                );

                ctx.stroke();

                lines++;
            }
        }


        /*
        Draw particles.
        */

        for (
            let i = 0;
            i < particles.length;
            i++
        ) {

            const p =
                particles[i];

            const [r, g, b] =
                p.color;

            ctx.beginPath();

            ctx.globalAlpha =
                p.alpha;

            ctx.fillStyle =
                `rgb(${r},${g},${b})`;

            ctx.arc(
                p.x,
                p.y,
                p.radius,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }

        ctx.globalAlpha = 1;
    }


    function animate(timestamp) {

        if (!lastTime) {

            lastTime =
                timestamp;
        }

        const delta =
            timestamp -
            lastTime;

        lastTime =
            timestamp;

        update(delta);

        draw();

        animationFrame =
            requestAnimationFrame(
                animate
            );
    }


    function start() {

        if (animationFrame)
            return;

        lastTime = 0;

        animationFrame =
            requestAnimationFrame(
                animate
            );
    }


    function stop() {

        if (!animationFrame)
            return;

        cancelAnimationFrame(
            animationFrame
        );

        animationFrame = null;
    }


    document.addEventListener(
        "visibilitychange",
        () => {

            if (document.hidden) {

                stop();

            } else {

                start();
            }
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
                setTimeout(() => {

                    resize();

                }, 120);

        },
        {
            passive: true
        }
    );


    resize();

    createParticles();

    if (!reducedMotion) {

        start();

    } else {

        draw();
    }

})();
