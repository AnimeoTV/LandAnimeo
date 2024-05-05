import {
    defineComponent,
    onMounted,
    reactive,
    ref,
} from "vue";

import {
    createGameLoop,
    setupCanvas,
    setupKeyboard,
    startHighPrecisionTimer,
} from "./utils";

export default defineComponent({

    setup() {
        const refCanvas = ref<HTMLCanvasElement | null>(null);

        const myPlayer = reactive({
            x       : 0,
            y       : 0,
            velX    : 10,
            velY    : 0,
            prevX   : 0,
            prevY   : 0,
            dead    : false,
        });

        const stats = reactive({
            fps         : 0,
            tps         : 0,
            debugMode   : false,
        });

        onMounted(() => {
            const gameLoop = createGameLoop({
                onGameStart,
                onRender,
                onUpdate,
                ticksPerSeconds: 40,
            });

            type Block = {
                x           : number;
                y           : number;
                r           : number;
                g           : number;
                b           : number;
                a           : number;
                facingSide  : Side | null;
            };

            const map       = [] as Block[];
            const spawns    = [] as Block[];
            let pepoImage   = null as unknown as HTMLImageElement;
            let dedImage    = null as unknown as HTMLImageElement;
            let spikeImage  = null as unknown as HTMLImageElement;
            let floorImage  = null as unknown as HTMLImageElement;
            let bonusImage   = null as unknown as HTMLImageElement;
            let levelIdx    = Number(localStorage["levelIdx"]) || 0;

            window.addEventListener("keydown", (e) => {
                if (e.key === "z") {
                    e.preventDefault();
                    myPlayer.velX++;

                } else if (e.key === "s") {
                    e.preventDefault();
                    myPlayer.velX--;

                } else if (e.key === "F3") {
                    e.preventDefault();
                    stats.debugMode = !stats.debugMode;
                }
            });

            window.addEventListener("click", async () => {
                if (!gameLoop.refStarted.value) {
                    const audioCtx = new AudioContext({
                        latencyHint: "interactive",
                    });

                    const nodeGain = audioCtx.createGain();
                    nodeGain.gain.setValueAtTime(0.01, 0);
                    nodeGain.connect(audioCtx.destination);

                    function playBuffer(buffer: AudioBuffer) {
                        const source = audioCtx.createBufferSource();

                        source.buffer = buffer;
                        source.connect(nodeGain);
                        source.loop = true;
                        source.start();
                    }

                    async function loadAudio() {
                        try {
                            // Load an audio file
                            const response = await fetch("/assets/song2.mp3");

                            // Decode it
                            audioCtx.decodeAudioData(await response.arrayBuffer(), playBuffer);

                        } catch (err: any) {
                            console.error(`Unable to fetch the audio file. Error: ${err.message}`);
                        }
                    }

                    async function fetchImageData(source: string): Promise<ImageData> {
                        const image     = await fetchImage(source);
                        const canvas    = document.createElement("canvas");
                        const context   = canvas.getContext("2d")!;

                        canvas.width    = image.width;
                        canvas.height   = image.height;
                        context.clearRect(0, 0, canvas.width, canvas.height);
                        context.drawImage(image, 0, 0);

                        return context.getImageData(0, 0, image.width, image.height);
                    }

                    function fetchImage(source: string): Promise<HTMLImageElement> {
                        return new Promise((resolve, reject) => {
                            const image = new Image();

                            image.src = source;

                            image.onload = () => {
                                resolve(image);
                            };

                            image.onerror = reject;
                        });
                    }

                    const imageData = await fetchImageData("/assets/maps/level1.png");

                    pepoImage = await fetchImage("/assets/pepo.png");
                    dedImage = await fetchImage("/assets/ded.png");
                    spikeImage = await fetchImage("/assets/spike.png");
                    floorImage = await fetchImage("/assets/floor.png");
                    bonusImage = await fetchImage("/assets/bonus.png");

                    await loadAudio();

                    function getPixel(x: number, y: number): [ number, number, number, number ] {
                        if (x >= 0 && y >= 0) {
                            const pixelPos  = (x + (y * imageData.width)) * 4;
                            const r         = imageData.data[pixelPos + 0]!;
                            const g         = imageData.data[pixelPos + 1]!;
                            const b         = imageData.data[pixelPos + 2]!;
                            const a         = imageData.data[pixelPos + 3]!;

                            return [ r, g, b, a ];

                        } else {
                            return [ 255, 255, 255, 255 ];
                        }
                    }

                    function isEmptyPixel(x: number, y: number): boolean {
                        const [ r, g, b, a ] = getPixel(x, y);

                        return isColor({ r, g, b }, 255, 255, 255);
                    }

                    function isSamePixel(x1: number, y1: number, x2: number, y2: number) {
                        const [ r1, g1, b1, a1 ] = getPixel(x1, y1);
                        const [ r2, g2, b2, a2 ] = getPixel(x2, y2);

                        return r1 === r2
                            && g1 === g2
                            && b1 === b2
                            && a1 === a2;
                    }

                    function getFacingSide(x: number, y: number): Side | null {

                        // Same pixel.

                        if (isSamePixel(x, y, x, (y + 1)) || isSamePixel(x, y, x, (y - 1)))
                            return isEmptyPixel((x - 1), y)
                                ? "left"
                                : "right";

                        if (isSamePixel(x, y, (x - 1), y) || isSamePixel(x, y, (x + 1), y))
                            return isEmptyPixel(x, (y + 1))
                                ? "top"
                                : "bottom";

                        // Empty pixel.

                        if (isEmptyPixel(x, (y + 1)))
                            return "top";

                        if (isEmptyPixel(x, (y - 1)))
                            return "bottom";

                        if (isEmptyPixel((x - 1), y))
                            return "left";

                        if (isEmptyPixel((x + 1), y))
                            return "right";

                        return null;
                    }

                    for (let y = 0; y < imageData.height; y++) {
                        for (let x = 0; x < imageData.width; x++) {
                            const [ r, g, b, a ] = getPixel(x, y);

                            const block: Block = {
                                x,
                                y: imageData.height - y - 1,
                                r, g, b, a,

                                facingSide: getFacingSide(x, y),
                            };

                            if (isColor(block, 255, 255, 255))
                                continue;

                            if (isColor(block, 237, 28, 36)) {
                                spawns.push(block);
                                block.r = 255;
                                block.g = 255;
                                block.b = 255;
                            }

                            if (isColor(block, 0, 0, 0)) {
                                block.r = 255;
                                block.g = 255;
                                block.b = 255;
                            }

                            map.push(block);
                        }
                    }

                    gameLoop.startGame();
                }
            }, { once: true });

            const canvas            = refCanvas.value!;
            const ctx               = canvas.getContext("2d")!;
            const inputs            = setupKeyboard();
            const CellSize          = 40;
            let gravity             = 0.0;

            type Square = {
                x       : number;
                y       : number;
                width   : number;
                height  : number;
            };

            type Side = "left" | "right" | "top" | "bottom";

            function detectOverlap(square1: Square, square2: Square): boolean {
                if ((square1.x + square1.width) >= square2.x && square1.x <= (square2.x + square2.width))
                    if ((square1.y + square1.height) >= square2.y && square1.y <= (square2.y + square2.height))
                        return true;

                return false;
            }

            function detectCollision(square1: Square, square2: Square): Side[] {
                const sides: Side[] = [];

                if (detectOverlap(square1, square2)) {
                    if ((square1.x + square1.width) >= square2.x && square1.x <= square2.x)
                        sides.push("right");

                    if (square1.x <= (square2.x + square2.width) && (square1.x + square1.width) >= (square2.x + square2.width))
                        sides.push("left");

                    if ((square1.y + square1.height) >= square2.y && square1.y <= square2.y)
                        sides.push("bottom");

                    if (square1.y <= (square2.y + square2.height) && (square1.y + square1.height) >= (square2.y + square2.height))
                        sides.push("top");
                }

                return sides;
            }

            function respawnPlayer() {
                const levelIndex    = levelIdx + 1;
                const spawn         = spawns[spawns.length - levelIndex];

                if (spawn) {
                    myPlayer.dead   = false;
                    myPlayer.x      = (CellSize * spawn.x);
                    myPlayer.y      = (CellSize * (spawn.y + 1));
                    myPlayer.prevX  = myPlayer.x;
                    myPlayer.prevY  = myPlayer.y;
                    myPlayer.velX   = (levelIndex % 2) ? (10) : (-10);
                    myPlayer.velY   = 0;
                    gravity         = -2.0;
                }
            }

            function onGameStart() {
                respawnPlayer();
            }

            function isColor(block: { r: number, g: number, b: number }, r: number, g: number, b: number): boolean {
                return (block.r === r && block.g === g && block.b === b);
            }

            function setupCamera(partialTick: number): DOMMatrix {
                const posX = myPlayer.prevX + ((myPlayer.x - myPlayer.prevX) * partialTick);

                ctx.translate(0, canvas.height);

                // Camera inverse projection matrix.
                ctx.scale(1.0, -1.0);

                // Camera focus at x: 200.
                if (levelIdx % 2) {
                    ctx.translate((canvas.width - 200), (levelIdx * -400));

                } else {
                    ctx.translate(200, (levelIdx * -400));
                }

                // Camera position.
                ctx.translate(-(posX + (CellSize / 2)), 0);

                return ctx.getTransform();
            }

            function multiplyMatrix(matrix: DOMMatrix) {
                ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
            }

            function onRender(partialTick: number) {
                stats.fps++;

                // Clear canvas.
                ctx.resetTransform();
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                if (myPlayer) {

                    // Setup camera (center to player).
                    const cameraMatrix = setupCamera(partialTick);

                    // Render map
                    {
                        ctx.translate(
                            ((myPlayer.prevX + ((myPlayer.x - myPlayer.prevX) * partialTick)) / 12),
                            0,
                        );

                        ctx.strokeStyle = "rgb(30, 30, 30)";

                        const MapWidth  = 50_000;
                        const MapHeight = canvas.height + 50_000;

                        for (let x = 0; x <= Math.ceil(MapHeight / CellSize); x++) {
                            ctx.beginPath();
                            ctx.moveTo(0, (x * CellSize));
                            ctx.lineTo(MapWidth, (x * CellSize));
                            ctx.closePath();
                            ctx.stroke();
                        }

                        for (let y = 0; y <= Math.ceil(MapWidth / CellSize); y++) {
                            ctx.beginPath();
                            ctx.moveTo((y * CellSize), 0);
                            ctx.lineTo((y * CellSize), MapHeight);
                            ctx.closePath();
                            ctx.stroke();
                        }

                        for (const block of map) {
                            const { x, y, r, g, b, a } = block;

                            ctx.setTransform(cameraMatrix);

                            const sides = detectCollision({
                                x       : myPlayer.x / CellSize,
                                y       : myPlayer.y / CellSize,
                                width   : 1,
                                height  : 1,
                            }, {
                                x,
                                y,
                                width   : 1,
                                height  : 1,
                            });

                            if (stats.debugMode && sides.length) {
                                ctx.fillStyle = "red";
                                ctx.fillRect((x * CellSize), (y * CellSize), CellSize, CellSize);

                            } else {
                                if (isColor(block, 255, 255, 255)) {
                                    ctx.drawImage(floorImage, 0, 0, floorImage.width, floorImage.height, (x * CellSize), (y * CellSize), CellSize, CellSize);
                                    continue;
                                }

                                if (isColor(block, 255, 242, 0)) {
                                    ctx.drawImage(bonusImage, 0, 0, bonusImage.width, bonusImage.height, (x * CellSize), (y * CellSize), CellSize, CellSize);
                                    continue;
                                }

                                if (isColor(block, 127, 127, 127)) {
                                    ctx.resetTransform();

                                    switch (block.facingSide) {
                                        case "bottom":
                                            ctx.rotate(Math.PI);
                                            break;

                                        case "left":
                                            ctx.rotate(-Math.PI / 2);
                                            break;

                                        case "right":
                                            ctx.rotate(Math.PI / 2);
                                            break;
                                    }
                                    ctx.translate(-(CellSize / 2), -(CellSize / 2));

                                    const objectMatrix = ctx.getTransform();

                                    ctx.setTransform(cameraMatrix);

                                    ctx.translate(
                                        x * CellSize,
                                        y * CellSize,
                                    );

                                    if (stats.debugMode) {
                                        ctx.strokeStyle = "red";
                                        ctx.strokeRect(0, 0, CellSize, CellSize);
                                    }

                                    ctx.translate((CellSize / 2), (CellSize / 2));

                                    multiplyMatrix(objectMatrix);

                                    ctx.drawImage(spikeImage, 0, 0, spikeImage.width, spikeImage.height, 0, 0, CellSize, CellSize);
                                    continue;
                                }

                                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
                                ctx.fillRect((x * CellSize), (y * CellSize), CellSize, CellSize);
                            }
                        }
                    }

                    // Render my player.
                    {
                        ctx.resetTransform();

                        const rotateAngle = Math.max(myPlayer.velY, -8) * (Math.PI / 180);

                        (gravity < 0)
                            ? ctx.rotate(rotateAngle)
                            : ctx.rotate(-rotateAngle);

                        if (levelIdx % 2) {
                            ctx.scale(-1, 1);
                            ctx.translate(-CellSize, 0);
                        }

                        if (gravity < 0) {
                            ctx.scale(1, -1);
                            ctx.translate(0, -CellSize);
                        }

                        const objectMatrix = ctx.getTransform();

                        ctx.setTransform(cameraMatrix);

                        ctx.translate(
                            myPlayer.prevX + ((myPlayer.x - myPlayer.prevX) * partialTick),
                            myPlayer.prevY + ((myPlayer.y - myPlayer.prevY) * partialTick),
                        );

                        if (stats.debugMode) {
                            ctx.strokeStyle = "red";
                            ctx.strokeRect(0, 0, CellSize, CellSize);
                        }

                        multiplyMatrix(objectMatrix);

                        myPlayer.dead
                            ? ctx.drawImage(dedImage, 0, 0, dedImage.width, dedImage.height, 0, 0, CellSize, CellSize)
                            : ctx.drawImage(pepoImage, 0, 0, pepoImage.width, pepoImage.height, 0, 0, CellSize, CellSize);
                    }
                }
            }

            function onUpdate() {
                stats.tps++;

                myPlayer.prevX = myPlayer.x;
                myPlayer.prevY = myPlayer.y;

                myPlayer.x += myPlayer.velX;
                myPlayer.y += myPlayer.velY;

                function isColliding() {
                    if (myPlayer.y <= 0) {
                        myPlayer.y = 0;
                        return true;
                    }

                    for (const block of map) {
                        const { x, y } = block

                        // Ignore.
                        if (isColor(block, 163, 73, 164) || isColor(block, 0, 162, 232) || isColor(block, 158, 75, 164) || isColor(block, 59, 162, 231))
                            continue;

                        const sides = detectCollision({
                            x       : myPlayer.x / CellSize,
                            y       : myPlayer.y / CellSize,
                            width   : 1,
                            height  : 1,
                        }, {
                            x,
                            y,
                            width   : 1,
                            height  : 1,
                        });

                        if (sides.length) {
                            if (!isColor(block, 255, 242, 0)) {
                                if (sides.includes("top")) {
                                    myPlayer.y = (y + 1) * CellSize;

                                } else if (sides.includes("bottom")) {
                                    myPlayer.y = (y - 1) * CellSize;
                                }
                            }

                            // if (sides.includes("left")) {
                            //     myPlayer.x = (x - 1) * CellSize;

                            // } else if (sides.includes("right")) {
                            //     myPlayer.x = (x + 1) * CellSize;
                            // }

                            return block;
                        }

                        // // Collide top (roof).
                        // {
                        //     const playerCellX = (myPlayer.x / CellSize) + 1;
                        //     const playerCellY = (myPlayer.y / CellSize) + 1;

                        //     if (playerCellX >= x && playerCellX <= (x + 1)) {
                        //         if (playerCellY >= y && playerCellY <= (y + 1)) {
                        //             return block;
                        //         }
                        //     }
                        // }

                        // // Collide bottom (ground).
                        // {
                        //     const playerCellX = (myPlayer.x / CellSize);
                        //     const playerCellY = (myPlayer.y / CellSize);

                        //     if (playerCellX >= x && playerCellX <= (x + 1)) {
                        //         if (playerCellY >= y && playerCellY <= (y + 1)) {
                        //             myPlayer.y = (y + 1) * CellSize;
                        //             return block;
                        //         }
                        //     }
                        // }
                    }

                    return false;
                }

                const collided = isColliding();

                if (collided) {
                    if (typeof collided !== "boolean" && isColor(collided, 255, 242, 0)) {

                    } else {
                        myPlayer.velY = 0;

                        if (typeof collided !== "boolean") {
                            if (isColor(collided, 255, 201, 14)) {

                            } else if (isColor(collided, 255, 255, 255)) {
                                // console.log("T MORT (WHITE) !", collided);

                            } else if (isColor(collided, 127, 127, 127)) {
                                gravity = -2.0;
                                myPlayer.velX = 0;
                                myPlayer.velY = gravity;
                                myPlayer.dead = true;

                            } else if (isColor(collided, 255, 127, 39) || isColor(collided, 245, 128, 50)) {
                                console.log("BOOM SWITCH !");
                                gravity *= -1;

                            } else if (isColor(collided, 34, 177, 76)) {
                                levelIdx++;
                                respawnPlayer();

                            } else {
                                console.log(collided);
                            }
                        }
                    }
                }

                myPlayer.velY += gravity;

                if (!myPlayer.dead) {
                    if (inputs.has(" ") && typeof collided !== "boolean") {
                        myPlayer.velY = 20;
                        myPlayer.velY *= (gravity < 0)
                            ?  1
                            : -1;
                    }
                }

                if (inputs.has("Escape"))
                    respawnPlayer();
            }

            // Setup game canvas.
            setupCanvas(canvas);

            // Reset FPS and TPS stats.
            startHighPrecisionTimer(() => {
                stats.fps = 0;
                stats.tps = 0;
            }, 1000);
        });

        return () => (
            <div id="game">
                <div id="game-overlay">
                    {stats.debugMode && (
                        <div class="overlay-debug">
                            [ANIMEO GAME DEBUG MODE]<br />
                            x:      {myPlayer.x}<br />
                            y:      {myPlayer.y}<br />
                            velX:   {myPlayer.velX}<br />
                            velY:   {myPlayer.velY}<br />
                            fps:    {stats.fps}<br />
                            tps:    {stats.tps}<br />
                        </div>
                    )}
                </div>

                <canvas id="canvas" ref={refCanvas} />
            </div>
        );
    },
});
