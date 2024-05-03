const map = `
xxxxx........
x...x...xxxxx
x...xxxxx...x
x...xxxxx...x
x.........xxx
x.xxxxx...x..
......xxxxx..`.trim().split("\n").map((line) => line.split(""));

type Point      = [ number, number ];
type Direction  = Point;

type ZoneMinAndMaxPoints = {
    minPoint: [ number, number ];
    maxPoint: [ number, number ];
};

const MapDirections: Direction[] = [
    [ -1,  0 ],
    [  1,  0 ],
    [  0, -1 ],
    [  0,  1 ],
];

function findPoints(startX: number, startY: number): Point[] {
    const points = [] as Point[];

    for (let x = 0; x < map.length; x++) {
        for (let y = 0; y < map[x]!.length; y++) {
            if (map[x]![y] === "x")
                continue;

            points.push([ x, y ]);
        }
    }

    return points;

    // const points    = [] as Point[];
    // const stack     = [] as [ number, number, Direction ][];
    // const visited   = new Set();

    // function findDirection(posX: number, posY: number) {
    //     points.push([ posX, posY ]);

    //     for (const direction of MapDirections) {
    //         const [ dx, dy ] = direction;
    //         const newX = posX + dx;
    //         const newY = posY + dy;

    //         if (!visited.has(`${newX}.${newY}`) && map[newX]?.[newY] === "x") {
    //             stack.push([ newX, newY, direction ]);
    //             break;
    //         }
    //     }
    // }

    // findDirection(startX, startY);

    // while (stack.length) {
    //     const [ x, y, direction ]   = stack.pop()!;
    //     const [ dx, dy ]            = direction;
    //     const newX                  = x + dx;
    //     const newY                  = y + dy;

    //     visited.add(`${x}.${y}`);

    //     if (map[newX]?.[newY] === "x") {
    //         stack.push([ newX, newY, direction ]);

    //     } else {
    //         findDirection(x, y);
    //     }
    // }

    // return points;
}

function findMinMaxPoints(points: Point[]): ZoneMinAndMaxPoints {
    if (points.length === 0)
        throw new Error("Points is empty.");

    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;

    for (const [ x, y ] of points) {
        minX = Math.min(minX, x); // Update minX if x is smaller
        minY = Math.min(minY, y); // Update minY if y is smaller
        maxX = Math.max(maxX, x); // Update maxX if x is larger
        maxY = Math.max(maxY, y); // Update maxY if y is larger
    }

    // Return an object containing the minimum and maximum points
    return {
        minPoint: [ minX, minY ],
        maxPoint: [ maxX, maxY ],
    };
}

function findBorders({ minPoint, maxPoint }: ZoneMinAndMaxPoints): Set<string> {
    const points    = [] as Point[];
    const borders   = [] as Point[];
    const visited   = new Set<string>();

    for (let x = minPoint[0]; x <= maxPoint[0]; x++) {
        if (map[x]![minPoint[1]] === ".")
            points.push([ x, minPoint[1] ]);

        if (map[x]![maxPoint[1]] === ".")
            points.push([ x, maxPoint[1] ]);
    }

    for (let y = minPoint[1] + 1; y <= maxPoint[1] - 1; y++) {
        if (map[minPoint[0]]![y] === ".")
            points.push([ minPoint[0], y ]);

        if (map[maxPoint[0]]![y] === ".")
            points.push([ maxPoint[0], y ]);
    }

    while (points.length) {
        const [ x, y ] = points.pop()!;

        borders.push([ x, y ]);

        for (const [ dx, dy ] of MapDirections) {
            const newX = x + dx;
            const newY = y + dy;

            if (newX < minPoint[0] || newX > maxPoint[0] || newY < minPoint[1] || newY > maxPoint[1])
                continue;

            if (!visited.has(`${newX}.${newY}`) && map[newX]?.[newY] === ".") {
                visited.add(`${newX}.${newY}`);
                points.push([ newX, newY ]);
            }
        }
    }

    return visited;
}

export function findClaimPoints(startX: number, startY: number): Point[] {
    const points                    = [] as Point[];
    const zone                      = findMinMaxPoints(findPoints(startX, startY));
    const borders                   = findBorders(zone);
    const { minPoint, maxPoint }    = zone;

    for (let x = minPoint[0]; x <= maxPoint[0]; x++) {
        for (let y = minPoint[1]; y <= maxPoint[1]; y++) {
            if (borders.has(`${x}.${y}`))
                continue;

            points.push([ x, y ]);
        }
    }

    return points;
}


findClaimPoints(0, 5);
