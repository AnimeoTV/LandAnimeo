import { PropType, defineComponent } from "vue";

type GameType ={
    myPlayer: {
        x: number;
        y: number;
        velX: number;
        velY: number;
        prevX: number;
        prevY: number;
        dead: boolean;
    };
    stats: {
        fps: number;
        tps: number;
        debugMode: boolean;
    };
    musicManager: {
        toggleMusic: () => void;
    },
};

export default defineComponent({

    props: {
        game: {
            type        : Object as PropType<GameType>,
            required    : true,
        },
    },

    setup(props) {
        return () => {
            const game = props.game;

            return (
                <div id="game-overlay">
                    <div class="game-music" onClick={() => game.musicManager.toggleMusic()}>
                        🎵
                    </div>

                    {game.stats.debugMode && (
                        <div class="overlay-debug">
                            [ANIMEO GAME DEBUG MODE]<br />
                            x:      {game.myPlayer.x}<br />
                            y:      {game.myPlayer.y}<br />
                            velX:   {game.myPlayer.velX}<br />
                            velY:   {game.myPlayer.velY}<br />
                            fps:    {game.stats.fps}<br />
                            tps:    {game.stats.tps}<br />
                        </div>
                    )}
                </div>
            );
        };
    },
})