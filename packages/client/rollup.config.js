import babel            from "@rollup/plugin-babel";
import terser           from "@rollup/plugin-terser";
import typescript       from "@rollup/plugin-typescript";
import externalGlobals  from "rollup-plugin-external-globals";


////////////////////////////////////////////////
//  ROLLUP
////////////////////////////////////////////////


export default {
    input: "src/index.ts",
    output: {
        format          : "es",
        dir             : "dist",
        entryFileNames  : () => "script.js",
        chunkFileNames  : "chunk-[name].js",
        sourcemap       : true,
    },
    plugins: [
        typescript({
            outDir: "dist",
        }),
        babel({
            babelrc         : false,
            babelHelpers    : "bundled",
            extensions      : [ ".js", ".jsx", ".ts", ".tsx" ],
            include         : [ "src/**/*" ],
            exclude         : [ "node_modules/**" ],
            plugins: [
                "@vue/babel-plugin-jsx",
                "@babel/plugin-transform-optional-chaining",
                "@babel/plugin-transform-nullish-coalescing-operator",
                "@babel/plugin-transform-logical-assignment-operators",
            ],
            presets: [
                "@babel/preset-typescript",
            ],
        }),
        externalGlobals({
            "vue"           : "Vue",
            "vue-router"    : "VueRouter",
        }),
        terser({
            compress: {
                drop_debugger: false,
            },
        }),
    ],
    external: [
        "vue",
        "vue-router",
    ],
};
