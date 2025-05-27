import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Mock Chrome APIs for popup testing
const mockChrome: any = {
  runtime: {
    sendMessage: jest.fn(),
    getManifest: jest.fn(() => ({
      version: '1.0.0',
      name: 'HeadHunter Resume Auto-Boost',
    })),
    id: 'test-extension-id',
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn(),
    get: jest.fn(),
  },
};

// Set up global chrome object
(global as any).chrome = mockChrome;

// Mock DOM environment
const { JSDOM } = require('jsdom');

describe('Popup UI Snapshot Tests', () => {
  let dom: any;
  let document: Document;
  let window: Window;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock successful storage operations
    mockChrome.storage.local.get.mockImplementation(
      (keys: any, callback: any) => {
        const result = Array.isArray(keys)
          ? keys.reduce((acc: any, key: any) => ({ ...acc, [key]: null }), {})
          : { [keys]: null };
        if (callback) callback(result);
        return Promise.resolve(result);
      }
    );

    mockChrome.storage.local.set.mockImplementation(
      (items: any, callback: any) => {
        if (callback) callback();
        return Promise.resolve();
      }
    );

    // Read the actual popup HTML
    const popupHtmlPath = path.join(__dirname, '../../../src/popup/popup.html');
    const popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');

    // Create JSDOM instance
    dom = new JSDOM(popupHtml, {
      url: 'chrome-extension://test/popup.html',
      pretendToBeVisual: true,
      resources: 'usable',
    });

    document = dom.window.document;
    window = dom.window;

    // Set up global DOM objects
    (global as any).document = document;
    (global as any).window = window;
    (global as any).HTMLElement = (window as any).HTMLElement;
    (global as any).Element = (window as any).Element;
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
  });

  describe('Initial HTML Structure', () => {
    it('should match popup HTML snapshot', () => {
      expect(document.documentElement.outerHTML).toMatchSnapshot();
    });

    it('should have correct header structure', () => {
      const header = document.querySelector('header');
      expect(header?.outerHTML).toMatchSnapshot();
    });

    it('should have correct main content structure', () => {
      const main = document.querySelector('main');
      expect(main?.outerHTML).toMatchSnapshot();
    });

    it('should have tabs section', () => {
      const tabsSection = document.querySelector('.tabs-section');
      expect(tabsSection?.outerHTML).toMatchSnapshot();
    });

    it('should have controls section', () => {
      const controlsSection = document.querySelector('.controls-section');
      expect(controlsSection?.outerHTML).toMatchSnapshot();
    });

    it('should have logs section', () => {
      const logsSection = document.querySelector('.logs-section');
      expect(logsSection?.outerHTML).toMatchSnapshot();
    });
  });

  describe('Dynamic Content States', () => {
    it('should match snapshot with loading state', () => {
      const statusText = document.querySelector('.status-text');
      if (statusText) {
        statusText.textContent = 'Loading...';
      }

      const statusDot = document.querySelector('.status-dot');
      if (statusDot) {
        statusDot.className = 'status-dot loading';
      }

      expect(document.querySelector('header')?.outerHTML).toMatchSnapshot();
    });

    it('should match snapshot with active state', () => {
      const statusText = document.querySelector('.status-text');
      if (statusText) {
        statusText.textContent = 'Active (3 tabs)';
      }

      const statusDot = document.querySelector('.status-dot');
      if (statusDot) {
        statusDot.className = 'status-dot active';
      }

      expect(document.querySelector('header')?.outerHTML).toMatchSnapshot();
    });

    it('should match snapshot with paused state', () => {
      const statusText = document.querySelector('.status-text');
      if (statusText) {
        statusText.textContent = 'Paused';
      }

      const statusDot = document.querySelector('.status-dot');
      if (statusDot) {
        statusDot.className = 'status-dot paused';
      }

      expect(document.querySelector('header')?.outerHTML).toMatchSnapshot();
    });

    it('should match snapshot with sample tabs', () => {
      const tabsList = document.querySelector('.tabs-list');
      if (tabsList) {
        tabsList.innerHTML = `
          <div class="tab-item active">
            <div class="tab-info">
              <span class="tab-title">Senior Frontend Developer</span>
              <span class="tab-url">hh.ru/resume/123456</span>
            </div>
            <div class="tab-controls">
              <span class="timer-status">Next boost: 15:30</span>
              <button class="btn-small pause">⏸</button>
            </div>
          </div>
          <div class="tab-item paused">
            <div class="tab-info">
              <span class="tab-title">Full Stack Developer</span>
              <span class="tab-url">hh.ru/resume/789012</span>
            </div>
            <div class="tab-controls">
              <span class="timer-status">Paused</span>
              <button class="btn-small resume">▶</button>
            </div>
          </div>
        `;
      }

      expect(
        document.querySelector('.tabs-section')?.outerHTML
      ).toMatchSnapshot();
    });

    it('should match snapshot with sample logs', () => {
      const logsList = document.querySelector('.logs-list');
      if (logsList) {
        logsList.innerHTML = `
          <div class="log-entry success">
            <span class="log-time">14:25:30</span>
            <span class="log-message">Resume boosted successfully</span>
            <span class="log-tab">Tab 1</span>
          </div>
          <div class="log-entry info">
            <span class="log-time">14:20:15</span>
            <span class="log-message">Timer started for new tab</span>
            <span class="log-tab">Tab 2</span>
          </div>
          <div class="log-entry warning">
            <span class="log-time">14:15:45</span>
            <span class="log-message">Boost limit reached for today</span>
            <span class="log-tab">Tab 1</span>
          </div>
        `;
      }

      expect(
        document.querySelector('.logs-section')?.outerHTML
      ).toMatchSnapshot();
    });
  });

  describe('Button States', () => {
    it('should match snapshot with pause button active', () => {
      const pauseButton = document.querySelector('#global-pause');
      if (pauseButton) {
        pauseButton.textContent = '⏸ Pause All';
        pauseButton.className = 'btn btn-secondary';
      }

      expect(pauseButton?.outerHTML).toMatchSnapshot();
    });

    it('should match snapshot with resume button active', () => {
      const pauseButton = document.querySelector('#global-pause');
      if (pauseButton) {
        pauseButton.textContent = '▶ Resume All';
        pauseButton.className = 'btn btn-primary';
      }

      expect(pauseButton?.outerHTML).toMatchSnapshot();
    });

    it('should match snapshot with settings button', () => {
      const settingsButton = document.querySelector('#settings');
      expect(settingsButton?.outerHTML).toMatchSnapshot();
    });

    it('should match snapshot with clear logs button', () => {
      const clearLogsButton = document.querySelector('#clear-logs');
      expect(clearLogsButton?.outerHTML).toMatchSnapshot();
    });
  });

  describe('Empty States', () => {
    it('should match snapshot with no tabs', () => {
      const tabsList = document.querySelector('.tabs-list');
      if (tabsList) {
        tabsList.innerHTML =
          '<div class="empty-state">No resume tabs detected</div>';
      }

      expect(
        document.querySelector('.tabs-section')?.outerHTML
      ).toMatchSnapshot();
    });

    it('should match snapshot with no logs', () => {
      const logsList = document.querySelector('.logs-list');
      if (logsList) {
        logsList.innerHTML =
          '<div class="empty-state">No recent activity</div>';
      }

      expect(
        document.querySelector('.logs-section')?.outerHTML
      ).toMatchSnapshot();
    });
  });

  describe('Error States', () => {
    it('should match snapshot with error state', () => {
      const statusText = document.querySelector('.status-text');
      if (statusText) {
        statusText.textContent = 'Error: Connection failed';
      }

      const statusDot = document.querySelector('.status-dot');
      if (statusDot) {
        statusDot.className = 'status-dot error';
      }

      expect(document.querySelector('header')?.outerHTML).toMatchSnapshot();
    });

    it('should match snapshot with tab error', () => {
      const tabsList = document.querySelector('.tabs-list');
      if (tabsList) {
        tabsList.innerHTML = `
          <div class="tab-item error">
            <div class="tab-info">
              <span class="tab-title">Resume Tab (Error)</span>
              <span class="tab-url">hh.ru/resume/error</span>
            </div>
            <div class="tab-controls">
              <span class="timer-status error">Boost failed</span>
              <button class="btn-small retry">🔄</button>
            </div>
          </div>
        `;
      }

      expect(
        document.querySelector('.tabs-section')?.outerHTML
      ).toMatchSnapshot();
    });
  });
});
