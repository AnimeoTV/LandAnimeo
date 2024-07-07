
export async function fetchImageData(source: string): Promise<ImageData> {
    const image     = await fetchImage(source);
    const canvas    = document.createElement("canvas");
    const context   = canvas.getContext("2d")!;

    canvas.width    = image.width;
    canvas.height   = image.height;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);

    return context.getImageData(0, 0, image.width, image.height);
}

export function fetchImage(source: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.src = source;

        image.onload = () => {
            resolve(image);
        };

        image.onerror = reject;
    });
}


export type AssetsLoaderOptions = {
    sprites : Record<string, string>;
    sounds  : Record<string, string>;
};

export type AssetsLoader<T extends AssetsLoaderOptions> = {
    sprites: {
        [key in keyof T["sprites"]]: ImageData;
    },

    sounds: {
        [key in keyof T["sounds"]]: AudioBuffer;
    },
};

export function createAssetsLoader<T extends AssetsLoaderOptions>(assets: T): { load(): Promise<AssetsLoader<T>> } {
    return {
        async load() {
            // const sprites   = [...Object.entries(assets.sprites)]
            // const sounds    = [...Object.entries(assets.sounds)];

            // const promiseSounds = sounds.map(([ k, v ]) => {
            //     return loadAudio()
            // });

            // const spritesMap = sprites.map(([ k, v ]) => {
            //     return [ k, {} as ArrayBuffer ];
            // });

            // return {
            //     sprites : Object.fromEntries(spritesMap),
            //     sounds  : Object.fromEntries(soundsMap),
            // };
            return {} as any;
        },
    };
}
