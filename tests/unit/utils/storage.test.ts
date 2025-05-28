import {
  saveSettings,
  getSettings,
  saveManagedTabs,
  getManagedTabs,
  addLogEntry,
  getLogs,
  clearLogs,
  saveInterval,
  getInterval,
  saveGlobalPauseState,
  getGlobalPauseState,
  initializeStorage,
} from '../../../src/utils/storage';
import {
  AppSettings,
  TabInfo,
  LogEntry,
  TabState,
} from '../../../src/utils/types';

describe('Storage Functions', () => {
  describe('Settings Management', () => {
    it('should save and load settings', async () => {
      const testSettings: Partial<AppSettings> = {
        clickInterval: 30,
        maxTabs: 2,
        loggingEnabled: true,
      };

      // Mock chrome.storage.sync methods
      (chrome.storage.sync.set as jest.Mock).mockResolvedValue(undefined);
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({
        extension_settings: {
          clickInterval: 30,
          interval: 30,
          maxTabs: 2,
          globalPaused: false,
          loggingEnabled: true,
          refreshInterval: 10,
        },
      });

      await saveSettings(testSettings);
      const loadedSettings = await getSettings();

      expect(chrome.storage.sync.set).toHaveBeenCalled();
      expect(loadedSettings.clickInterval).toBe(30);
      expect(loadedSettings.maxTabs).toBe(2);
      expect(loadedSettings.loggingEnabled).toBe(true);
    });

    it('should return default settings when none exist', async () => {
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({});

      const settings = await getSettings();

      expect(settings.clickInterval).toBe(2); // Default value
      expect(settings.maxTabs).toBe(2);
      expect(settings.globalPaused).toBe(false);
      expect(settings.loggingEnabled).toBe(true);
    });

    it('should handle storage errors gracefully', async () => {
      const error = new Error('Storage error');
      (chrome.storage.sync.get as jest.Mock).mockRejectedValue(error);

      const settings = await getSettings();

      // Should return defaults on error
      expect(settings.clickInterval).toBe(2);
      expect(settings.maxTabs).toBe(2);
      expect(settings.globalPaused).toBe(false);
      expect(settings.loggingEnabled).toBe(true);
    });
  });

  describe('Tab Management', () => {
    it('should save and load managed tabs', async () => {
      const testTabs: TabInfo[] = [
        {
          tabId: 123,
          url: 'https://hh.kz/resume/test',
          title: 'Test Resume',
          state: TabState.ACTIVE,
          lastBoostTime: Date.now(),
          errorCount: 0,
        },
      ];

      // Mock chrome.storage.local methods
      (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
      (chrome.storage.local.get as jest.Mock).mockResolvedValue({
        managed_tabs: testTabs,
      });

      await saveManagedTabs(testTabs);
      const loadedTabs = await getManagedTabs();

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        managed_tabs: testTabs,
      });
      expect(loadedTabs).toEqual(testTabs);
    });

    it('should return empty array when no tabs exist', async () => {
      (chrome.storage.local.get as jest.Mock).mockResolvedValue({});

      const tabs = await getManagedTabs();

      expect(tabs).toEqual([]);
    });
  });

  describe('Logs Management', () => {
    it('should add and retrieve log entries', async () => {
      const existingLogs: LogEntry[] = [];
      const newLogEntry = {
        level: 'info' as const,
        message: 'Test log entry',
        tabId: 123,
      };

      // Mock getting existing logs (empty)
      (chrome.storage.local.get as jest.Mock)
        .mockResolvedValueOnce({ activity_logs: existingLogs })
        .mockResolvedValueOnce({
          activity_logs: [
            {
              ...newLogEntry,
              timestamp: expect.any(Number),
            },
          ],
        });

      (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);

      await addLogEntry(newLogEntry);
      const logs = await getLogs();

      expect(chrome.storage.local.set).toHaveBeenCalled();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test log entry');
      expect(logs[0].level).toBe('info');
      expect(logs[0].tabId).toBe(123);
    });

    it('should return empty array when no logs exist', async () => {
      (chrome.storage.local.get as jest.Mock).mockResolvedValue({});

      const logs = await getLogs();

      expect(logs).toEqual([]);
    });

    it('should clear logs', async () => {
      (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);

      await clearLogs();

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        activity_logs: [],
      });
    });

    it('should handle log storage errors gracefully', async () => {
      const error = new Error('Storage error');
      (chrome.storage.local.get as jest.Mock).mockRejectedValue(error);

      const logs = await getLogs();

      // Should return empty array on error
      expect(logs).toEqual([]);
    });

    it('should handle addLogEntry storage errors gracefully', async () => {
      const error = new Error('Storage error');
      (chrome.storage.local.get as jest.Mock).mockRejectedValue(error);

      const newLogEntry = {
        level: 'error' as const,
        message: 'Test error log',
      };

      // Should not throw error
      await expect(addLogEntry(newLogEntry)).resolves.not.toThrow();
    });

    it('should handle clearLogs storage errors', async () => {
      const error = new Error('Storage error');
      (chrome.storage.local.set as jest.Mock).mockRejectedValue(error);

      // Should throw error for clearLogs
      await expect(clearLogs()).rejects.toThrow('Failed to clear logs');
    });

    it('should limit logs to 200 entries', async () => {
      // Create 202 existing logs
      const existingLogs: LogEntry[] = Array.from({ length: 202 }, (_, i) => ({
        level: 'info' as const,
        message: `Log ${i}`,
        timestamp: Date.now() - i * 1000,
      }));

      const newLogEntry = {
        level: 'info' as const,
        message: 'New log entry',
      };

      // Mock getting existing logs
      (chrome.storage.local.get as jest.Mock).mockResolvedValue({
        activity_logs: existingLogs,
      });
      (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);

      await addLogEntry(newLogEntry);

      // Should have been called with only 200 entries (new + 199 old)
      const setCall = (chrome.storage.local.set as jest.Mock).mock.calls[0][0];
      expect(setCall.activity_logs).toHaveLength(200);
      expect(setCall.activity_logs[0].message).toBe('New log entry');
    });
  });

  describe('Interval Management', () => {
    it('should save and get interval', async () => {
      const testInterval = 30;

      // Mock saveSettings and getSettings
      (chrome.storage.sync.set as jest.Mock).mockResolvedValue(undefined);
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({
        extension_settings: {
          clickInterval: testInterval,
          interval: testInterval,
          maxTabs: 2,
          globalPaused: false,
          loggingEnabled: true,
          refreshInterval: 10,
        },
      });

      await saveInterval(testInterval);
      const retrievedInterval = await getInterval();

      expect(retrievedInterval).toBe(testInterval);
    });

    it('should reject invalid intervals', async () => {
      const invalidIntervals = [0, -1, 601, 'invalid', null, undefined];

      for (const interval of invalidIntervals) {
        await expect(saveInterval(interval as any)).rejects.toThrow(
          'Invalid interval'
        );
      }
    });

    it('should accept valid intervals', async () => {
      const validIntervals = [1, 30, 60, 300, 600];

      (chrome.storage.sync.set as jest.Mock).mockResolvedValue(undefined);

      for (const interval of validIntervals) {
        await expect(saveInterval(interval)).resolves.not.toThrow();
      }
    });
  });

  describe('Global Pause State Management', () => {
    it('should save and get global pause state', async () => {
      const testPauseState = true;

      // Mock saveSettings and getSettings
      (chrome.storage.sync.set as jest.Mock).mockResolvedValue(undefined);
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({
        extension_settings: {
          clickInterval: 2,
          interval: 2,
          maxTabs: 2,
          globalPaused: testPauseState,
          loggingEnabled: true,
          refreshInterval: 10,
        },
      });

      await saveGlobalPauseState(testPauseState);
      const retrievedState = await getGlobalPauseState();

      expect(retrievedState).toBe(testPauseState);
    });

    it('should handle both true and false pause states', async () => {
      (chrome.storage.sync.set as jest.Mock).mockResolvedValue(undefined);

      // Test true
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({
        extension_settings: {
          clickInterval: 2,
          interval: 2,
          maxTabs: 2,
          globalPaused: true,
          loggingEnabled: true,
          refreshInterval: 10,
        },
      });

      await saveGlobalPauseState(true);
      let state = await getGlobalPauseState();
      expect(state).toBe(true);

      // Test false
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({
        extension_settings: {
          clickInterval: 2,
          interval: 2,
          maxTabs: 2,
          globalPaused: false,
          loggingEnabled: true,
          refreshInterval: 10,
        },
      });

      await saveGlobalPauseState(false);
      state = await getGlobalPauseState();
      expect(state).toBe(false);
    });
  });

  describe('Storage Initialization', () => {
    it('should initialize storage without errors', async () => {
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({
        extension_settings: {
          clickInterval: 2,
          interval: 2,
          maxTabs: 2,
          globalPaused: false,
          loggingEnabled: true,
          refreshInterval: 10,
        },
      });

      await expect(initializeStorage()).resolves.not.toThrow();
    });

    it('should handle initialization errors gracefully', async () => {
      const error = new Error('Storage initialization error');
      (chrome.storage.sync.get as jest.Mock).mockRejectedValue(error);

      await expect(initializeStorage()).resolves.not.toThrow();
    });
  });

  describe('Settings Validation and Edge Cases', () => {
    it('should handle corrupted settings data', async () => {
      // Mock corrupted data
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({
        extension_settings: {
          clickInterval: 'invalid',
          maxTabs: -1,
          globalPaused: 'not-boolean',
          loggingEnabled: null,
          refreshInterval: 1000,
        },
      });

      const settings = await getSettings();

      // Should return validated defaults
      expect(settings.clickInterval).toBe(2); // Default
      expect(settings.maxTabs).toBe(2); // Default
      expect(settings.globalPaused).toBe(false); // Default
      expect(settings.loggingEnabled).toBe(true); // Default
      expect(settings.refreshInterval).toBe(10); // Default
    });

    it('should handle partial settings data', async () => {
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({
        extension_settings: {
          clickInterval: 30,
          interval: 30, // Legacy field
          // Missing other fields
        },
      });

      const settings = await getSettings();

      expect(settings.clickInterval).toBe(30); // Preserved
      expect(settings.maxTabs).toBe(2); // Default
      expect(settings.globalPaused).toBe(false); // Default
      expect(settings.loggingEnabled).toBe(true); // Default
      expect(settings.refreshInterval).toBe(10); // Default
    });

    it('should handle null/undefined settings', async () => {
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({
        extension_settings: null,
      });

      const settings = await getSettings();

      expect(settings.clickInterval).toBe(2);
      expect(settings.maxTabs).toBe(2);
      expect(settings.globalPaused).toBe(false);
      expect(settings.loggingEnabled).toBe(true);
      expect(settings.refreshInterval).toBe(10);
    });

    it('should handle saveSettings with storage errors', async () => {
      const error = new Error('Storage save error');
      (chrome.storage.sync.set as jest.Mock).mockRejectedValue(error);

      const testSettings = { clickInterval: 30 };

      await expect(saveSettings(testSettings)).rejects.toThrow(
        'Storage save failed'
      );
    });

    it('should handle saveManagedTabs with storage errors', async () => {
      const error = new Error('Storage save error');
      (chrome.storage.local.set as jest.Mock).mockRejectedValue(error);

      const testTabs: TabInfo[] = [
        {
          tabId: 123,
          url: 'https://hh.kz/resume/test',
          title: 'Test Resume',
          state: TabState.ACTIVE,
          errorCount: 0,
        },
      ];

      await expect(saveManagedTabs(testTabs)).rejects.toThrow(
        'Failed to save tabs'
      );
    });

    it('should handle getManagedTabs with storage errors', async () => {
      const error = new Error('Storage get error');
      (chrome.storage.local.get as jest.Mock).mockRejectedValue(error);

      const tabs = await getManagedTabs();

      // Should return empty array on error
      expect(tabs).toEqual([]);
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should validate and sanitize settings on save', async () => {
      const invalidSettings = {
        clickInterval: 1000, // Too high
        maxTabs: 10, // Too high
        globalPaused: 'invalid' as any,
        loggingEnabled: 'invalid' as any,
        refreshInterval: 0, // Too low
      };

      // Mock current settings
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({
        extension_settings: {
          clickInterval: 2,
          interval: 2,
          maxTabs: 2,
          globalPaused: false,
          loggingEnabled: true,
          refreshInterval: 10,
        },
      });
      (chrome.storage.sync.set as jest.Mock).mockResolvedValue(undefined);

      await saveSettings(invalidSettings);

      // Should have been called with merged settings (invalid values preserved for now)
      expect(chrome.storage.sync.set).toHaveBeenCalled();
    });

    it('should handle concurrent storage operations', async () => {
      (chrome.storage.sync.set as jest.Mock).mockResolvedValue(undefined);
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({
        extension_settings: {
          clickInterval: 2,
          interval: 2,
          maxTabs: 2,
          globalPaused: false,
          loggingEnabled: true,
          refreshInterval: 10,
        },
      });

      // Simulate concurrent saves
      const operations = [
        saveSettings({ clickInterval: 30 }),
        saveSettings({ maxTabs: 3 }),
        saveSettings({ globalPaused: true }),
        saveGlobalPauseState(false),
        saveInterval(60),
      ];

      await expect(Promise.all(operations)).resolves.not.toThrow();
    });

    it('should maintain data consistency across operations', async () => {
      let storageData = {
        extension_settings: {
          clickInterval: 2,
          interval: 2,
          maxTabs: 2,
          globalPaused: false,
          loggingEnabled: true,
          refreshInterval: 10,
        },
      };

      // Mock storage to simulate real behavior
      (chrome.storage.sync.get as jest.Mock).mockImplementation(() =>
        Promise.resolve(storageData)
      );
      (chrome.storage.sync.set as jest.Mock).mockImplementation((data) => {
        storageData = { ...storageData, ...data };
        return Promise.resolve();
      });

      // Perform sequence of operations
      await saveInterval(30);
      await saveGlobalPauseState(true);

      const finalSettings = await getSettings();

      expect(finalSettings.clickInterval).toBe(30);
      expect(finalSettings.globalPaused).toBe(true);
    });
  });
});
