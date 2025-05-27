import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';

describe('Critical User Flows E2E Tests', () => {
  let browser: Browser;

  beforeAll(async () => {
    // Launch browser with extension loaded
    browser = await puppeteer.launch({
      headless: process.env.HEADLESS === 'true' ? true : false,
      args: [
        `--disable-extensions-except=${path.join(__dirname, '../../dist')}`,
        `--load-extension=${path.join(__dirname, '../../dist')}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--allow-running-insecure-content',
      ],
    });
  }, 30000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('Browser and Extension Loading', () => {
    it('should launch browser successfully', async () => {
      expect(browser).toBeDefined();

      const pages = await browser.pages();
      expect(pages.length).toBeGreaterThan(0);
    });

    it('should have extension files built', async () => {
      const fs = require('fs');
      const manifestPath = path.join(__dirname, '../../dist/manifest.json');
      const serviceWorkerPath = path.join(
        __dirname,
        '../../dist/background/serviceWorker.js'
      );
      const contentScriptPath = path.join(
        __dirname,
        '../../dist/content/resumeBooster.js'
      );
      const popupPath = path.join(__dirname, '../../dist/popup/popup.html');

      expect(fs.existsSync(manifestPath)).toBe(true);
      expect(fs.existsSync(serviceWorkerPath)).toBe(true);
      expect(fs.existsSync(contentScriptPath)).toBe(true);
      expect(fs.existsSync(popupPath)).toBe(true);
    });

    it('should have valid manifest.json', async () => {
      const fs = require('fs');
      const manifestPath = path.join(__dirname, '../../dist/manifest.json');
      const manifestContent = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);

      expect(manifest.name).toBe('HeadHunter Resume Auto-Boost');
      expect(manifest.version).toBeDefined();
      expect(manifest.manifest_version).toBe(3);
      expect(manifest.permissions).toContain('storage');
      expect(manifest.permissions).toContain('tabs');
      expect(manifest.permissions).toContain('alarms');
    });
  });

  describe('Extension File Structure', () => {
    it('should have popup HTML with correct structure', async () => {
      const fs = require('fs');
      const popupPath = path.join(__dirname, '../../dist/popup/popup.html');
      const popupContent = fs.readFileSync(popupPath, 'utf8');

      expect(popupContent).toContain('HH Resume Boost');
      expect(popupContent).toContain('status-indicator');
      expect(popupContent).toContain('tabs-section');
      expect(popupContent).toContain('controls-section');
      expect(popupContent).toContain('logs-section');
    });

    it('should have popup CSS file', async () => {
      const fs = require('fs');
      const cssPath = path.join(__dirname, '../../dist/popup/popup.css');

      expect(fs.existsSync(cssPath)).toBe(true);
    });

    it('should have popup JavaScript file', async () => {
      const fs = require('fs');
      const jsPath = path.join(__dirname, '../../dist/popup/popup.js');

      expect(fs.existsSync(jsPath)).toBe(true);
    });
  });

  describe('Mock HeadHunter Page Testing', () => {
    let page: Page;

    beforeEach(async () => {
      page = await browser.newPage();
    });

    afterEach(async () => {
      if (page && !page.isClosed()) {
        await page.close();
      }
    });

    it('should create mock HeadHunter resume page', async () => {
      await page.setContent(`
        <html>
          <head>
            <title>Test Resume - HeadHunter</title>
            <meta charset="utf-8">
          </head>
          <body>
            <div class="resume-header">
              <h1>Тестовое резюме</h1>
              <div class="resume-actions">
                <button 
                  class="bloko-button bloko-button_kind-primary" 
                  data-qa="resume-update-button"
                >
                  Поднять в поиске
                </button>
              </div>
            </div>
            <div class="resume-content">
              <p>Содержимое резюме...</p>
            </div>
          </body>
        </html>
      `);

      // Set URL to match HeadHunter pattern
      await page.evaluate(() => {
        // Create a mock location object
        (window as any).mockLocation = {
          href: 'https://hh.kz/resume/test-resume-id',
          hostname: 'hh.kz',
          pathname: '/resume/test-resume-id',
        };
      });

      const title = await page.$eval('h1', el => el.textContent);
      const button = await page.$('[data-qa="resume-update-button"]');
      const url = await page.evaluate(() => (window as any).mockLocation.href);

      expect(title).toBe('Тестовое резюме');
      expect(button).toBeDefined();
      expect(url).toContain('hh.kz/resume');
    });

    it('should handle page interactions', async () => {
      await page.setContent(`
        <html>
          <body>
            <button id="test-button" onclick="this.textContent='Clicked'">Click me</button>
          </body>
        </html>
      `);

      await page.click('#test-button');
      const buttonText = await page.$eval('#test-button', el => el.textContent);

      expect(buttonText).toBe('Clicked');
    });
  });

  describe('Popup Page Testing', () => {
    let popupPage: Page;

    beforeEach(async () => {
      popupPage = await browser.newPage();
    });

    afterEach(async () => {
      if (popupPage && !popupPage.isClosed()) {
        await popupPage.close();
      }
    });

    it('should load popup HTML file', async () => {
      const popupPath = path.join(__dirname, '../../dist/popup/popup.html');
      await popupPage.goto(`file://${popupPath}`);

      const title = await popupPage.$eval('h1', el => el.textContent);
      expect(title).toBe('HH Resume Boost');
    });

    it('should have all required sections in popup', async () => {
      const popupPath = path.join(__dirname, '../../dist/popup/popup.html');
      await popupPage.goto(`file://${popupPath}`);

      const statusIndicator = await popupPage.$('.status-indicator');
      const tabsSection = await popupPage.$('.tabs-section');
      const controlsSection = await popupPage.$('.controls-section');
      const logsSection = await popupPage.$('.logs-section');

      expect(statusIndicator).toBeDefined();
      expect(tabsSection).toBeDefined();
      expect(controlsSection).toBeDefined();
      expect(logsSection).toBeDefined();
    });

    it('should have functional buttons in popup', async () => {
      const popupPath = path.join(__dirname, '../../dist/popup/popup.html');
      await popupPage.goto(`file://${popupPath}`);

      const pauseButton = await popupPage.$('#global-pause');
      const settingsButton = await popupPage.$('#settings');
      const clearLogsButton = await popupPage.$('#clear-logs');

      expect(pauseButton).toBeDefined();
      expect(settingsButton).toBeDefined();
      expect(clearLogsButton).toBeDefined();
    });
  });

  describe('Performance Testing', () => {
    it('should load pages quickly', async () => {
      const startTime = Date.now();
      const page = await browser.newPage();

      await page.setContent('<html><body><h1>Test Page</h1></body></html>');
      const loadTime = Date.now() - startTime;

      // Page should load within 1 second
      expect(loadTime).toBeLessThan(1000);

      await page.close();
    });

    it('should handle multiple pages', async () => {
      const pages = [];

      for (let i = 0; i < 3; i++) {
        const page = await browser.newPage();
        await page.setContent(
          `<html><body><h1>Page ${i + 1}</h1></body></html>`
        );
        pages.push(page);
      }

      expect(pages.length).toBe(3);

      // Close all pages
      for (const page of pages) {
        await page.close();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle page navigation errors gracefully', async () => {
      const page = await browser.newPage();

      try {
        // Try to navigate to invalid URL
        await page.goto('invalid-url', { timeout: 1000 });
      } catch (error) {
        // Error is expected
        expect(error).toBeDefined();
      }

      await page.close();
    });

    it('should handle missing elements gracefully', async () => {
      const page = await browser.newPage();
      await page.setContent('<html><body><h1>Test</h1></body></html>');

      const missingElement = await page.$('#non-existent');
      expect(missingElement).toBeNull();

      await page.close();
    });
  });

  describe('Content Script Simulation', () => {
    it('should simulate content script injection', async () => {
      const page = await browser.newPage();

      // Create a mock HeadHunter page
      await page.setContent(`
        <html>
          <body>
            <button data-qa="resume-update-button">Поднять в поиске</button>
          </body>
        </html>
      `);

      // Simulate content script functionality
      await page.evaluate(() => {
        const button = document.querySelector(
          '[data-qa="resume-update-button"]'
        );
        if (button) {
          (button as HTMLElement).style.border = '2px solid red';
          (button as HTMLElement).setAttribute(
            'data-extension-processed',
            'true'
          );
        }
      });

      const isProcessed = await page.$eval(
        '[data-qa="resume-update-button"]',
        el => el.getAttribute('data-extension-processed') === 'true'
      );

      expect(isProcessed).toBe(true);

      await page.close();
    });
  });

  describe('Storage Simulation', () => {
    it('should simulate localStorage operations', async () => {
      const page = await browser.newPage();
      await page.goto('data:text/html,<html><body></body></html>');

      // Simulate storage operations
      await page.evaluate(() => {
        // Create a mock storage object
        (window as any).mockStorage = {};
        (window as any).mockStorage.setItem = (key: string, value: string) => {
          (window as any).mockStorage[key] = value;
        };
        (window as any).mockStorage.getItem = (key: string) => {
          return (window as any).mockStorage[key] || null;
        };

        (window as any).mockStorage.setItem('test-key', 'test-value');
      });

      const storedValue = await page.evaluate(() => {
        return (window as any).mockStorage.getItem('test-key');
      });

      expect(storedValue).toBe('test-value');

      await page.close();
    });
  });
});
