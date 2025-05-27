// HeadHunter Resume Auto-Boost Extension
// Content Script for HeadHunter pages

import { BackgroundMessage, ContentMessage } from '../utils/types';

console.log('HeadHunter Resume Auto-Boost Extension: Content script loaded');

// Button selectors (multiple fallbacks for different page layouts)
const BUTTON_SELECTORS = [
  'button[data-qa="resume-update-button"]',
  'button[data-qa="resume-boost-button"]',
  'button[data-qa="resume-raise-button"]',
  'button:contains("Поднять в поиске")',
  'button:contains("Поднять резюме")',
  'button:contains("Поднять")',
  'button:contains("Обновить")',
  'a[data-qa="resume-update-button"]',
  'a:contains("Поднять в поиске")',
  'a:contains("Поднять резюме")',
  '.resume-update-button',
  '.boost-button',
  '.resume-raise-button',
  '[class*="resume"][class*="update"]',
  '[class*="resume"][class*="boost"]',
  '[class*="resume"][class*="raise"]',
];

// State management
let isInitialized = false;
let isInitializing = false; // Fix: Add flag to prevent race condition
let mutationObserver: MutationObserver | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let lastButtonState: boolean | null = null;

/**
 * Initialize the content script
 */
function initialize(): void {
  // Fix: Prevent race condition with proper locking
  if (isInitialized || isInitializing) {
    return;
  }

  isInitializing = true;
  console.log('HeadHunter Resume Auto-Boost: Content script initializing...');

  try {
    // Set up message listener
    setupMessageListener();

    // Set up DOM observer
    setupMutationObserver();

    // Set up page refresh mechanism
    setupPageRefresh().catch(error => {
      console.error('Failed to setup page refresh:', error);
    });

    // Initial button check
    checkButtonState();

    isInitialized = true;
    console.log('HeadHunter Resume Auto-Boost: Content script initialized');
  } finally {
    isInitializing = false;
  }
}

/**
 * Find the boost button using multiple selectors
 */
function findBoostButton(): HTMLElement | null {
  console.log('Searching for boost button...');

  for (const selector of BUTTON_SELECTORS) {
    try {
      // Handle :contains() pseudo-selector manually
      if (selector.includes(':contains(')) {
        const text = selector.match(/contains\("([^"]+)"\)/)?.[1];
        if (text) {
          const tagName = selector.split(':')[0] || '*';
          // Fix: Handle empty string case when selector starts with ':'
          const safeTagName = tagName.trim() === '' ? '*' : tagName;
          const elements = document.querySelectorAll(safeTagName);
                      console.log(
              `Checking ${elements.length} ${safeTagName} elements for text "${text}"`
            );

          for (let i = 0; i < elements.length; i++) {
            const element = elements[i] as HTMLElement;
            if (element && element.textContent?.includes(text)) {
              console.log(`Found button with text "${text}":`, element);
              return element;
            }
          }
        }
      } else {
        const element = document.querySelector(selector) as HTMLElement;
        if (element) {
          console.log(`Found button with selector "${selector}":`, element);
          return element;
        }
      }
    } catch (error) {
      console.warn(`Failed to query selector ${selector}:`, error);
    }
  }

  // Debug: log all buttons on the page
  const allButtons = document.querySelectorAll(
    'button, a[role="button"], [class*="button"]'
  );
  console.log(
    `No boost button found. Total buttons/links on page: ${allButtons.length}`
  );

  if (allButtons.length > 0) {
    console.log('Available buttons/links:');
    allButtons.forEach((btn, index) => {
      if (index < 10) {
        // Log first 10 buttons
        console.log(
          `  ${index + 1}. Text: "${btn.textContent?.trim()}", Classes: "${btn.className}", Data-qa: "${btn.getAttribute('data-qa')}"`
        );
      }
    });
  }

  return null;
}

/**
 * Check if the boost button is currently active/clickable
 */
function isButtonActive(): boolean {
  const button = findBoostButton();

  if (!button) {
    return false;
  }

  // Check if button is disabled
  if (
    button.hasAttribute('disabled') ||
    button.getAttribute('aria-disabled') === 'true'
  ) {
    return false;
  }

  // Check if button has inactive classes
  const classList = button.classList;
  const inactiveClasses = ['disabled', 'inactive', 'loading', 'cooldown'];

  for (const inactiveClass of inactiveClasses) {
    if (classList.contains(inactiveClass)) {
      return false;
    }
  }

  // Check button text for inactive states
  const buttonText = button.textContent?.toLowerCase() || '';
  const inactiveTexts = [
    'подождите',
    'обновлено',
    'недоступно',
    'заблокировано',
  ];

  for (const inactiveText of inactiveTexts) {
    if (buttonText.includes(inactiveText)) {
      return false;
    }
  }

  return true;
}

