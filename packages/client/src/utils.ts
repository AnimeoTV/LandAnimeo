import { reactive, ref } from "vue";

type GameLoopOptions = {
    ticksPerSeconds : number;
    onGameStart     : () => Promise<void> | void;
    onUpdate        : () => void;
    onRender        : (partialTicks: number) => void;
};

interface GamePacket {
    op  : string;
    d   : any;
};

type WebSocketOptions<T extends GamePacket> = {
    playerName: string;
    onPacket(packet: T): void;
};

export function setupWebSocket<T extends GamePacket>(options: WebSocketOptions<T>) {
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`);

    ws.onopen = () => {
        ws.send(JSON.stringify({
            op  : "Login",
            d   : options.playerName,
        }));

        setInterval(() => ws.send(JSON.stringify({
            op  : "Ping",
            d   : Date.now(),
        })), 5_000);
    };

    ws.onmessage = ({ data }) => {
        const packet = JSON.parse(data);

        options.onPacket(packet);
    };

    return ws;
}

export function setupCanvas(canvas: HTMLCanvasElement) {
    canvas.width    = canvas.offsetWidth;
    canvas.height   = canvas.offsetHeight;

    window.addEventListener("resize", () => {
        canvas.width    = canvas.offsetWidth;
        canvas.height   = canvas.offsetHeight;
    });
}

export function setupKeyboard() {
    const pressedKeys = reactive(new Set<string>());

    window.addEventListener("keydown", (e) => {
        if (!pressedKeys.has(e.key))
            pressedKeys.add(e.key);
    });

    window.addEventListener("keyup", (e) => {
        pressedKeys.delete(e.key);
    });

    return pressedKeys;
}

export function createGameLoop(options: GameLoopOptions) {
    const refStarted        = ref(false);
    const TicksPerSeconds   = options.ticksPerSeconds;
    const TicksDelta        = 1000 / TicksPerSeconds;

    function startGame() {
        if (refStarted.value)
            return;

        refStarted.value = true;

        // Start game.
        requestAnimationFrame(async (startMs) => {
            let timeDelta   = 0;
            let prevMs      = startMs;

            // Start game.
            await options.onGameStart();

            // Start game loop.
            requestAnimationFrame(function gameLoop(ms) {

                // Stop game.
                if (!refStarted.value)
                    return;

                // Calculate time delta and set previous ms.
                timeDelta   += (ms - prevMs);
                prevMs      = ms;

                // Run tick.
                while (timeDelta >= TicksDelta) {
                    options.onUpdate();
                    timeDelta -= TicksDelta;
                }

                // Run render.
                options.onRender(timeDelta / TicksDelta);

                requestAnimationFrame(gameLoop);
            });
        });
    }

    return {
        refStarted,
        startGame,
    };
}

export function startHighPrecisionTimer(cb: () => void, delay: number): () => void {
    let tid: number | undefined;
    let lastTime = performance.now();

    function getNext() {
        return Math.max(0, ((lastTime + delay) - performance.now()));
    }

    function loop() {
        tid = setTimeout(() => {
            tid = undefined;
            lastTime += delay;
            cb();
            loop();
        }, getNext());
    }

    loop();

    return () => {
        clearTimeout(tid);
    };
}
