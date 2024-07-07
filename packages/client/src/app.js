import {
    defineComponent,
    onMounted,
    ref,
    watch
} from "vue";

import { pSBC } from "./utils/color.js";

import {
    createGameLoop,
    setupCanvas,
    setupKeyboard,
    setupWebSocket
} from "./utils";

export default defineComponent({

    setup() {
        const refCanvas = ref(null);

        onMounted(() => {
            const canvas            = refCanvas.value;
            const ctx               = canvas.getContext("2d");
            const MapSize           = 50;
            const CellSize          = 40;
            const Players           = new Map();
            let GameMap             = [];
            const MyPlayerName      = "pepo" + Math.floor(Math.random() * 10000);
            const PressedKeys       = setupKeyboard(canvas);

            // Setup game canvas.
            setupCanvas(canvas);

            function onPacket(packet) {
                switch (packet.op) {
                    case "GameJoin":
                        for (const player of packet.d.players)
                            Players.set(player.username, {
                                color       : player.color,
                                prevX       : player.x,
                                prevY       : player.y,
                                x           : player.x,
                                y           : player.y,
                                velX        : player.velX,
                                velY        : player.velY,
                            });

                        GameMap = packet.d.map;
                        break;

                    case "UpdateState":
                        for (const playerState of packet.d.playersStates) {
                            const player = Players.get(playerState.username);

                            player.prevX    = playerState.x;
                            player.prevY    = playerState.y;
                            player.x        = playerState.x;
                            player.y        = playerState.y;
                            player.velX     = playerState.velX;
                            player.velY     = playerState.velY;
                        }

                        GameMap = packet.d.map;
                        break;

                    case "PlayerJoin":
                        Players.set(packet.d.username, {
                            color       : packet.d.color,
                            prevX       : packet.d.x,
                            prevY       : packet.d.y,
                            x           : packet.d.x,
                            y           : packet.d.y,
                            velX        : packet.d.velX,
                            velY        : packet.d.velY,
                        });
                        break;

                    case "PlayerLeave":
                        Players.delete(packet.d);

                        // Reset player land.
                        for (let x = 0; x < MapSize; x++)
                            for (let y = 0; y < MapSize; y++)
                                if (GameMap[x][y][0] === packet.d)
                                    GameMap[x][y] = [ null, false ];

                        break;

                    default:
                        break;
                }
            };

            function onGameStart() {
                const ws = setupWebSocket({
                    playerName  : MyPlayerName,
                    onPacket    : onPacket,
                });

                watch(PressedKeys, (inputs) => {
                    ws.send(JSON.stringify({
                        op  : "Input",
                        d   : [...inputs],
                    }));
                });
            }

            function onUpdate() {
                // TODO
            }

            function onRender(partialTick) {
                const myPlayer = Players.get(MyPlayerName);

                // Clear canvas.
                ctx.resetTransform();
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                if (myPlayer) {

                    // Setup camera (center to player).
                    {
                        const posX = myPlayer.prevX + ((myPlayer.x - myPlayer.prevX) * partialTick);
                        const posY = myPlayer.prevY + ((myPlayer.y - myPlayer.prevY) * partialTick);

                        // Camera focus the center.
                        ctx.translate((canvas.width / 2), (canvas.height / 2));

                        // Camera zoom.
                        ctx.scale(0.8, 0.8);

                        // Camera position.
                        ctx.translate(-(posX + (CellSize / 2)), -(posY + (CellSize / 2)));
                    }

                    // Render map.
                    for (let x = 0; x < MapSize; x++) {
                        for (let y = 0; y < MapSize; y++) {
                            const [ playerName, claimed ] = GameMap[x][y];

                            if (playerName === null) {
                                ctx.strokeStyle = "rgba(255, 255, 255, .1)";
                                ctx.fillStyle   = "black";

                            } else {
                                const player = Players.get(playerName);

                                if (claimed) {
                                    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
                                    ctx.fillStyle   = player.color;

                                } else {
                                    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
                                    ctx.fillStyle   = pSBC(0.40, player.color);
                                }
                            }

                            ctx.fillRect((CellSize * x), (CellSize * y), CellSize, CellSize);
                            ctx.strokeRect((CellSize * x),(CellSize * y), CellSize, CellSize);
                        }
                    }

                    // Render other players.
                    for (const player of Players.values()) {
                        if (player.username === MyPlayerName)
                            continue;

                        ctx.fillStyle = pSBC(-0.40, player.color);
                        ctx.fillRect(
                            player.prevX + ((player.x - player.prevX) * partialTick),
                            player.prevY + ((player.y - player.prevY) * partialTick),
                            CellSize, CellSize
                        );
                    }

                    // Render my player.
                    {
                        // ctx.strokeStyle = "red";
                        // ctx.strokeRect(player.x, player.y, CellSize, CellSize);

                        // ctx.strokeStyle = "lime";
                        // ctx.strokeRect(player.prevX, player.prevY, CellSize, CellSize);

                        ctx.fillStyle = pSBC(-0.40, myPlayer.color);
                        ctx.fillRect(
                            myPlayer.prevX + ((myPlayer.x - myPlayer.prevX) * partialTick),
                            myPlayer.prevY + ((myPlayer.y - myPlayer.prevY) * partialTick),
                            CellSize, CellSize
                        );
                    }
                }
            }

            const gameLoop = createGameLoop({
                onGameStart,
                onRender,
                onUpdate,
                ticksPerSeconds: 40,
            });

            gameLoop.startGame();
        });

        return () => {
            return <canvas id="canvas" ref={refCanvas} />;
        };
    },
});
