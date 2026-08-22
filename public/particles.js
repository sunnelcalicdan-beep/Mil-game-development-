"use strict";

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
                alpha: true
            }
        );

    if (!ctx) {
        return;
    }


    const mobile =
        window.matchMedia(
            "(max-width: 700px)"
        ).matches;


    const reducedMotion =
        window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;


    const particleCount =
        reducedMotion
            ? mobile ? 5 : 8
            : mobile ? 16 : 30;


    let width = 0;
    let height = 0;

    let dpr = 1;

    let particles = [];

    let animationFrame = null;

    let running = true;

    let lastTime = 0;


    function random(
        min,
        max
    ) {

        return (
            Math.random() *
            (max - min)
        ) + min;

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
                    -0.06,
                    0.06
                ),

            vy:
                random(
                    -0.06,
                    0.06
                ),

            radius:
                random(
                    0.7,
                    1.9
                ),

            alpha:
                random(
                    0.25,
                    0.75
                ),

            hue:
                random(
                    180,
                    280
                )

        };

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
            width * dpr;

        canvas.height =
            height * dpr;


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


        particles =
            Array.from(
                {
                    length:
                        particleCount
                },
                createParticle
            );

    }


    function animate(
        timestamp
    ) {

        if (!running) {
            return;
        }


        if (!lastTime) {
            lastTime = timestamp;
        }


        const delta =
            Math.min(
                32,
                timestamp - lastTime
            );


        lastTime =
            timestamp;


        ctx.clearRect(
            0,
            0,
            width,
            height
        );


        for (
            const particle
            of particles
        ) {

            particle.x +=
                particle.vx *
                delta;

            particle.y +=
                particle.vy *
                delta;


            if (
                particle.x <
                -10
            ) {

                particle.x =
                    width + 10;

            }


            if (
                particle.x >
                width + 10
            ) {

                particle.x =
                    -10;

            }


            if (
                particle.y <
                -10
            ) {

                particle.y =
                    height + 10;

            }


            if (
                particle.y >
                height + 10
            ) {

                particle.y =
                    -10;

            }


            ctx.beginPath();


            ctx.fillStyle =
                `hsla(
                    ${particle.hue},
                    100%,
                    70%,
                    ${particle.alpha}
                )`;


            ctx.arc(
                particle.x,
                particle.y,
                particle.radius,
                0,
                Math.PI * 2
            );


            ctx.fill();

        }


        /*
         * Particle connections
         */

        let connections = 0;

        const maxConnections = 90;

        const maxDistance = 125;

        const maxDistanceSquared =
            maxDistance *
            maxDistance;


        for (
            let i = 0;
            i < particles.length &&
            connections < maxConnections;
            i++
        ) {

            for (
                let j = i + 1;
                j < particles.length &&
                connections < maxConnections;
                j++
            ) {

                const a =
                    particles[i];

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


                const opacity =
                    (
                        1 -
                        distance /
                        maxDistance
                    ) * 0.12;


                ctx.beginPath();


                ctx.strokeStyle =
                    `rgba(
                        91,
                        152,
                        255,
                        ${opacity}
                    )`;


                ctx.lineWidth =
                    0.55;


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


        animationFrame =
            requestAnimationFrame(
                animate
            );

    }


    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.hidden
            ) {

                running =
                    false;

                cancelAnimationFrame(
                    animationFrame
                );

                return;

            }


            running =
                true;

            lastTime =
                0;

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
                    resize,
                    160
                );

        },
        {
            passive: true
        }
    );


    resize();


    animationFrame =
        requestAnimationFrame(
            animate
        );

})();
