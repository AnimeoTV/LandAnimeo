import path                     from "path";
import express                  from "express";
import expressWs                from "express-ws";
import { WebSocket, RawData }   from "ws";

const expressApp    = express();
const { app }       = expressWs(expressApp);
const players       = new Map<string, PlayerSession>();

type PlayerSession = {
    ws          : WebSocket;
    username    : string;
    color       : string;

    // Game physic.
    x           : number;
    y           : number;
    speed       : number;
    velY        : number;
    velX        : number;
    inputs      : Set<string>;
};

function authenticateUser(ws: WebSocket): Promise<string> {
    return new Promise((resolve, reject) => {
        const timeoutID = setTimeout(() => {
            ws.off("message", onMessage);
            ws.close(4008);
            ws.terminate();
            reject();
        }, 5000);

        function onMessage(message: RawData) {
            clearTimeout(timeoutID);

            if (typeof message === "string") {
                const packet = JSON.parse(message);

                if (packet.op === "Login" && typeof packet.d === "string" && packet.d.length >= 3 && packet.d.length <= 16) {
                    resolve(packet.d);
                    return;
                }
            }

            ws.close(4000);
            ws.terminate();
            reject();
        }

        ws.once("message", onMessage);
    });
}

function registerGameSession(ws: WebSocket, username: string): PlayerSession {
    if (players.has(username)) {
        ws.send(JSON.stringify({
            op: "Disconnect",
            d: {
                reason: "Username is already taken.",
            },
        }));

        ws.close(4003);
        ws.terminate();

        throw new Error("Username is already taken.");

    } else {
        const playerSession: PlayerSession = {
            ws,
            username,
            color: Colors[Math.floor(Math.random() * Colors.length)]!,

            // Game physic.
            x       : 0,
            y       : 0,
            speed   : 5,
            velX    : 0,
            velY    : 0,
            inputs  : new Set(),
        };

        respawnPlayer(playerSession);

        broadcastGame({
            op: "PlayerJoin",
            d: {
                username    : username,
                color       : playerSession.color,
                x           : playerSession.x,
                y           : playerSession.y,
                velX        : playerSession.velX,
                velY        : playerSession.velY,
            },
        });

        players.set(username, playerSession);

        ws.on("close", () => {
            players.delete(username);

            // Reset player land.
            for (let x = 0; x < MapSize; x++)
                for (let y = 0; y < MapSize; y++)
                    if (GameMap[x]![y]![0] === playerSession.username)
                        GameMap[x]![y] = [ null, false ];

            broadcastGame({
                op  : "PlayerLeave",
                d   : username,
            });
        });

        ws.send(JSON.stringify({
            op: "GameJoin",
            d: {
                me: {
                    username,
                },
                players: [...players.values()].map((player) => ({
                    username    : player.username,
                    color       : player.color,
                    x           : player.x,
                    y           : player.y,
                    velX        : player.velX,
                    velY        : player.velY,
                })),
                map: GameMap,
            },
        }));

        return playerSession;
    }
}

function broadcastGame(packet: Record<string, any>) {
    const packetSerialized = JSON.stringify(packet);

    for (const { ws } of players.values())
        ws.send(packetSerialized);
}

type GameMap = [ (string | null), boolean ][][];

const MapSize           = 50;
const CellSize          = 40;
const TicksPerSeconds   = 40;
const TicksDelta        = 1000 / TicksPerSeconds;
const GameMap           = Array(MapSize).fill(0).map(() => Array(MapSize).fill(0).map(() => ([ null, false ]))) as GameMap;
const Spawns            = [
    [  5,  5 ],
    [  5, 25 ],
    [  5, 45 ],
    [ 25,  5 ],
    [ 25, 25 ],
    [ 25, 45 ],
    [ 45,  5 ],
    [ 45, 25 ],
    [ 45, 45 ],
] as const;

const Colors = [
    "#22D445",  // VERT
    "#DC3C8C",  // ROSE
    "#3841D5",  // BLEU FONCE
    "#3DE6E8",  // BLEU CYAN
    "#F09214",  // ORANGE
    "#A314F0",  // VIOLET
    "#F01414",  // ROUGE
    "#F0E839",  // JAUNE
    "#673737",  // MARRON
] as const;

