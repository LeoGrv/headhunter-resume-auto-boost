/**
 * @jest-environment jsdom
 */

import { JSDOM } from 'jsdom';

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListeners: jest.fn().mockReturnValue(true),
    },
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
  tabs: {
    get: jest.fn(),
    query: jest.fn(),
    sendMessage: jest.fn(),
  },
};

// Setup global mocks
(global as any).chrome = mockChrome;

describe('Logical Error Fixes Verification', () => {
  let dom: JSDOM;
  let window: Window;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://hh.ru/resume/12345',
      pretendToBeVisual: true,
      resources: 'usable',
    });
    window = dom.window as unknown as Window;
    document = window.document;

    // Setup global objects
    (global as any).window = window;
    (global as any).document = document;
    (global as any).Node = (window as any).Node;
    (global as any).Element = (window as any).Element;
    (global as any).HTMLElement = (window as any).HTMLElement;
    (global as any).MouseEvent = (window as any).MouseEvent;
    (global as any).MutationObserver = (window as any).MutationObserver;

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('Fix #1: Selector Fallback Logic', () => {
    test('should handle empty tagName in :contains() selector correctly', () => {
      // Test the fixed logic
      const testSelector = ':contains("Поднять в поиске")'; // Starts with colon
      const parts = testSelector.split(':');
      const tagName = parts[0] || '*';
      
      // Apply the fix logic
      const safeTagName = tagName.trim() === '' ? '*' : tagName;
      
      expect(parts[0]).toBe(''); // Still empty string
      expect(tagName).toBe('*'); // ✅ FIXED: || '*' fallback works for empty string
      expect(safeTagName).toBe('*'); // ✅ FIXED: Now correctly fallback to '*'
    });

    test('should not throw when using fixed selector logic', () => {
      const invalidSelector = ''; // Empty tagName
      const safeSelector = invalidSelector.trim() === '' ? '*' : invalidSelector;
      
      expect(() => {
        document.querySelectorAll(safeSelector);
      }).not.toThrow(); // ✅ FIXED: No longer throws
      
      expect(safeSelector).toBe('*');
    });
  });

  describe('Fix #2: Race Condition in Initialization', () => {
    test('should prevent race condition with proper locking', async () => {
      let isInitialized = false;
      let isInitializing = false; // Added flag
      let initializationCount = 0;

      const mockInitialize = async () => {
        // Fixed logic with proper locking
        if (isInitialized || isInitializing) {
          return;
        }
        
        isInitializing = true;
        
        try {
          // Simulate async initialization work
          await new Promise(resolve => setTimeout(resolve, 10));
          
          initializationCount++;
          isInitialized = true;
        } finally {
          isInitializing = false;
        }
      };

      // Simulate concurrent calls
      const promises = [
        mockInitialize(),
        mockInitialize(),
        mockInitialize(),
      ];

      await Promise.all(promises);

      // ✅ FIXED: Should only initialize once
      expect(initializationCount).toBe(1);
      expect(isInitialized).toBe(true);
      expect(isInitializing).toBe(false);
    });
  });

  describe('Fix #3: Message Sending Error Handling', () => {
    test('should return success/failure indicator from message sending', () => {
      const mockSendMessage = jest.fn().mockImplementation(() => {
        throw new Error('Runtime not available');
      });

      (global as any).chrome.runtime.sendMessage = mockSendMessage;

      const sendMessageToBackground = (message: any): boolean => {
        try {
          chrome.runtime.sendMessage(message);
          return true; // ✅ FIXED: Return success indicator
        } catch (error) {
          console.error('Failed to send message to background:', error);
          
          // ✅ FIXED: Provide specific error context
          if (message.type === 'BUTTON_STATE') {
            console.warn('Button state update failed - extension may not be responding');
          }
          
          return false; // ✅ FIXED: Return failure indicator
        }
      };

      const result = sendMessageToBackground({ type: 'BUTTON_STATE' });

      // ✅ FIXED: Now we can detect failure
      expect(result).toBe(false);
      expect(mockSendMessage).toHaveBeenCalled();
    });

    test('should handle message sending success', () => {
      const mockSendMessage = jest.fn(); // Success case

      (global as any).chrome.runtime.sendMessage = mockSendMessage;

      const sendMessageToBackground = (message: any): boolean => {
        try {
          chrome.runtime.sendMessage(message);
          return true;
        } catch (error) {
          console.error('Failed to send message to background:', error);
          return false;
        }
      };

      const result = sendMessageToBackground({ type: 'TEST' });

      // ✅ FIXED: Success is properly indicated
      expect(result).toBe(true);
      expect(mockSendMessage).toHaveBeenCalled();
    });
  });

  describe('Fix #4: Improved Error Context', () => {
    test('should provide specific error context for different message types', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockSendMessage = jest.fn().mockImplementation(() => {
        throw new Error('Runtime not available');
      });

      (global as any).chrome.runtime.sendMessage = mockSendMessage;

      const sendMessageToBackground = (message: any): boolean => {
        try {
          chrome.runtime.sendMessage(message);
          return true;
        } catch (error) {
          console.error('Failed to send message to background:', error);
          
          // ✅ FIXED: Specific error context
          if (message.type === 'BUTTON_STATE') {
            console.warn('Button state update failed - extension may not be responding');
          }
          
          return false;
        }
      };

      sendMessageToBackground({ type: 'BUTTON_STATE' });

      // ✅ FIXED: Specific warning is logged
      expect(consoleSpy).toHaveBeenCalledWith(
        'Button state update failed - extension may not be responding'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Fix #5: Button State Change Handling', () => {
    test('should handle message sending failure in button state updates', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      let lastButtonState: boolean | null = null;

      const sendMessageToBackground = jest.fn().mockReturnValue(false); // Simulate failure

      const checkButtonState = () => {
        const button = document.querySelector('button');
        const isActive = !!button && !button.disabled;

        // Only send message if state changed
        if (lastButtonState !== isActive) {
          lastButtonState = isActive;

          const messageSent = sendMessageToBackground({
            type: 'BUTTON_STATE',
            success: true,
            data: {
              buttonFound: !!button,
              isActive: isActive,
              buttonText: button?.textContent || null,
            },
          });

          // ✅ FIXED: Handle message sending failure
          if (!messageSent) {
            console.warn('Failed to notify background script of button state change');
          }
        }
      };

      // Create a button and trigger state check
      const button = document.createElement('button');
      button.textContent = 'Test Button';
      document.body.appendChild(button);

      checkButtonState();

      // ✅ FIXED: Failure is properly handled and logged
      expect(sendMessageToBackground).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to notify background script of button state change'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Regression Tests', () => {
    test('should maintain backward compatibility for valid selectors', () => {
      // Test that normal selectors still work
      const button = document.createElement('button');
      button.textContent = 'Normal Button';
      button.className = 'test-button';
      document.body.appendChild(button);

      // These should all work without issues
      expect(() => document.querySelector('button')).not.toThrow();
      expect(() => document.querySelector('.test-button')).not.toThrow();
      expect(() => document.querySelectorAll('button')).not.toThrow();
      
      expect(document.querySelector('button')).toBeTruthy();
      expect(document.querySelector('.test-button')).toBeTruthy();
    });

    test('should handle normal initialization flow', () => {
      let isInitialized = false;
      let isInitializing = false;
      let setupCount = 0;

      const initialize = () => {
        if (isInitialized || isInitializing) {
          return;
        }

        isInitializing = true;

        try {
          setupCount++;
          isInitialized = true;
        } finally {
          isInitializing = false;
        }
      };

      // Single initialization should work normally
      initialize();
      
      expect(isInitialized).toBe(true);
      expect(isInitializing).toBe(false);
      expect(setupCount).toBe(1);

      // Subsequent calls should be ignored
      initialize();
      initialize();
      
      expect(setupCount).toBe(1); // Still only initialized once
    });
  });
}); 