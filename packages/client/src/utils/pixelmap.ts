import { Side }                 from "./collision.js";
import { ArrayRGBA, isColor }   from "./color.js";

export function createImageDataProcessor(imageData: ImageData) {
    return {
        getPixel(x: number, y: number): ArrayRGBA {
            if (x >= 0 && y >= 0) {
                const pixelPos  = (x + (y * imageData.width)) * 4;
                const r         = imageData.data[pixelPos + 0]!;
                const g         = imageData.data[pixelPos + 1]!;
                const b         = imageData.data[pixelPos + 2]!;
                const a         = imageData.data[pixelPos + 3]!;

                return [ r, g, b, a ];

            } else {
                return [ 255, 255, 255, 255 ];
            }
        },

        isEmptyPixel(x: number, y: number): boolean {
            const [ r, g, b, a ] = this.getPixel(x, y);

            return isColor({ r, g, b }, 255, 255, 255);
        },

        isSamePixel(x1: number, y1: number, x2: number, y2: number): boolean {
            const [ r1, g1, b1, a1 ] = this.getPixel(x1, y1);
            const [ r2, g2, b2, a2 ] = this.getPixel(x2, y2);

            return r1 === r2
                && g1 === g2
                && b1 === b2
                && a1 === a2;
        },

        getFacingSide(x: number, y: number): Side | null {

            // Same pixel.

            if (this.isSamePixel(x, y, x, (y + 1)) || this.isSamePixel(x, y, x, (y - 1)))
                return this.isEmptyPixel((x - 1), y)
                    ? "left"
                    : "right";

            if (this.isSamePixel(x, y, (x - 1), y) || this.isSamePixel(x, y, (x + 1), y))
                return this.isEmptyPixel(x, (y + 1))
                    ? "top"
                    : "bottom";

            // Empty pixel.

            if (this.isEmptyPixel(x, (y + 1)))
                return "top";

            if (this.isEmptyPixel(x, (y - 1)))
                return "bottom";

            if (this.isEmptyPixel((x - 1), y))
                return "left";

            if (this.isEmptyPixel((x + 1), y))
                return "right";

            return null;
        },
    };
}
