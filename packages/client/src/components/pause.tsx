import { PropType, defineComponent, onMounted, ref } from "vue";

export default defineComponent({

    props: {
        onRestart: Object as PropType<() => void>,
    },

    setup(props) {
        const refGameOverlay = ref<HTMLDivElement>();

        onMounted(() => {
            setTimeout(() => {
                refGameOverlay.value!.style.opacity = "1";
            }, 1);
        });

        return () => (
            <div class="game-overlay-menu" style="background: #1b1b1bc2; backdrop-filter: grayscale(1); transition: 0.2s linear;" ref={refGameOverlay}>
                <div class="game-overlay-center">
                    <div class="game-overlay-menu-title">
                        YOU GOT DODOTED
                    </div>

                    <div class="game-overlay-menu-description">
                        Appuyez sur <b style="color: pink">Echap</b> pour réveiller Pepo.
                    </div>

                    <div class="game-overlay-menu-buttons">
                        <div class="game-overlay-menu-button" onClick={props.onRestart}>
                            Réveiller Pepo 😴
                        </div>
                    </div>
                </div>
            </div>
        );
    },
});
