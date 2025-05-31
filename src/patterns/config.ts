// Configuration handling for the image tile screensaver
export interface Config {
    imageSources: string[];
    displaySettings: {
        tileSize: number;
        spacing: number;
    };
    patternPreferences: {
        patternType: string;
        randomize: boolean;
    };
}

const defaultConfig: Config = {
    imageSources: [],
    displaySettings: {
        tileSize: 100,
        spacing: 10,
    },
    patternPreferences: {
        patternType: 'grid',
        randomize: false,
    },
};

export function getConfig(): Config {
    // Load configuration from a file or use defaultConfig
    return defaultConfig;
}

export function saveConfig(config: Config): void {
    // Save the provided configuration to a file
}