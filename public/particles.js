"use strict";

/*
========================================================
PROJECT FILE HUB
ORIGINAL NEON PARTICLE ENGINE
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
        canvas.getContext("2d");

    if (!ctx) {
        return;
    }


    let width = 0;
    let height = 0;

    let particles = [];

    let animationFrame = null;

    let lastTime = 0;


    /*
    ========================================================
    SETTINGS
    ========================================================
    */

    const PARTICLE_COUNT =
        window.innerWidth <= 700
            ? 35
            : 75;

    const MAX_DISTANCE = 130;


    /*
    ========================================================
    RANDOM
    ========================================================
    */

    function random(min, max) {

        return Math.random() *
            (max - min) +
            min;

    }


    /*
    ========================================================
    RESIZE
    ========================================================
    */

    function resize() {

        width =
            window.innerWidth;

        height =
            window.innerHeight;


        const dpr =
            Math.min(
                window.devicePixelRatio || 1,
                2
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

    }


    /*
    ========================================================
    CREATE PARTICLE
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
                    -0.25,
                    0.25
                ),

            vy:
                random(
                    -0.25,
                    0.25
                ),

            size:
                random(
                    0.7,
                    2.1
                ),

            alpha:
                random(
                    0.25,
                    0.85
                ),

            hue:
                random(
                    0,
                    1
                )

        };

    }


    /*
    ========================================================
    INITIALIZE
    ========================================================
    */

    function initialize() {

        particles = [];

        for (
            let i = 0;
            i < PARTICLE_COUNT;
            i++
        ) {

            particles.push(
                createParticle()
            );

        }

    }


    /*
    ========================================================
    UPDATE
    ========================================================
    */

    function update(delta) {

        const speed =
            Math.min(
                delta,
                30
            ) * 0.055;


        particles.forEach(
            particle => {

                particle.x +=
                    particle.vx *
                    speed;

                particle.y +=
                    particle.vy *
                    speed;


                if (
                    particle.x < -20
                ) {
                    particle.x =
                        width + 20;
                }

                if (
                    particle.x >
                    width + 20
                ) {
                    particle.x = -20;
                }


                if (
                    particle.y < -20
                ) {
                    particle.y =
                        height + 20;
                }

                if (
                    particle.y >
                    height + 20
                ) {
                    particle.y = -20;
                }

            }
        );

    }


    /*
    ========================================================
    DRAW
    ========================================================
    */

    function draw() {

        ctx.clearRect(
            0,
            0,
            width,
            height
        );


        /*
        --------------------------------------------
        PARTICLES
        --------------------------------------------
        */

        particles.forEach(
            particle => {

                const gradient =
                    ctx.createRadialGradient(
                        particle.x,
                        particle.y,
                        0,
                        particle.x,
                        particle.y,
                        particle.size * 4
                    );


                if (
                    particle.hue < 0.5
                ) {

                    gradient.addColorStop(
                        0,
                        `rgba(34,232,255,${particle.alpha})`
                    );

                    gradient.addColorStop(
                        1,
                        "rgba(34,232,255,0)"
                    );

                }
                else {

                    gradient.addColorStop(
                        0,
                        `rgba(145,70,255,${particle.alpha})`
                    );

                    gradient.addColorStop(
                        1,
                        "rgba(145,70,255,0)"
                    );

                }


                ctx.fillStyle =
                    gradient;


                ctx.beginPath();

                ctx.arc(
                    particle.x,
                    particle.y,
                    particle.size * 4,
                    0,
                    Math.PI * 2
                );

                ctx.fill();

            }
        );


        /*
        --------------------------------------------
        CONNECTIONS
        --------------------------------------------
        */

        for (
            let i = 0;
            i < particles.length;
            i++
        ) {

            for (
                let j = i + 1;
                j < particles.length;
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


                const distance =
                    Math.sqrt(
                        dx * dx +
                        dy * dy
                    );


                if (
                    distance >
                    MAX_DISTANCE
                ) {
                    continue;
                }


                const opacity =
                    (
                        1 -
                        distance /
                        MAX_DISTANCE
                    ) * 0.12;


                ctx.strokeStyle =
                    `rgba(91,150,255,${opacity})`;

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

            }

        }

    }


    /*
    ========================================================
    ANIMATION
    ========================================================
    */

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


    /*
    ========================================================
    RESIZE
    ========================================================
    */

    let resizeTimer = null;


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
                    120
                );

        },
        {
            passive: true
        }
    );


    /*
    ========================================================
    VISIBILITY
    ========================================================
    */

    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.hidden
            ) {

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


            lastTime = 0;


            if (
                !animationFrame
            ) {

                animationFrame =
                    requestAnimationFrame(
                        animate
                    );

            }

        }
    );


    /*
    ========================================================
    START
    ========================================================
    */

    resize();

    initialize();

    animationFrame =
        requestAnimationFrame(
            animate
        );

})();
