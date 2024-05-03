import { onMounted, ref } from "vue";

// Version 4.0
const pSBC=(p,c0,c1,l)=>{
    let r,g,b,P,f,t,h,i=parseInt,m=Math.round,a=typeof(c1)=="string";
    if(typeof(p)!="number"||p<-1||p>1||typeof(c0)!="string"||(c0[0]!='r'&&c0[0]!='#')||(c1&&!a))return null;
    if(!globalThis.pSBCr)globalThis.pSBCr=(d)=>{
        let n=d.length,x={};
        if(n>9){
            [r,g,b,a]=d=d.split(","),n=d.length;
            if(n<3||n>4)return null;
            x.r=i(r[3]=="a"?r.slice(5):r.slice(4)),x.g=i(g),x.b=i(b),x.a=a?parseFloat(a):-1
        }else{
            if(n==8||n==6||n<4)return null;
            if(n<6)d="#"+d[1]+d[1]+d[2]+d[2]+d[3]+d[3]+(n>4?d[4]+d[4]:"");
            d=i(d.slice(1),16);
            if(n==9||n==5)x.r=d>>24&255,x.g=d>>16&255,x.b=d>>8&255,x.a=m((d&255)/0.255)/1000;
            else x.r=d>>16,x.g=d>>8&255,x.b=d&255,x.a=-1
        }return x};
    h=c0.length>9,h=a?c1.length>9?true:c1=="c"?!h:false:h,f=globalThis.pSBCr(c0),P=p<0,t=c1&&c1!="c"?globalThis.pSBCr(c1):P?{r:0,g:0,b:0,a:-1}:{r:255,g:255,b:255,a:-1},p=P?p*-1:p,P=1-p;
    if(!f||!t)return null;
    if(l)r=m(P*f.r+p*t.r),g=m(P*f.g+p*t.g),b=m(P*f.b+p*t.b);
    else r=m((P*f.r**2+p*t.r**2)**0.5),g=m((P*f.g**2+p*t.g**2)**0.5),b=m((P*f.b**2+p*t.b**2)**0.5);
    a=f.a,t=t.a,f=a>=0||t>=0,a=f?a<0?t:t<0?a:a*P+t*p:0;
    if(h)return"rgb"+(f?"a(":"(")+r+","+g+","+b+(f?","+m(a*1000)/1000:"")+")";
    else return"#"+(4294967296+r*16777216+g*65536+b*256+(f?m(a*255):0)).toString(16).slice(1,f?undefined:-2)
}

export default {

    setup() {
        const refCanvas     = ref(null);
        const refStarted    = ref(false);

        onMounted(() => {
            const canvas            = refCanvas.value;
            const ctx               = canvas.getContext("2d");
            const TicksPerSeconds   = 40;
            const TicksDelta        = 1000 / TicksPerSeconds;
            const MapSize           = 50;
            const CellSize          = 40;
            const Players           = new Map();
            let GameMap             = [];
            const PressedKeys       = new Set();
            const MyPlayerName      = "pepo" + Math.floor(Math.random() * 10000);
            const ws                = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`);

            ws.onopen = () => {
                ws.send(JSON.stringify({
                    op  : "Login",
                    d   : MyPlayerName,
                }));

                setInterval(() => ws.send(JSON.stringify({
                    op  : "Ping",
                    d   : Date.now(),
                })), 5_000);
            };

            ws.onmessage = ({ data }) => {
                const packet = JSON.parse(data);

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
                canvas.width    = canvas.offsetWidth;
                canvas.height   = canvas.offsetHeight;

                window.addEventListener("keydown", (e) => {
                    if (!PressedKeys.has(e.key)) {
                        PressedKeys.add(e.key);

                        ws.send(JSON.stringify({
                            op  : "Input",
                            d   : [...PressedKeys],
                        }));
                    }
                });

                window.addEventListener("keyup", (e) => {
                    PressedKeys.delete(e.key);

                    ws.send(JSON.stringify({
                        op  : "Input",
                        d   : [...PressedKeys],
                    }));
                });

                window.addEventListener("resize", () => {
                    canvas.width    = canvas.offsetWidth;
                    canvas.height   = canvas.offsetHeight;
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

            function startGame() {
                if (refStarted.value)
                    return;

                refStarted.value = true;

                // Start game.
                requestAnimationFrame((startMs) => {
                    let timeDelta   = 0;
                    let prevMs      = startMs;

                    // Start game.
                    onGameStart();

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
                            onUpdate();
                            timeDelta -= TicksDelta;
                        }

                        // Run render.
                        onRender(timeDelta / TicksDelta);

                        requestAnimationFrame(gameLoop);
                    });
                });
            }

            startGame();
        });

        return () => {
            return <canvas id="canvas" ref={refCanvas} />;
        };
    },
}