/**
 * Click the boost button
 */
async function clickBoostButton(): Promise<boolean> {
  try {
    const button = findBoostButton();

    if (!button) {
      console.warn('Boost button not found');
      return false;
    }

    if (!isButtonActive()) {
      console.warn('Boost button is not active/clickable');
      return false;
    }

    // Scroll button into view
    button.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Wait a bit for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Create and dispatch click event
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    });

    button.dispatchEvent(clickEvent);

    // Also try direct click as fallback
    if (typeof button.click === 'function') {
      button.click();
    }

    console.log('Boost button clicked successfully');

    // Wait a bit to see if the action was successful
    await new Promise(resolve => setTimeout(resolve, 1000));

    return true;
  } catch (error) {
    console.error('Failed to click boost button:', error);
    return false;
  }
}

/**
 * Refresh the current page
 */
function refreshPage(): void {
  try {
    console.log('Refreshing page to maintain session...');
    window.location.reload();
  } catch (error) {
    console.error('Failed to refresh page:', error);
  }
}

/**
 * Check button state and notify background script
 */
function checkButtonState(): void {
  const button = findBoostButton();
  const isActive = isButtonActive();

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

    // Fix: Handle message sending failure
    if (!messageSent) {
      console.warn('Failed to notify background script of button state change');
    }
  }
}

/**
 * Set up mutation observer to watch for DOM changes
 */
function setupMutationObserver(): void {
  if (mutationObserver) {
    mutationObserver.disconnect();
  }

  mutationObserver = new MutationObserver(mutations => {
    let shouldCheckButton = false;

    for (const mutation of mutations) {
      // Check if any added/removed nodes might affect the button
      if (mutation.type === 'childList') {
        const nodes = [
          ...Array.from(mutation.addedNodes),
          ...Array.from(mutation.removedNodes),
        ];

        for (const node of nodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;

            // Check if the node or its descendants contain button-related elements
            if (
              element.tagName === 'BUTTON' ||
              element.querySelector('button') ||
              element.classList.contains('resume-update') ||
              element.classList.contains('boost')
            ) {
              shouldCheckButton = true;
              break;
            }
          }
        }
      }

      // Check for attribute changes on buttons
      if (
        mutation.type === 'attributes' &&
        mutation.target.nodeType === Node.ELEMENT_NODE
      ) {
        const element = mutation.target as Element;

        if (
          element.tagName === 'BUTTON' ||
          element.closest('button') ||
          ['disabled', 'aria-disabled', 'class'].includes(
            mutation.attributeName || ''
          )
        ) {
          shouldCheckButton = true;
        }
      }
    }

    if (shouldCheckButton) {
      // Debounce button state checks
      setTimeout(checkButtonState, 100);
    }
  });

  // Start observing
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['disabled', 'aria-disabled', 'class'],
  });

  console.log('Mutation observer set up');
}

/**
 * Set up page refresh mechanism
 */
async function setupPageRefresh(): Promise<void> {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  try {
    // Get refresh interval from storage
    const result = await chrome.storage.sync.get(['extension_settings']);
    const settings = result.extension_settings || { refreshInterval: 15 };
    const refreshInterval = settings.refreshInterval * 60 * 1000; // Convert minutes to milliseconds

    refreshTimer = setTimeout(() => {
      refreshPage();
    }, refreshInterval);

    console.log(
      `Page refresh scheduled in ${refreshInterval / 1000 / 60} minutes`
    );
  } catch (error) {
    console.error(
      'Failed to get refresh interval from settings, using default 15 minutes:',
      error
    );
    // Fallback to 15 minutes
    const refreshInterval = 15 * 60 * 1000;
    refreshTimer = setTimeout(() => {
      refreshPage();
    }, refreshInterval);
  }
}

/**
 * Set up page refresh mechanism with specific interval
 */
function setupPageRefreshWithInterval(intervalMinutes: number): void {
  console.log(
    `🔄 Setting up page refresh with interval: ${intervalMinutes} minutes`
  );

  if (refreshTimer) {
    console.log('🔄 Clearing existing refresh timer');
    clearTimeout(refreshTimer);
  }

  try {
    const refreshInterval = intervalMinutes * 60 * 1000; // Convert minutes to milliseconds
    console.log(`🔄 Calculated refresh interval: ${refreshInterval}ms`);

    refreshTimer = setTimeout(() => {
      console.log('🔄 Page refresh timer expired, refreshing page...');
      refreshPage();
    }, refreshInterval);

    console.log(
      `✅ Page refresh scheduled in ${intervalMinutes} minutes (${refreshInterval}ms)`
    );
  } catch (error) {
    console.error('❌ Failed to setup page refresh with interval:', error);
    // Fallback to 15 minutes
    const refreshInterval = 15 * 60 * 1000;
    refreshTimer = setTimeout(() => {
      refreshPage();
    }, refreshInterval);
    console.log('🔄 Fallback: Page refresh scheduled in 15 minutes');
  }
}

