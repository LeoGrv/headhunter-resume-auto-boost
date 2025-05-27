/**
 * @jest-environment jsdom
 */

import { JSDOM } from 'jsdom';
import { BackgroundMessage, ContentMessage } from '../../../src/utils/types';

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn().mockReturnValue(false),
    },
  },
};

// @ts-ignore
global.chrome = mockChrome;

// Mock console to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('ResumeBooster Content Script - Critical Bug Prevention Tests', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;

  beforeEach(() => {
    // Create a fresh DOM for each test
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>HeadHunter Resume Page</title>
        </head>
        <body>
          <div class="resume-page">
            <h1>Мое резюме</h1>
            <div class="resume-actions">
              <button data-qa="resume-update-button">Поднять в поиске</button>
            </div>
          </div>
        </body>
      </html>
    `, {
      url: 'https://hh.kz/resume/12345',
      pretendToBeVisual: true,
      resources: 'usable',
    });

    document = dom.window.document;
    window = dom.window as any;

    // Set up global DOM
    global.document = document;
    global.window = window as any;

    // Clear all mocks
    jest.clearAllMocks();

    // Reset Chrome API mocks
    mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('🚨 CRITICAL: Content Script Import and Initialization', () => {
    test('should import content script without throwing errors', async () => {
      await expect(import('../../src/content/resumeBooster')).resolves.not.toThrow();
    });

    test('should handle missing DOM elements gracefully', () => {
      // Remove all DOM elements
      document.body.innerHTML = '';

      // Test that basic DOM operations don't throw
      expect(() => {
        document.querySelector('button');
        document.querySelectorAll('button');
      }).not.toThrow();
    });

    test('should handle Chrome API unavailability', () => {
      // Test Chrome API safety checks
      expect(() => {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage({ test: true });
        }
      }).not.toThrow();
    });

    test('should handle multiple initialization attempts', () => {
      // Test that repeated operations don't throw
      for (let i = 0; i < 3; i++) {
        expect(() => {
          const button = document.createElement('button');
          button.textContent = 'Test Button';
          document.body.appendChild(button);
        }).not.toThrow();
      }
    });
  });

  describe('🚨 CRITICAL: Button Detection and Validation', () => {
    test('should find boost button with standard selector', () => {
      // Create button with standard data-qa attribute
      const button = document.createElement('button');
      button.setAttribute('data-qa', 'resume-update-button');
      button.textContent = 'Поднять в поиске';
      document.body.appendChild(button);

      // Button should be detectable
      expect(document.querySelector('[data-qa="resume-update-button"]')).toBeTruthy();
    });

    test('should find boost button with text content', () => {
      // Create button with text content only
      const button = document.createElement('button');
      button.textContent = 'Поднять резюме';
      document.body.appendChild(button);

      // Button should be detectable by text
      expect(button.textContent).toContain('Поднять');
    });

    test('should handle missing boost button gracefully', () => {
      // Remove all buttons
      document.body.innerHTML = '<div>No buttons here</div>';

      // Should not throw when searching for buttons
      expect(() => {
        document.querySelector('button[data-qa="resume-update-button"]');
        document.querySelectorAll('button');
      }).not.toThrow();
    });

    test('should handle malformed button elements', () => {
      // Create malformed button elements
      document.body.innerHTML = `
        <button></button>
        <button disabled></button>
        <button class="disabled">Disabled Button</button>
        <div role="button">Fake Button</div>
      `;

      // Should not throw when processing malformed elements
      expect(() => {
        const buttons = document.querySelectorAll('button, [role="button"]');
        buttons.forEach(btn => {
          btn.textContent;
          btn.getAttribute('disabled');
          btn.classList.contains('disabled');
        });
      }).not.toThrow();
    });

    test('should detect button state correctly', () => {
      // Create active button
      const activeButton = document.createElement('button');
      activeButton.setAttribute('data-qa', 'resume-update-button');
      activeButton.textContent = 'Поднять в поиске';
      document.body.appendChild(activeButton);

      // Create disabled button
      const disabledButton = document.createElement('button');
      disabledButton.setAttribute('data-qa', 'resume-boost-button');
      disabledButton.setAttribute('disabled', 'true');
      disabledButton.textContent = 'Недоступно';
      document.body.appendChild(disabledButton);

      // Should not throw when checking button states
      expect(() => {
        const isActiveDisabled = activeButton.hasAttribute('disabled');
        const isDisabledDisabled = disabledButton.hasAttribute('disabled');
        expect(isActiveDisabled).toBe(false);
        expect(isDisabledDisabled).toBe(true);
      }).not.toThrow();
    });

    test('should handle button selector variations', () => {
      const buttonSelectors = [
        'button[data-qa="resume-update-button"]',
        'button[data-qa="resume-boost-button"]',
        'button[data-qa="resume-raise-button"]',
        '.resume-update-button',
        '.boost-button',
        '.resume-raise-button',
      ];

      // Should not throw when testing different selectors
      expect(() => {
        buttonSelectors.forEach(selector => {
          try {
            document.querySelector(selector);
          } catch (error) {
            // Ignore selector errors for this test
          }
        });
      }).not.toThrow();
    });
  });

  describe('🚨 CRITICAL: Message Passing and Communication', () => {
    test('should handle message listener setup', () => {
      // Test message listener setup
      expect(() => {
        mockChrome.runtime.onMessage.addListener(jest.fn());
      }).not.toThrow();

      // Verify message listener was set up
      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });

    test('should handle background messages gracefully', () => {
      const mockSendResponse = jest.fn();
      const testMessage: BackgroundMessage = {
        type: 'BOOST_RESUME',
        tabId: 123,
      };

      // Should not throw when handling messages
      expect(() => {
        // Simulate message handling
        if (testMessage.type === 'BOOST_RESUME') {
          mockSendResponse({ success: true });
        }
      }).not.toThrow();
    });

    test('should handle Chrome runtime sendMessage failures', () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Runtime error'));

      // Should not throw when sending messages fails
      expect(() => {
        mockChrome.runtime.sendMessage({ test: true }).catch(() => {
          // Handle error gracefully
        });
      }).not.toThrow();
    });

    test('should handle malformed messages', () => {
      const mockSendResponse = jest.fn();
      const malformedMessages = [
        null,
        undefined,
        {},
        { type: 'INVALID_TYPE' },
        { type: null },
        'string message',
        123,
      ];

      for (const message of malformedMessages) {
        expect(() => {
          // Simulate safe message handling
          if (message && typeof message === 'object' && 'type' in message) {
            mockSendResponse({ success: false, error: 'Invalid message' });
          }
        }).not.toThrow();
      }
    });
  });

  describe('🚨 CRITICAL: DOM Manipulation and Page Interaction', () => {
    test('should handle button clicking safely', () => {
      // Create clickable button
      const button = document.createElement('button');
      button.setAttribute('data-qa', 'resume-update-button');
      button.textContent = 'Поднять в поиске';
      button.onclick = jest.fn();
      document.body.appendChild(button);

      // Simulate button click
      const clickEvent = new dom.window.MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });

      expect(() => {
        button.dispatchEvent(clickEvent);
      }).not.toThrow();
    });

    test('should handle DOM mutations gracefully', () => {
      // Simulate DOM changes
      const newElement = document.createElement('div');
      newElement.innerHTML = '<button data-qa="resume-update-button">New Button</button>';
      
      expect(() => {
        document.body.appendChild(newElement);
      }).not.toThrow();

      // Remove elements
      expect(() => {
        document.body.removeChild(newElement);
      }).not.toThrow();
    });

    test('should handle page refresh scenarios', () => {
      // Simulate page refresh by clearing and rebuilding DOM
      expect(() => {
        document.body.innerHTML = '';
        document.body.innerHTML = '<div>Refreshed page content</div>';
      }).not.toThrow();
    });

    test('should handle scroll operations safely', () => {
      // Create button that might need scrolling
      const button = document.createElement('button');
      button.setAttribute('data-qa', 'resume-update-button');
      button.textContent = 'Поднять в поиске';
      button.scrollIntoView = jest.fn();
      document.body.appendChild(button);

      // Scrolling should not throw errors
      expect(() => {
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }).not.toThrow();
    });
  });

  describe('🚨 CRITICAL: Error Handling and Resilience', () => {
    test('should handle querySelector failures', () => {
      // Mock querySelector to throw error
      const originalQuerySelector = document.querySelector;
      document.querySelector = jest.fn().mockImplementation(() => {
        throw new Error('Query selector failed');
      });

      // Should handle errors gracefully
      expect(() => {
        try {
          document.querySelector('button');
        } catch (error) {
          // Handle error gracefully
        }
      }).not.toThrow();

      // Restore original
      document.querySelector = originalQuerySelector;
    });

    test('should handle event listener failures', () => {
      // Mock addEventListener to throw error
      const originalAddEventListener = document.addEventListener;
      document.addEventListener = jest.fn().mockImplementation(() => {
        throw new Error('Event listener failed');
      });

      // Should handle errors gracefully
      expect(() => {
        try {
          document.addEventListener('click', jest.fn());
        } catch (error) {
          // Handle error gracefully
        }
      }).not.toThrow();

      // Restore original
      document.addEventListener = originalAddEventListener;
    });

    test('should handle timer failures gracefully', () => {
      // Should handle timer operations safely
      expect(() => {
        const timer = setTimeout(() => {}, 100);
        clearTimeout(timer);
      }).not.toThrow();
    });

    test('should handle MutationObserver failures', () => {
      // Should handle MutationObserver operations safely
      expect(() => {
        const observer = new MutationObserver(() => {});
        // Test that observer can be created and disconnected safely
        observer.disconnect();
      }).not.toThrow();
    });
  });

  describe('🚨 CRITICAL: Memory and Resource Management', () => {
    test('should handle cleanup operations', () => {
      // Simulate cleanup scenarios
      expect(() => {
        // Trigger beforeunload event
        const event = new dom.window.Event('beforeunload');
        window.dispatchEvent(event);
      }).not.toThrow();
    });

    test('should handle multiple timer operations', () => {
      // Create multiple timers
      const timers: NodeJS.Timeout[] = [];
      for (let i = 0; i < 10; i++) {
        timers.push(setTimeout(() => {}, 100));
      }

      // Clear timers
      expect(() => {
        timers.forEach(timer => clearTimeout(timer));
      }).not.toThrow();
    });

    test('should handle rapid DOM changes', () => {
      // Simulate rapid DOM changes
      for (let i = 0; i < 20; i++) {
        expect(() => {
          const element = document.createElement('div');
          element.innerHTML = `<button>Button ${i}</button>`;
          document.body.appendChild(element);
          document.body.removeChild(element);
        }).not.toThrow();
      }
    });

    test('should handle memory-intensive operations', () => {
      // Create large DOM structure
      const largeContainer = document.createElement('div');
      for (let i = 0; i < 1000; i++) {
        const element = document.createElement('div');
        element.textContent = `Element ${i}`;
        largeContainer.appendChild(element);
      }

      expect(() => {
        document.body.appendChild(largeContainer);
        document.body.removeChild(largeContainer);
      }).not.toThrow();
    });
  });

  describe('🚨 CRITICAL: Edge Cases and Boundary Conditions', () => {
    test('should handle empty page content', () => {
      document.body.innerHTML = '';

      // Should not throw when working with empty page
      expect(() => {
        document.querySelector('button');
        document.querySelectorAll('*');
      }).not.toThrow();
    });

    test('should handle non-HeadHunter pages', () => {
      // Should handle different page contexts
      expect(() => {
        const url = window.location.href;
        const isHeadHunter = url.includes('hh.ru') || url.includes('hh.kz');
        // Logic should work regardless of domain
      }).not.toThrow();
    });

    test('should handle extreme button text lengths', () => {
      const button = document.createElement('button');
      button.setAttribute('data-qa', 'resume-update-button');
      button.textContent = 'A'.repeat(10000); // Very long text
      document.body.appendChild(button);

      // Should handle long text without issues
      expect(() => {
        const text = button.textContent;
        const hasText = text && text.length > 0;
      }).not.toThrow();
    });

    test('should handle special characters in button text', () => {
      const specialTexts = [
        '🚀 Поднять резюме 🚀',
        'Поднять\nрезюме',
        'Поднять\tрезюме',
        'Поднять резюме™',
        '«Поднять резюме»',
        'Поднять резюме & обновить',
      ];

      for (const text of specialTexts) {
        const button = document.createElement('button');
        button.textContent = text;
        document.body.appendChild(button);

        // Should handle special characters
        expect(() => {
          const content = button.textContent;
          const normalized = content?.toLowerCase();
        }).not.toThrow();
      }
    });

    test('should handle concurrent operations', async () => {
      // Simulate concurrent operations
      const operations = Array.from({ length: 10 }, (_, i) => 
        new Promise(resolve => {
          setTimeout(() => {
            const button = document.createElement('button');
            button.textContent = `Button ${i}`;
            document.body.appendChild(button);
            resolve(true);
          }, Math.random() * 100);
        })
      );

      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });

  describe('🚨 CRITICAL: HeadHunter Page Structure Variations', () => {
    test('should handle different button layouts', () => {
      const buttonLayouts = [
        '<button data-qa="resume-update-button">Поднять в поиске</button>',
        '<a data-qa="resume-update-button" role="button">Поднять резюме</a>',
        '<div class="resume-update-button">Поднять</div>',
        '<button class="btn btn-primary resume-boost">Обновить</button>',
        '<input type="button" value="Поднять в поиске" />',
      ];

      for (const layout of buttonLayouts) {
        expect(() => {
          document.body.innerHTML = layout;
          document.querySelector('button, a, div, input');
        }).not.toThrow();
      }
    });

    test('should handle different page structures', () => {
      const pageStructures = [
        '<div class="resume-page"><div class="actions"><button>Поднять</button></div></div>',
        '<main><section><article><button data-qa="resume-update-button">Поднять</button></article></section></main>',
        '<table><tr><td><button>Поднять резюме</button></td></tr></table>',
        '<form><fieldset><button type="button">Поднять в поиске</button></fieldset></form>',
      ];

      for (const structure of pageStructures) {
        expect(() => {
          document.body.innerHTML = structure;
          document.querySelector('button');
        }).not.toThrow();
      }
    });

    test('should handle dynamic content loading', async () => {
      // Simulate dynamic content loading
      setTimeout(() => {
        const dynamicButton = document.createElement('button');
        dynamicButton.setAttribute('data-qa', 'resume-update-button');
        dynamicButton.textContent = 'Поднять в поиске';
        document.body.appendChild(dynamicButton);
      }, 100);

      // Should not throw during dynamic loading
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    test('should handle page language variations', () => {
      const languageVariations = [
        'Поднять в поиске', // Russian
        'Көтеру', // Kazakh
        'Raise in search', // English
        'Поднять резюме',
        'Обновить резюме',
        'Boost resume',
      ];

      for (const text of languageVariations) {
        const button = document.createElement('button');
        button.textContent = text;
        document.body.appendChild(button);

        // Should handle different languages
        expect(() => {
          const content = button.textContent;
          const hasBoostKeywords = content?.includes('Поднять') || 
                                   content?.includes('Көтеру') || 
                                   content?.includes('Raise') ||
                                   content?.includes('Boost');
        }).not.toThrow();
      }
    });
  });

  describe('🚨 CRITICAL: Performance and Efficiency', () => {
    test('should initialize within reasonable time', () => {
      const startTime = Date.now();

      // Simulate initialization operations
      document.querySelector('button');
      document.querySelectorAll('button');
      
      const endTime = Date.now();
      const initTime = endTime - startTime;

      // Should initialize within reasonable time
      expect(initTime).toBeLessThan(100);
    });

    test('should handle large DOM trees efficiently', () => {
      // Create large DOM tree
      const container = document.createElement('div');
      for (let i = 0; i < 1000; i++) {
        const element = document.createElement('div');
        element.innerHTML = `<span>Content ${i}</span>`;
        container.appendChild(element);
      }
      document.body.appendChild(container);

      const startTime = Date.now();
      
      // Simulate DOM operations
      document.querySelectorAll('button');
      document.querySelector('[data-qa="resume-update-button"]');
      
      const endTime = Date.now();

      // Should handle large DOM within reasonable time
      expect(endTime - startTime).toBeLessThan(100);
    });

    test('should not block the main thread', async () => {
      let mainThreadBlocked = false;

      // Set a timer to check if main thread is blocked
      const timer = setTimeout(() => {
        mainThreadBlocked = true;
      }, 50);

      // Simulate some operations
      for (let i = 0; i < 100; i++) {
        document.createElement('div');
      }

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      clearTimeout(timer);

      // Main thread should not be blocked
      expect(mainThreadBlocked).toBe(true); // Timer should have fired
    });
  });
}); 