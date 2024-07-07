import { defineComponent, onMounted, ref } from "vue";

export const test1 = defineComponent({
    setup() {
        const ak = ref(null);

        onMounted(() => {
            console.log("ez", ak.value);
            debugger;
        });

        return () => {
            <div ref={ak}>ak</div>
        };
    }
});