/**
 * Set up message listener for background script communication
 */
function setupMessageListener(): void {
  // Remove existing listener to prevent duplicates
  if (chrome.runtime.onMessage.hasListener(messageHandler)) {
    chrome.runtime.onMessage.removeListener(messageHandler);
  }

  chrome.runtime.onMessage.addListener(messageHandler);
  console.log('Message listener set up');
}

/**
 * Message handler function
 */
function messageHandler(
  message: BackgroundMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: ContentMessage) => void
): boolean {
  console.log('Content script received message:', message);

  switch (message.type) {
    case 'BOOST_RESUME':
      handleBoostRequest(sendResponse);
      return true; // Keep message channel open for async response

    case 'CHECK_BUTTON_STATE':
      handleButtonStateRequest(sendResponse);
      return false; // Synchronous response

    case 'REFRESH_PAGE':
      refreshPage();
      sendResponse({ type: 'PAGE_REFRESHED', success: true });
      return false;

    case 'GET_STATE':
      handleGetStateRequest(sendResponse);
      return false;

    case 'SETTINGS_UPDATE':
      handleSettingsUpdate(message.data);
      sendResponse({ type: 'BUTTON_STATE', success: true });
      return false;

    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({
        type: 'ERROR',
        success: false,
        data: 'Unknown message type',
      });
      return false;
  }
}

/**
 * Handle boost request from background script
 */
async function handleBoostRequest(
  sendResponse: (response: ContentMessage) => void
): Promise<void> {
  try {
    const success = await clickBoostButton();

    sendResponse({
      type: 'BUTTON_CLICKED',
      success: success,
      data: {
        timestamp: Date.now(),
        buttonFound: !!findBoostButton(),
        wasActive: isButtonActive(),
      },
    });
  } catch (error) {
    console.error('Error handling boost request:', error);

    sendResponse({
      type: 'ERROR',
      success: false,
      data: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      },
    });
  }
}

/**
 * Handle button state request
 */
function handleButtonStateRequest(
  sendResponse: (response: ContentMessage) => void
): void {
  const button = findBoostButton();
  const isActive = isButtonActive();

  sendResponse({
    type: 'BUTTON_STATE',
    success: true,
    data: {
      buttonFound: !!button,
      isActive: isActive,
      buttonText: button?.textContent || null,
      timestamp: Date.now(),
    },
  });
}

/**
 * Handle get state request
 */
function handleGetStateRequest(
  sendResponse: (response: ContentMessage) => void
): void {
  const button = findBoostButton();

  sendResponse({
    type: 'BUTTON_STATE',
    success: true,
    data: {
      isInitialized: isInitialized,
      buttonFound: !!button,
      isActive: isButtonActive(),
      buttonText: button?.textContent || null,
      url: window.location.href,
      title: document.title,
      timestamp: Date.now(),
    },
  });
}

/**
 * Handle settings update from background script
 */
function handleSettingsUpdate(settings: any): void {
  console.log('🔄 Content script received settings update:', settings);
  console.log('🔄 Settings type:', typeof settings);
  console.log('🔄 Settings keys:', Object.keys(settings || {}));

  // Update page refresh timer with new interval
  if (settings && settings.refreshInterval) {
    console.log(
      `🔄 Updating page refresh interval to ${settings.refreshInterval} minutes`
    );
    setupPageRefreshWithInterval(settings.refreshInterval);
  } else {
    console.warn('🔄 No refreshInterval found in settings:', settings);
  }
}

/**
 * Send message to background script
 */
function sendMessageToBackground(message: ContentMessage): boolean {
  try {
    chrome.runtime.sendMessage(message);
    return true; // Fix: Return success indicator
  } catch (error) {
    console.error('Failed to send message to background:', error);
    
    // Fix: Attempt to notify user of communication failure
    if (message.type === 'BUTTON_STATE') {
      console.warn('Button state update failed - extension may not be responding');
    }
    
    return false; // Fix: Return failure indicator
  }
}

/**
 * Clean up resources
 */
function cleanup(): void {
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }

  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  // Remove message listener
  if (chrome.runtime.onMessage.hasListener(messageHandler)) {
    chrome.runtime.onMessage.removeListener(messageHandler);
  }

  isInitialized = false;
  console.log('Content script cleaned up');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Clean up on page unload
window.addEventListener('beforeunload', cleanup);

// Export functions for testing (Node.js environment)
declare const module: any;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    findBoostButton,
    isButtonActive,
    clickBoostButton,
    refreshPage,
    checkButtonState,
  };
}