function respawnPlayer(player: PlayerSession) {
    const [ cellX, cellY ]  = Spawns[Math.floor(Math.random() * Spawns.length)]!;
    const spawnX            = cellX * CellSize;
    const spawnY            = cellY * CellSize;

    for (let x = (cellX - 1); x <= (cellX + 1); x++)
        for (let y = (cellY - 1); y <= (cellY + 1); y++)
            GameMap[x]![y] = [ player.username, true ];

    player.inputs.clear();
    player.x        = spawnX;
    player.y        = spawnY;
    player.velX     = 0;
    player.velY     = 0;
}

function onUpdate() {
    const playersStates = [] as {
        username    : string;
        x           : number;
        y           : number;
        velX        : Number;
        velY        : number;
    }[];

    // Update players position.
    for (const player of players.values()) {
        player.x += player.velX;
        player.y += player.velY;

        // Fix player position if out of map.
        {
            if (player.x < 0)
                player.x = 0;

            if (player.x > (CellSize * MapSize) - CellSize)
                player.x = (CellSize * MapSize) - CellSize;

            if (player.y > (CellSize * MapSize) - CellSize)
                player.y = (CellSize * MapSize) - CellSize;

            if (player.y < 0)
                player.y = 0;
        }

        const deltaX = player.x % CellSize;
        const deltaY = player.y % CellSize;

        if (deltaX === 0 && deltaY === 0) {
            if (player.inputs.has(" ")) {
                player.velX = 0;
                player.velY = 0;

            } else if (player.inputs.has("ArrowDown")) {
                player.velX = 0;
                player.velY = player.speed;

            } else if (player.inputs.has("ArrowUp")) {
                player.velX = 0;
                player.velY = -player.speed;

            } else if (player.inputs.has("ArrowRight")) {
                player.velX = player.speed;
                player.velY = 0;

            } else if (player.inputs.has("ArrowLeft")) {
                player.velX = -player.speed;
                player.velY = 0;
            }
        }

        // Color map.
        if (deltaX === 0 && deltaY === 0) {
            const cellX                     = Math.floor(player.x / CellSize);
            const cellY                     = Math.floor(player.y / CellSize);
            const [ playerName, claimed ]   = GameMap[cellX]![cellY]!;

            // Claimed by the player.
            if (playerName === player.username) {

                // Claim land zone.
                if (claimed) {

                    function startFloodFill(startX: number, startY: number): [ Set<string>, boolean ] {
                        const visited   = new Set<string>();
                        const queue     = [ [ startX, startY ] ] as [ number, number ][];

                        function isBound(x: number, y: number) {
                            return (x < 0 || y < 0 || x >= MapSize || y >= MapSize);
                        }

                        function isClaimed(x: number, y: number) {
                            return GameMap[x]![y]![0] === player.username;
                        }

                        function addPoint(x: number, y: number) {
                            if (!visited.has(`${x}.${y}`)) {
                                if (isClaimed(x, y)) {
                                    visited.add(`${x}.${y}`);

                                } else {
                                    queue.push([ x, y ]);
                                }
                            }
                        }

                        while (queue.length) {
                            const [ cellX, cellY ] = queue.pop()!;

                            visited.add(`${cellX}.${cellY}`);

                            if (isBound((cellX - 1), cellY))
                                return [ visited, false ];

                            if (isBound((cellX + 1), cellY))
                                return [ visited, false ];

                            if (isBound(cellX, (cellY - 1)))
                                return [ visited, false ];

                            if (isBound(cellX, (cellY + 1)))
                                return [ visited, false ];

                            addPoint((cellX - 1), cellY);
                            addPoint((cellX + 1), cellY);
                            addPoint(cellX, (cellY - 1));
                            addPoint(cellX, (cellY + 1));
                        }

                        return [ visited, true ];
                    }

                    function fillZone(cellX: number, cellY: number) {
                        const [ visited, claimed ] = startFloodFill(cellX, cellY);

                        if (claimed) {
                            for (const entry of visited) {
                                const [ cellX, cellY ] = entry.split(".").map((part) => Number(part)) as [ number, number ];

                                // Kill other players.
                                if (GameMap[cellX]![cellY]![0] !== player.username || !GameMap[cellX]![cellY]![1]) {
                                    const killedPlayers = [...players.values()].filter((player) => {
                                        return (player.x >= (cellX * CellSize))
                                            && (player.x <= (cellX * CellSize) + CellSize)
                                            && (player.y >= (cellY * CellSize))
                                            && (player.y <= (cellY * CellSize) + CellSize);
                                    });

                                    for (const killedPlayer of killedPlayers)
                                        if (killedPlayer.username !== player.username)
                                            respawnPlayer(killedPlayer);
                                }

                                GameMap[cellX]![cellY] = [ player.username, true ];
                            }
                        }
                    }

                    fillZone((cellX - 1), cellY);
                    fillZone((cellX + 1), cellY);
                    fillZone(cellX, (cellY - 1));
                    fillZone(cellX, (cellY + 1));

                    // Set player land.
                    for (let x = 0; x < MapSize; x++)
                        for (let y = 0; y < MapSize; y++)
                            if (GameMap[x]![y]![0] === player.username)
                                GameMap[x]![y] = [ player.username, true ];

                // Oups, player cut himself. (Dead)
                } else {

                    // Reset player land.
                    for (let x = 0; x < MapSize; x++)
                        for (let y = 0; y < MapSize; y++)
                            if (GameMap[x]![y]![0] === player.username)
                                GameMap[x]![y] = [ null, false ];

                    respawnPlayer(player);
                }

            // Not claimed land or other player land.
            } else {
                if (!claimed && playerName !== null) {
                    const targetPlayer = players.get(playerName);

                    // Claim other player land.
                    for (let x = 0; x < MapSize; x++)
                        for (let y = 0; y < MapSize; y++)
                            if (GameMap[x]![y]![0] === playerName && GameMap[x]![y]![1])
                                GameMap[x]![y] = [ player.username, true ];

                    // This should not happen.
                    if (!targetPlayer)
                        throw new Error("This shouldn't have happened, met \"Invalid player\"...");

                    respawnPlayer(targetPlayer);
                }

                GameMap[cellX]![cellY] = [ player.username, false ];
            }
        }

        playersStates.push({
            username    : player.username,
            x           : player.x,
            y           : player.y,
            velX        : player.velX,
            velY        : player.velY,
        });
    }

    broadcastGame({
        op: "UpdateState",
        d: {
            map: GameMap,
            playersStates,
        },
    });
}

