import { expect, test } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';

function defaultConfig() {
  return {
    version: 2,
    imageFolder: '/tmp/images',
    includeSubdirectories: true,
    changeInterval: 10000,
    pattern: 'simple',
    patternOptions: {},
    multiMonitorSync: false,
    transition: {
      effect: 'fade',
      duration: 1000,
    },
    theme: 'light',
    imageFitStyle: 'cover',
  };
}

function distFileUrl(...parts: string[]): string {
  return pathToFileURL(path.join(process.cwd(), 'dist', ...parts)).toString();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((config, pixel) => {
    const key = '__e2e_saved_config__';

    if (!window.localStorage.getItem(key)) {
      window.localStorage.setItem(key, JSON.stringify(config));
    }

    const readConfig = () => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : config;
    };

    const writeConfig = (nextConfig: unknown) => {
      window.localStorage.setItem(key, JSON.stringify(nextConfig));
    };

    (window as any).electronAPI = {
      closeScreensaver: () => {},
      getImages: async () => [pixel, pixel, pixel, pixel, pixel, pixel],
      getConfig: async () => readConfig(),
      browseDirectory: async () => '/tmp/images',
      validateDirectory: async (directory: string) => Boolean(directory),
      getPreviewImages: async () => ({ allImages: [pixel, pixel, pixel], totalCount: 3 }),
      applyConfig: async (nextConfig: unknown) => {
        writeConfig(nextConfig);
      },
      saveConfig: async (nextConfig: unknown) => {
        writeConfig(nextConfig);
      },
      closeConfigWindow: () => {},
      getLogPath: async () => '/tmp/image-tile.log',
    };
  }, defaultConfig(), transparentPixel);
});

test('config dialog save is consumed by renderer', async ({ page }) => {
  await page.goto(distFileUrl('configui', 'screensaver-settings.html'));

  await page.click('.pattern-option[data-pattern="random"]');
  await page.fill('#change-interval', '3');
  await page.fill('#random-count', '5');
  await page.click('#save-button');

  await page.goto(distFileUrl('index.html') + '?displayId=0&displayCount=1');

  await expect(page.locator('#image-container img')).toHaveCount(5);
});
