import { JSX } from "vue/jsx-runtime";

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

import Pause                            from "./components/pause.js";
import Main                             from "./components/main.js";
import Loading                          from "./components/loading.js";
import { Block, detectCollision }       from "./utils/collision.js";
import { isColor }                      from "./utils/color.js";
import { createImageDataProcessor }     from "./utils/pixelmap.js";
import GameOverlay                      from "./components/gui.js";

import {
    fetchImage,
    fetchImageData,
    createAssetsLoader
} from "./utils/loader.js";

function createGame() {
    const refLoading = ref(true);

    const gameLoop = createGameLoop({
        onGameStart,
        onRender,
        onUpdate,
        ticksPerSeconds: 40,
    });

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

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;
    const inputs    = setupKeyboard();
    const CellSize  = 40;
    let gravity     = 0.0;

    const map       = [] as Block[];
    const spawns    = [] as Block[];
    let pepoImage   = null as unknown as HTMLImageElement;
    let dedImage    = null as unknown as HTMLImageElement;
    let spikeImage  = null as unknown as HTMLImageElement;
    let floorImage  = null as unknown as HTMLImageElement;
    let bonusImage  = null as unknown as HTMLImageElement;
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

    window.addEventListener("contextmenu", (e) => {
        e.preventDefault();
    });

    window.addEventListener("pointerdown", (e) => {
        if (gameLoop.refStarted.value)
            inputs.add(" ");
    });

    window.addEventListener("pointerup", (e) => {
        if (gameLoop.refStarted.value)
            inputs.delete(" ");
    });

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

    const refAudioContext = ref<AudioContext>();

    async function startGame() {
        const audioCtx = new AudioContext({
            latencyHint: "interactive",
        });

        refAudioContext.value = audioCtx;

        if (localStorage["audioMuted"])
            audioCtx.suspend();

        const nodeGain = audioCtx.createGain();
        nodeGain.gain.setValueAtTime(0.25, 0);
        nodeGain.connect(audioCtx.destination);

        function playBuffer(buffer: AudioBuffer) {
            const source = audioCtx.createBufferSource();

            source.buffer = buffer;
            source.connect(nodeGain);
            source.loop = true;
            source.start();
        }

        function decodeAudio(buffer: ArrayBuffer) {
            return audioCtx.decodeAudioData(buffer, playBuffer);
        }

        async function loadAudio() {
            const response  = await fetch("/assets/song4.mp3");
            const buffer    = await response.arrayBuffer();

            return buffer;
        }

        const imageData         = await fetchImageData("/assets/maps/level1.png");
        const imageProcessor    = createImageDataProcessor(imageData);

        pepoImage   = await fetchImage("/assets/pepo.png");
        dedImage    = await fetchImage("/assets/ded.png");
        spikeImage  = await fetchImage("/assets/spike.png");
        floorImage  = await fetchImage("/assets/floor.png");
        bonusImage  = await fetchImage("/assets/bonus.png");

        const assetsLoader = createAssetsLoader({
            sprites: {
                pepoImage   : "/assets/pepo.png",
                dedImage    : "/assets/ded.png",
                spikeImage  : "/assets/spike.png",
                bonusImage  : "/assets/bonus.png",
            },
            sounds: {
                song1: "/assets/song1.mp3",
            },
        });

        const gameAssets = await assetsLoader.load();

        playBuffer(await decodeAudio(await loadAudio()));

        refLoading.value = false;

        for (let y = 0; y < imageData.height; y++) {
            for (let x = 0; x < imageData.width; x++) {
                const [ r, g, b, a ] = imageProcessor.getPixel(x, y);

                const block: Block = {
                    x,
                    y: imageData.height - y - 1,
                    r, g, b, a,
                    facingSide: imageProcessor.getFacingSide(x, y),
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
    }

    async function onGameStart() {

        // Download all assets.
        await startGame();

        // Setup game canvas.
        setupCanvas(canvas);

        // Reset FPS and TPS stats.
        startHighPrecisionTimer(() => {
            stats.fps = 0;
            stats.tps = 0;
        }, 1000);

        respawnPlayer();
    }

    function setupCamera(partialTick: number): DOMMatrix {
        const posX = myPlayer.prevX + ((myPlayer.x - myPlayer.prevX) * partialTick);

        ctx.translate(0, canvas.height);

        const scaleWidth    = CellSize * 36;
        const scaleFactor   = canvas.width / scaleWidth;

        // Camera inverse projection matrix.
        ctx.scale(1.0, -1.0);
        ctx.scale(scaleFactor, scaleFactor);

        // Camera focus at x: 200.
        if (levelIdx % 2) {
            ctx.translate((scaleWidth - 200), (levelIdx * -400));

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

    return {
        refStarted: gameLoop.refStarted,
        refLoading,
        myPlayer,
        stats,
        respawnPlayer,

        setupCanvas(_canvas: HTMLCanvasElement) {
            canvas  = _canvas;
            ctx     = _canvas.getContext("2d")!;
        },

        start() {
            gameLoop.startGame();
        },

        musicManager: {
            toggleMusic() {
                const audioCtx = refAudioContext.value;

                if (audioCtx) {
                    if (audioCtx.state === "running") {
                        localStorage["audioMuted"] = 1;
                        audioCtx.suspend();

                    } else {
                        delete localStorage["audioMuted"];
                        audioCtx.resume();
                    }
                }
            },
        },
    }
}

export default defineComponent({

    setup() {
        const refCanvas = ref<HTMLCanvasElement | null>(null);
        const game      = createGame();

        onMounted(() => {
            game.setupCanvas(refCanvas.value!);
        });

        function renderMenu(): JSX.Element | void {
            if (!game.refStarted.value)
                return <Main onStart={game.start} />;

            if (game.refLoading.value)
                return <Loading />;

            if (game.myPlayer.dead)
                return <Pause onRestart={game.respawnPlayer} />;
        }

        return () => (
            <div id="game">
                {renderMenu()}
                <GameOverlay game={game} />
                <canvas id="canvas" ref={refCanvas} />
            </div>
        );
    },
});
