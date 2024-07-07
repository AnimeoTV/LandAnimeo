import { defineComponent, onMounted, ref } from "vue";

export default defineComponent({

    setup() {
        const refGameOverlay = ref<HTMLDivElement>();

        onMounted(() => {
            setTimeout(() => {
                refGameOverlay.value!.style.opacity = "1";
            }, 1);
        });

        return () => (
            <div class="game-overlay-menu" style="background: #000" ref={refGameOverlay}>
                <div class="game-overlay-center">
                    <div class="game-overlay-menu-title">
                        <img src="/assets/pepo.png" alt="Pepo" />
                    </div>

                    <div class="game-overlay-menu-description">
                        Chargement en cours...
                    </div>
                </div>
            </div>
        );
    },
});
