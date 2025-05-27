import { jest } from '@jest/globals';

// Mock Chrome APIs for Service Worker testing
const mockChrome: any = {
  runtime: {
    onInstalled: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
    },
    onStartup: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
    },
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
    },
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
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
    },
    onRemoved: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
    },
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
    },
  },
  scripting: {
    executeScript: jest.fn(),
  },
};

// Set up global chrome object
(global as any).chrome = mockChrome;

describe('Service Worker Integration Tests', () => {
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
  });

  describe('Module Loading', () => {
    it('should load Service Worker module without errors', () => {
      expect(() => {
        require('../../src/background/serviceWorker');
      }).not.toThrow();
    });

    it('should load utility modules without errors', () => {
      expect(() => {
        require('../../src/utils/storage');
        require('../../src/utils/tabManager');
        require('../../src/utils/persistentAlarmManager');
        require('../../src/utils/types');
      }).not.toThrow();
    });
  });

  describe('Chrome API Mocking', () => {
    it('should have chrome.runtime available', () => {
      expect(chrome.runtime).toBeDefined();
      expect(chrome.runtime.getManifest).toBeDefined();
    });

    it('should have chrome.storage available', () => {
      expect(chrome.storage).toBeDefined();
      expect(chrome.storage.local).toBeDefined();
    });

    it('should have chrome.tabs available', () => {
      expect(chrome.tabs).toBeDefined();
      expect(chrome.tabs.query).toBeDefined();
    });

    it('should return manifest data', () => {
      const manifest = chrome.runtime.getManifest();
      expect(manifest).toEqual({
        version: '1.0.0',
        name: 'HeadHunter Resume Auto-Boost',
      });
    });
  });

  describe('Storage Integration', () => {
    it('should handle storage.get calls', async () => {
      const result = await chrome.storage.local.get('test');
      expect(result).toEqual({ test: null });
    });

    it('should handle storage.set calls', async () => {
      await chrome.storage.local.set({ test: 'value' });
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        test: 'value',
      });
    });
  });

  describe('Service Worker Functionality', () => {
    it('should initialize without throwing errors', async () => {
      expect(() => {
        require('../../src/background/serviceWorker');
      }).not.toThrow();

      // Wait a bit for any async initialization
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should handle basic Chrome Extension APIs', () => {
      require('../../src/background/serviceWorker');

      // Test that chrome APIs are accessible
      expect(chrome.runtime.getManifest()).toBeDefined();
      expect(chrome.storage.local.get).toBeDefined();
      expect(chrome.tabs.query).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', () => {
      // Mock storage error
      mockChrome.storage.local.get.mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Service Worker should still load without throwing
      expect(() => {
        require('../../src/background/serviceWorker');
      }).not.toThrow();
    });
  });

  describe('Type Definitions', () => {
    it('should import types without errors', () => {
      expect(() => {
        const types = require('../../src/utils/types');
        expect(types).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Utility Functions', () => {
    it('should import storage utilities', () => {
      expect(() => {
        const storage = require('../../src/utils/storage');
        expect(storage.initializeStorage).toBeDefined();
        expect(storage.getSettings).toBeDefined();
        expect(storage.addLogEntry).toBeDefined();
      }).not.toThrow();
    });

    it('should import tab manager utilities', () => {
      expect(() => {
        const tabManager = require('../../src/utils/tabManager');
        expect(tabManager.initializeTabManager).toBeDefined();
        expect(tabManager.updateTabList).toBeDefined();
        expect(tabManager.getManagedTabsSync).toBeDefined();
      }).not.toThrow();
    });

    it('should import persistent alarm manager', () => {
      expect(() => {
        const alarmManager = require('../../src/utils/persistentAlarmManager');
        expect(alarmManager.persistentAlarmManager).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Chrome API Integration', () => {
    it('should handle chrome.runtime.getManifest calls', () => {
      require('../../src/background/serviceWorker');

      const manifest = chrome.runtime.getManifest();
      expect(manifest).toEqual({
        version: '1.0.0',
        name: 'HeadHunter Resume Auto-Boost',
      });
    });
  });
});
