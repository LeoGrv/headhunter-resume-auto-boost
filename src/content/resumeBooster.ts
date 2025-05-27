// HeadHunter Resume Auto-Boost Extension
// Content Script for HeadHunter pages

import { BackgroundMessage, ContentMessage } from '../utils/types';

console.log('HeadHunter Resume Auto-Boost Extension: Content script loaded');

// ✅ ДИАГНОСТИЧЕСКИЙ ФЛАГ для проверки загрузки content script
(window as any).resumeBoosterLoaded = true;

// Button selectors (multiple fallbacks for different page layouts)
const BUTTON_SELECTORS = [
  // Modern HH selectors (2024)
  'button[data-qa="resume-update-button"]',
  'button[data-qa="resume-boost-button"]', 
  'button[data-qa="resume-raise-button"]',
  'button[data-qa="resume-refresh-button"]',
  'button[data-qa="resume-promote-button"]',
  
  // Legacy selectors
  'a[data-qa="resume-update-button"]',
  '.resume-update-button',
  '.boost-button',
  '.resume-raise-button',
  
  // Generic class-based selectors
  '[class*="resume"][class*="update"]',
  '[class*="resume"][class*="boost"]',
  '[class*="resume"][class*="raise"]',
  '[class*="resume"][class*="refresh"]',
  '[class*="resume"][class*="promote"]',
  
  // Text-based selectors (will be handled manually)
  'button:contains("Поднять в поиске")',
  'button:contains("Поднять резюме")',
  'button:contains("Поднять")',
  'button:contains("Обновить")',
  'button:contains("Продвинуть")',
  'button:contains("Refresh")',
  'a:contains("Поднять в поиске")',
  'a:contains("Поднять резюме")',
  'a:contains("Поднять")',
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

    // Initial button check with delay to ensure page is loaded
    setTimeout(() => {
      checkButtonState();
      console.log('Initial button state check completed');
    }, 1000);

    // Additional checks with increasing delays
    setTimeout(() => checkButtonState(), 3000);
    setTimeout(() => checkButtonState(), 5000);

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
  console.log('🔍 Searching for boost button...');

  // Priority search: Look for exact text matches first
  const exactTextMatches = [
    'Поднять в поиске',
    'Поднять резюме', 
    'Поднять',
    'Обновить резюме',
    'Обновить'
  ];

  console.log('🎯 Step 1: Looking for exact text matches...');
  for (const exactText of exactTextMatches) {
    const allElements = document.querySelectorAll('button, a, [role="button"]');
    for (let i = 0; i < allElements.length; i++) {
      const element = allElements[i] as HTMLElement;
      const elementText = element.textContent?.trim() || '';
      
      if (elementText === exactText) {
        console.log(`✅ Found exact match for "${exactText}":`, element);
        return element;
      }
    }
  }

  console.log('🎯 Step 2: Looking for partial text matches...');
  for (const partialText of exactTextMatches) {
    const allElements = document.querySelectorAll('button, a, [role="button"]');
    for (let i = 0; i < allElements.length; i++) {
      const element = allElements[i] as HTMLElement;
      const elementText = element.textContent?.trim() || '';
      
      if (elementText.includes(partialText)) {
        console.log(`✅ Found partial match for "${partialText}":`, element);
        return element;
      }
    }
  }

  console.log('🎯 Step 3: Trying data-qa selectors...');
  for (const selector of BUTTON_SELECTORS) {
    try {
      if (!selector.includes(':contains(')) {
        const element = document.querySelector(selector) as HTMLElement;
        if (element) {
          console.log(`✅ Found button with selector "${selector}":`, element);
          return element;
        }
      }
    } catch (error) {
      console.warn(`❌ Failed to query selector ${selector}:`, error);
    }
  }

  console.log('🎯 Step 4: Aggressive keyword search...');
  const allClickableElements = document.querySelectorAll(
    'button, a, [role="button"], [class*="button"], [class*="btn"], span[onclick], div[onclick]'
  );
  
  console.log(`🔍 Searching through ${allClickableElements.length} clickable elements...`);
  
  const boostKeywords = [
    'поднять', 'boost', 'raise', 'update', 'обновить', 'продвинуть', 'refresh'
  ];
  
  for (let i = 0; i < allClickableElements.length; i++) {
    const element = allClickableElements[i] as HTMLElement;
    const text = element.textContent?.toLowerCase().trim() || '';
    const dataQa = element.getAttribute('data-qa')?.toLowerCase() || '';
    const className = element.className?.toLowerCase() || '';
    
    // Check if element contains boost-related keywords
    for (const keyword of boostKeywords) {
      if (text.includes(keyword) || dataQa.includes(keyword) || className.includes(keyword)) {
        console.log(`✅ Found potential boost button via keyword "${keyword}":`, {
          element,
          text: element.textContent?.trim(),
          dataQa: element.getAttribute('data-qa'),
          className: element.className
        });
        return element;
      }
    }
  }

  // Debug: log all buttons on the page
  console.log(`❌ No boost button found. Total clickable elements on page: ${allClickableElements.length}`);

  if (allClickableElements.length > 0) {
    console.log('📋 Available clickable elements (first 20):');
    allClickableElements.forEach((btn, index) => {
      if (index < 20) {
        console.log(
          `  ${index + 1}. Text: "${btn.textContent?.trim()}", Classes: "${btn.className}", Data-qa: "${btn.getAttribute('data-qa')}", Tag: "${btn.tagName}"`
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
      console.warn('❌ Boost button not found');
      return false;
    }

    if (!isButtonActive()) {
      console.warn('❌ Boost button is not active/clickable');
      return false;
    }

    console.log('🎯 Found boost button, attempting to click:', {
      text: button.textContent?.trim(),
      dataQa: button.getAttribute('data-qa'),
      className: button.className,
      tagName: button.tagName
    });

    // Scroll button into view
    button.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Try multiple click methods for better compatibility
    let clickSuccess = false;

    // Method 1: Focus and direct click
    try {
      button.focus();
      await new Promise(resolve => setTimeout(resolve, 100));
      button.click();
      console.log('✅ Method 1: Direct click executed');
      clickSuccess = true;
    } catch (error) {
      console.warn('❌ Method 1 failed:', error);
    }

    // Method 2: Mouse events sequence
    try {
      const mouseEvents = ['mousedown', 'mouseup', 'click'];
      for (const eventType of mouseEvents) {
        const event = new MouseEvent(eventType, {
          bubbles: true,
          cancelable: true,
          view: window,
          button: 0,
          buttons: 1,
          clientX: button.getBoundingClientRect().left + button.offsetWidth / 2,
          clientY: button.getBoundingClientRect().top + button.offsetHeight / 2
        });
        button.dispatchEvent(event);
      }
      console.log('✅ Method 2: Mouse event sequence executed');
      clickSuccess = true;
    } catch (error) {
      console.warn('❌ Method 2 failed:', error);
    }

    // Method 3: Keyboard activation (Enter key)
    try {
      button.focus();
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      button.dispatchEvent(enterEvent);
      console.log('✅ Method 3: Enter key event executed');
      clickSuccess = true;
    } catch (error) {
      console.warn('❌ Method 3 failed:', error);
    }

    // Method 4: Try to trigger form submission if button is in a form
    try {
      const form = button.closest('form');
      if (form) {
        form.submit();
        console.log('✅ Method 4: Form submission executed');
        clickSuccess = true;
      }
    } catch (error) {
      console.warn('❌ Method 4 failed:', error);
    }

    if (clickSuccess) {
      console.log('🎉 Boost button click attempts completed');
      
      // Wait to see if the page responds
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if button state changed (might be disabled after click)
      const buttonAfterClick = findBoostButton();
      if (buttonAfterClick) {
        const isStillActive = isButtonActive();
        console.log('📊 Button state after click:', {
          found: !!buttonAfterClick,
          active: isStillActive,
          text: buttonAfterClick.textContent?.trim()
        });
        
        // If button is now disabled/inactive, it likely worked
        if (!isStillActive) {
          console.log('✅ Button appears to be disabled after click - likely successful');
          return true;
        }
      }
      
      return true;
    } else {
      console.error('❌ All click methods failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to click boost button:', error);
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

    case 'TEST_MESSAGE':
      console.log('🧪 Content script получил TEST_MESSAGE');
      sendResponse({ 
        type: 'TEST_RESPONSE', 
        success: true, 
        data: { 
          loaded: true, 
          timestamp: Date.now(),
          url: window.location.href 
        } 
      });
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
