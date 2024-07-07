
export type Side = "left" | "right" | "top" | "bottom";

export type Block = {
    x           : number;
    y           : number;
    r           : number;
    g           : number;
    b           : number;
    a           : number;
    facingSide  : Side | null;
};

export type Square = {
    x       : number;
    y       : number;
    width   : number;
    height  : number;
};

export function detectOverlap(square1: Square, square2: Square): boolean {
    if ((square1.x + square1.width) >= square2.x && square1.x <= (square2.x + square2.width))
        if ((square1.y + square1.height) >= square2.y && square1.y <= (square2.y + square2.height))
            return true;

    return false;
}

export function detectCollision(square1: Square, square2: Square): Side[] {
    const sides: Side[] = [];

    if (detectOverlap(square1, square2)) {
        if ((square1.x + square1.width) >= square2.x && square1.x <= square2.x)
            sides.push("right");

        if (square1.x <= (square2.x + square2.width) && (square1.x + square1.width) >= (square2.x + square2.width))
            sides.push("left");

        if ((square1.y + square1.height) >= square2.y && square1.y <= square2.y)
            sides.push("bottom");

        if (square1.y <= (square2.y + square2.height) && (square1.y + square1.height) >= (square2.y + square2.height))
            sides.push("top");
    }

    return sides;
}
