import { PropType, defineComponent, onMounted, ref } from "vue";

export default defineComponent({

    props: {
        onStart: Object as PropType<() => void>,
    },

    setup(props) {
        const refGameOverlay = ref<HTMLDivElement>();

        onMounted(() => {
            setTimeout(() => {
                refGameOverlay.value!.style.opacity = "1";
            }, 500);
        });

        return () => (
            <div class="game-overlay-menu" ref={refGameOverlay}>
                <div class="game-overlay-center">
                    <div class="game-overlay-menu-title">
                        <img src="/assets/pepo.png" alt="Pepo" />
                        PEPOMETRY DASH
                    </div>

                    <div class="game-overlay-menu-description">
                        Aidez Pepo sur le chemin <b style="color: pink">delamour</b>
                    </div>

                    <div class="game-overlay-menu-buttons">
                        <div class="game-overlay-menu-button" onClick={props.onStart}>
                            JOUER
                        </div>
                    </div>
                </div>

                <div class="game-overlay-credits">
                    Créé par <b>Pepo Jayzou</b>
                </div>
            </div>
        );
    },
});