function startGame() {
    const startedMs = performance.now();
    let prevMs      = startedMs;
    let deltaMs     = 0;

    setTimeout(function gameLoop() {
        const ms = performance.now();

        deltaMs += (ms - prevMs);
        prevMs = ms;

        while (deltaMs >= TicksDelta) {
            onUpdate();
            deltaMs -= TicksDelta;
        }

        setTimeout(gameLoop, TicksDelta);
    }, TicksDelta);

    console.log("[GAME] Game started.");
}

app.ws("/", async (ws, req) => {
    try {
        // Authenticate user.
        const username = await authenticateUser(ws);

        // Register session.
        const session = registerGameSession(ws, username);

        ws.on("message", (message) => {
            if (typeof message === "string") {
                const packet = JSON.parse(message);

                switch (packet.op) {
                    case "Ping":
                        ws.send(JSON.stringify({
                            op  : "Pong",
                            d   : Date.now(),
                        }));
                        return;

                    case "Input":
                        if (Array.isArray(packet.d) && packet.d.length <= 30) {
                            session.inputs = new Set(packet.d);

                        } else {
                            ws.close(4005);
                            ws.terminate();
                        }
                        return;

                    default:
                        ws.close(4005);
                        ws.terminate();
                        return;
                }
            }
        });

    } catch (err) {
        console.error("OUPS.", err);
        ws.terminate();
    }
});

app.use(express.static(path.resolve("public")));

app.use((req, res) => {
    res.status(404).json({
        code    : 404,
        error   : "Pepo is AFK.",
    });
});

app.listen(8958, "127.0.0.1", () => {
    console.log("[EXPRESS] Server started.");
    startGame();
});
