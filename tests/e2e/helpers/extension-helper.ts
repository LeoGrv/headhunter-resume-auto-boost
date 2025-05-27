import { Browser, Page } from 'puppeteer';
import path from 'path';

export class ExtensionHelper {
  private browser: Browser;
  private extensionId: string | null = null;

  constructor(browser: Browser) {
    this.browser = browser;
  }

  /**
   * Get the extension ID from loaded extensions
   */
  async getExtensionId(): Promise<string> {
    if (this.extensionId) {
      return this.extensionId;
    }

    const targets = await this.browser.targets();
    const extensionTarget = targets.find(
      target =>
        target.type() === 'background_page' ||
        target.type() === 'service_worker'
    );

    if (!extensionTarget) {
      throw new Error('Extension not found. Make sure it is loaded.');
    }

    this.extensionId = extensionTarget.url().split('/')[2];
    return this.extensionId;
  }

  /**
   * Open extension popup in a new page
   */
  async openPopup(): Promise<Page> {
    const extensionId = await this.getExtensionId();
    const popupPage = await this.browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for popup to load
    return popupPage;
  }

  /**
   * Get the background/service worker page
   */
  async getBackgroundPage(): Promise<Page> {
    const targets = await this.browser.targets();
    const backgroundTarget = targets.find(
      target =>
        target.type() === 'background_page' ||
        target.type() === 'service_worker'
    );

    if (!backgroundTarget) {
      throw new Error('Background page not found');
    }

    return (await backgroundTarget.page()) || (await this.browser.newPage());
  }

  /**
   * Create a mock HeadHunter resume page
   */
  async createMockResumePage(
    page: Page,
    options: {
      hasBoostButton?: boolean;
      buttonText?: string;
      isActive?: boolean;
    } = {}
  ): Promise<void> {
    const {
      hasBoostButton = true,
      buttonText = 'Поднять в поиске',
      isActive = true,
    } = options;

    const buttonHtml = hasBoostButton
      ? `
      <button 
        class="bloko-button bloko-button_kind-primary" 
        data-qa="resume-update-button"
        ${!isActive ? 'disabled' : ''}
      >
        ${buttonText}
      </button>
    `
      : '';

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
              ${buttonHtml}
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
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://hh.kz/resume/test-resume-id',
          hostname: 'hh.kz',
          pathname: '/resume/test-resume-id',
        },
        writable: true,
      });
    });
  }

  /**
   * Wait for extension to be ready
   */
  async waitForExtensionReady(timeout: number = 5000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        await this.getExtensionId();
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    throw new Error('Extension did not become ready within timeout');
  }

  /**
   * Inject content script manually (for testing)
   */
  async injectContentScript(page: Page): Promise<void> {
    const contentScriptPath = path.join(
      __dirname,
      '../../../dist/content/contentScript.js'
    );
    await page.addScriptTag({ path: contentScriptPath });
  }

  /**
   * Check if extension is loaded
   */
  async isExtensionLoaded(): Promise<boolean> {
    try {
      await this.getExtensionId();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get extension manifest
   */
  async getManifest(): Promise<any> {
    const extensionId = await this.getExtensionId();
    const manifestPage = await this.browser.newPage();

    try {
      await manifestPage.goto(
        `chrome-extension://${extensionId}/manifest.json`
      );
      const manifestText = await manifestPage.evaluate(
        () => document.body.textContent
      );
      return JSON.parse(manifestText || '{}');
    } finally {
      await manifestPage.close();
    }
  }
}
