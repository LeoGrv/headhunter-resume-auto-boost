import {
  saveSettings,
  getSettings,
  saveManagedTabs,
  getManagedTabs,
  addLogEntry,
  getLogs,
  clearLogs,
} from '../../src/utils/storage';
import {
  AppSettings,
  TabInfo,
  LogEntry,
  TabState,
} from '../../src/utils/types';

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
  });
});
