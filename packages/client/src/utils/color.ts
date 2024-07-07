import { Block }    from "./collision.js";
export { pSBC }     from "./color-js.js";

export type ArrayRGBA = [ number, number, number, number ];

export function isColor(block: Pick<Block, "r" | "g" | "b">, r: number, g: number, b: number): boolean {
    return (block.r === r && block.g === g && block.b === b);
}
