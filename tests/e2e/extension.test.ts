import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';

describe('HeadHunter Resume Auto-Boost Extension E2E', () => {
  let browser: Browser;
  let page: Page;
  const extensionPath = path.join(__dirname, '../../dist');

  beforeAll(async () => {
    // Check if extension is built
    const fs = require('fs');
    if (!fs.existsSync(extensionPath)) {
      throw new Error(
        `Extension not built. Please run 'npm run build' first. Looking for: ${extensionPath}`
      );
    }

    // Launch browser with extension loaded
    browser = await puppeteer.launch({
      headless: process.env.HEADLESS === 'true' ? true : false,
      devtools: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });

    // Get initial page
    const pages = await browser.pages();
    page = pages[0];
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('Basic Extension Tests', () => {
    it('should launch browser with extension', async () => {
      expect(browser).toBeTruthy();
      expect(page).toBeTruthy();
    });

    it('should have chrome extension APIs available', async () => {
      await page.goto('data:text/html,<html><body><h1>Test</h1></body></html>');

      const hasChrome = await page.evaluate(() => {
        return typeof chrome !== 'undefined';
      });

      expect(hasChrome).toBe(true);
    });

    it('should load extension successfully', async () => {
      // Check if extension targets exist
      const targets = await browser.targets();
      const extensionTargets = targets.filter(
        target =>
          target.type() === 'background_page' ||
          target.type() === 'service_worker' ||
          target.url().includes('chrome-extension://')
      );

      expect(extensionTargets.length).toBeGreaterThan(0);
    });
  });
});
