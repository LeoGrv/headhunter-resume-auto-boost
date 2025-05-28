// HeadHunter Resume Auto-Boost Extension
// Content Script for HeadHunter pages

import { BackgroundMessage, ContentMessage } from '../utils/types';
import { logger } from '../utils/logger';

// ✅ ДИАГНОСТИЧЕСКИЙ ФЛАГ для проверки загрузки content script
(window as any).resumeBoosterLoaded = true;

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

  try {
    // Set up message listener
    setupMessageListener();

    // Set up DOM observer
    setupMutationObserver();

    // Set up page refresh mechanism
    setupPageRefresh().catch(error => {
      console.error('Failed to setup page refresh:', error);
      
      // Логируем ошибку настройки обновления страницы
      logger.error('ContentScript', 'Failed to setup page refresh', {
        url: window.location.href,
        error: error instanceof Error ? error.message : String(error)
      }).catch(() => {});
    });

    // Initial button check with delay to ensure page is loaded
    setTimeout(() => {
      checkButtonState();
    }, 1000);

    // Additional checks with increasing delays
    setTimeout(() => checkButtonState(), 3000);
    setTimeout(() => checkButtonState(), 5000);

    isInitialized = true;
    
    // Логируем успешную инициализацию
    logger.success('ContentScript', 'Successfully initialized', {
      url: window.location.href,
      readyState: document.readyState
    }).catch(() => {}); // Игнорируем ошибки логирования
  } catch (error) {
    // Логируем критическую ошибку инициализации
    logger.critical('ContentScript', 'Initialization failed', {
      url: window.location.href,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }).catch(() => {});
    
    console.error('Failed to initialize content script:', error);
  } finally {
    isInitializing = false;
  }
}

/**
 * Find the boost button using multiple selectors
 */
function findBoostButton(): HTMLElement | null {
  // First try the most reliable selector
  const directButton = document.querySelector('button[data-qa="resume-update-button"]') as HTMLElement;
  if (directButton) {
    // Логируем успешное нахождение кнопки
    logger.success('ContentScript', 'Button found via direct selector', {
      url: window.location.href,
      buttonText: directButton.textContent?.trim(),
      selector: 'button[data-qa="resume-update-button"]'
    }).catch(() => {});
    
    return directButton;
  }

  // Priority search: Look for exact text matches first
  const exactTextMatches = [
    'Поднять в поиске',
    'Поднять резюме', 
    'Поднять',
    'Обновить резюме',
    'Обновить'
  ];

  for (const exactText of exactTextMatches) {
    const allElements = document.querySelectorAll('button, a, [role="button"]');
    for (let i = 0; i < allElements.length; i++) {
      const element = allElements[i] as HTMLElement;
      const elementText = element.textContent?.trim() || '';
      
      if (elementText === exactText) {
        // Логируем нахождение кнопки по тексту
        logger.success('ContentScript', 'Button found via text match', {
          url: window.location.href,
          buttonText: elementText,
          matchedText: exactText,
          method: 'exact_text_match'
        }).catch(() => {});
        
        return element;
      }
    }
  }

  // Continue with other search methods...
  for (const partialText of exactTextMatches) {
    const allElements = document.querySelectorAll('button, a, [role="button"]');
    for (let i = 0; i < allElements.length; i++) {
      const element = allElements[i] as HTMLElement;
      const elementText = element.textContent?.trim() || '';
      
      if (elementText.includes(partialText)) {
        // Логируем нахождение кнопки по частичному совпадению
        logger.success('ContentScript', 'Button found via partial text match', {
          url: window.location.href,
          buttonText: elementText,
          matchedText: partialText,
          method: 'partial_text_match'
        }).catch(() => {});
        
        return element;
      }
    }
  }

  // Логируем неудачу поиска кнопки
  logger.error('ContentScript', 'Button not found on page', {
    url: window.location.href,
    totalButtons: document.querySelectorAll('button').length,
    totalLinks: document.querySelectorAll('a').length,
    totalClickable: document.querySelectorAll('button, a, [role="button"]').length,
    pageTitle: document.title
  }).catch(() => {});

  return null;
}

/**
 * Check if the boost button is currently active/clickable
 */
function isButtonActive(): boolean {
  const button = findBoostButton();

  if (!button) {
    // Логируем отсутствие кнопки
    logger.warning('ContentScript', 'Button activity check failed - button not found', {
      url: window.location.href
    }).catch(() => {});
    return false;
  }

  // Check if button is disabled
  if (
    button.hasAttribute('disabled') ||
    button.getAttribute('aria-disabled') === 'true'
  ) {
    // Логируем неактивную кнопку
    logger.warning('ContentScript', 'Button is disabled', {
      url: window.location.href,
      buttonText: button.textContent?.trim(),
      disabled: button.hasAttribute('disabled'),
      ariaDisabled: button.getAttribute('aria-disabled')
    }).catch(() => {});
    return false;
  }

  // Check if button has inactive classes
  const classList = button.classList;
  const inactiveClasses = ['disabled', 'inactive', 'loading', 'cooldown'];

  for (const inactiveClass of inactiveClasses) {
    if (classList.contains(inactiveClass)) {
      // Логируем неактивную кнопку по классу
      logger.warning('ContentScript', 'Button has inactive class', {
        url: window.location.href,
        buttonText: button.textContent?.trim(),
        inactiveClass: inactiveClass,
        allClasses: button.className
      }).catch(() => {});
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
      // Логируем неактивную кнопку по тексту
      logger.warning('ContentScript', 'Button has inactive text', {
        url: window.location.href,
        buttonText: button.textContent?.trim(),
        inactiveText: inactiveText
      }).catch(() => {});
      return false;
    }
  }

  // Логируем активную кнопку
  logger.success('ContentScript', 'Button is active and clickable', {
    url: window.location.href,
    buttonText: button.textContent?.trim(),
    className: button.className
  }).catch(() => {});

  return true;
}

/**
 * Click the boost button using multiple methods
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

    // 🔍 Детекция активности вкладки
    // const isTabActive = !document.hidden && document.visibilityState === 'visible';

    // Логируем начало попытки клика
    logger.warning('ContentScript', 'Boost request received - starting click attempt', {
      url: window.location.href,
      timestamp: new Date().toISOString()
    }).catch(() => {});

    // Сохраняем исходное состояние кнопки для сравнения
    const initialButtonText = button.textContent?.trim();
    const initialButtonClasses = button.className;
    const initialButtonDisabled = button.hasAttribute('disabled');

    // 🎯 ПРОСТОЙ И НАДЕЖНЫЙ ПОДХОД
    
    // 1. Прокрутка к кнопке
    try {
      button.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (e) {
      console.warn('Scroll failed:', e);
    }

    // 2. Фокус на кнопку
    try {
      button.focus();
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (e) {
      console.warn('Focus failed:', e);
    }

    let clickSuccess = false;
    const clickResults: string[] = [];

    // 🚀 МЕТОД 1: Прямой клик (самый надежный)
    try {
      button.click();
      clickResults.push('Direct Click: EXECUTED');
      clickSuccess = true;
      
      logger.success('ContentScript', 'Direct click executed', {
        url: window.location.href,
        buttonText: initialButtonText
      }).catch(() => {});
    } catch (error) {
      clickResults.push(`Direct Click: FAILED - ${error}`);
    }

    // 🚀 МЕТОД 2: Программный клик через события
    if (!clickSuccess) {
      try {
        const rect = button.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // MouseDown
        button.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: centerX,
          clientY: centerY,
          button: 0,
          buttons: 1
        }));

        await new Promise(resolve => setTimeout(resolve, 50));

        // Click
        button.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: centerX,
          clientY: centerY,
          button: 0,
          buttons: 1
        }));

        await new Promise(resolve => setTimeout(resolve, 50));

        // MouseUp
        button.dispatchEvent(new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: centerX,
          clientY: centerY,
          button: 0,
          buttons: 0
        }));

        clickResults.push('Event Click: EXECUTED');
        clickSuccess = true;

        logger.success('ContentScript', 'Event click executed', {
          url: window.location.href,
          buttonText: initialButtonText,
          coordinates: { x: centerX, y: centerY }
        }).catch(() => {});
      } catch (error) {
        clickResults.push(`Event Click: FAILED - ${error}`);
      }
    }

    // 🚀 МЕТОД 3: Принудительный клик через форму
    if (!clickSuccess) {
      try {
        // Ищем форму, содержащую кнопку
        const form = button.closest('form');
        if (form) {
          // Если кнопка в форме, пытаемся отправить форму
          const submitEvent = new Event('submit', {
            bubbles: true,
            cancelable: true
          });
          form.dispatchEvent(submitEvent);
          clickResults.push('Form Submit: EXECUTED');
        } else {
          // Если нет формы, пытаемся эмулировать Enter
          button.dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: 'Enter',
            code: 'Enter',
            keyCode: 13
          }));
          
          button.dispatchEvent(new KeyboardEvent('keypress', {
            bubbles: true,
            cancelable: true,
            key: 'Enter',
            code: 'Enter',
            keyCode: 13
          }));
          
          clickResults.push('Keyboard Enter: EXECUTED');
        }
        clickSuccess = true;

        logger.success('ContentScript', 'Alternative click method executed', {
          url: window.location.href,
          buttonText: initialButtonText,
          method: form ? 'form_submit' : 'keyboard_enter'
        }).catch(() => {});
      } catch (error) {
        clickResults.push(`Alternative Click: FAILED - ${error}`);
      }
    }

    // Ждем результат
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 🔍 ПРОВЕРКА УСПЕХА
    let isLikelySuccessful = false;
    const successIndicators: string[] = [];

    // 1. Проверяем изменение состояния кнопки
    const currentButton = findBoostButton();
    if (currentButton) {
      const currentButtonText = currentButton.textContent?.trim();
      const currentButtonClasses = currentButton.className;
      const currentButtonDisabled = currentButton.hasAttribute('disabled');

      if (currentButtonText !== initialButtonText) {
        successIndicators.push('button_text_changed');
        isLikelySuccessful = true;
      }

      if (currentButtonClasses !== initialButtonClasses) {
        successIndicators.push('button_classes_changed');
        isLikelySuccessful = true;
      }

      if (currentButtonDisabled !== initialButtonDisabled) {
        successIndicators.push('button_disabled_state_changed');
        isLikelySuccessful = true;
      }

      // Проверяем специфические классы успеха
      if (currentButtonClasses.includes('disabled') || 
          currentButtonClasses.includes('success') ||
          currentButtonClasses.includes('completed')) {
        successIndicators.push('success_class_detected');
        isLikelySuccessful = true;
      }
    } else {
      // Кнопка исчезла - возможно, успех
      successIndicators.push('button_disappeared');
      isLikelySuccessful = true;
    }

    // 2. Проверяем URL на изменения
    const currentUrl = window.location.href;
    if (currentUrl.includes('success') || currentUrl.includes('updated')) {
      successIndicators.push('success_url_detected');
      isLikelySuccessful = true;
    }

    // 3. Проверяем текст страницы на ключевые слова успеха
    const pageText = document.body.textContent?.toLowerCase() || '';
    const successKeywords = [
      'успешно обновлено',
      'резюме поднято',
      'поднято в поиске',
      'обновлено',
      'успешно',
      'поднято'
    ];

    for (const keyword of successKeywords) {
      if (pageText.includes(keyword)) {
        successIndicators.push(`keyword_found_${keyword.replace(/\s+/g, '_')}`);
        isLikelySuccessful = true;
        break;
      }
    }

    // Логируем результат
    if (isLikelySuccessful) {
      logger.success('ContentScript', 'Click appears successful', {
        url: window.location.href,
        clickMethods: clickResults,
        successIndicators: successIndicators,
        buttonStateChange: {
          textChanged: currentButton?.textContent?.trim() !== initialButtonText,
          classesChanged: currentButton?.className !== initialButtonClasses,
          disabledChanged: currentButton?.hasAttribute('disabled') !== initialButtonDisabled
        }
      }).catch(() => {});
      
      return true;
    } else {
      logger.warning('ContentScript', 'Click may have failed - no success indicators detected', {
        url: window.location.href,
        clickMethods: clickResults,
        successIndicators: successIndicators,
        buttonFound: !!currentButton,
        buttonText: currentButton?.textContent?.trim()
      }).catch(() => {});
      
      return false;
    }

  } catch (error) {
    console.error('❌ Failed to click boost button:', error);
    
    logger.critical('ContentScript', 'Failed to click boost button', {
      error: error instanceof Error ? error.message : String(error),
      url: window.location.href,
      buttonFound: !!findBoostButton()
    }).catch(() => {});
    
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
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  try {
    const refreshInterval = intervalMinutes * 60 * 1000; // Convert minutes to milliseconds

    refreshTimer = setTimeout(() => {
      refreshPage();
    }, refreshInterval);
  } catch (error) {
    console.error('❌ Failed to setup page refresh with interval:', error);
    // Fallback to 15 minutes
    const refreshInterval = 15 * 60 * 1000;
    refreshTimer = setTimeout(() => {
      refreshPage();
    }, refreshInterval);
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
}

/**
 * Message handler function
 */
function messageHandler(
  message: BackgroundMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: ContentMessage) => void
): boolean {
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
    // Логируем начало попытки клика
    logger.warning('ContentScript', 'Boost request received - starting click attempt', {
      url: window.location.href,
      timestamp: new Date().toISOString()
    }).catch(() => {});

    const success = await clickBoostButton();

    // Логируем результат клика
    if (success) {
      logger.success('ContentScript', 'Button click completed successfully', {
        url: window.location.href,
        timestamp: new Date().toISOString(),
        buttonFound: !!findBoostButton(),
        buttonActive: isButtonActive()
      }).catch(() => {});
    } else {
      logger.error('ContentScript', 'Button click failed', {
        url: window.location.href,
        timestamp: new Date().toISOString(),
        buttonFound: !!findBoostButton(),
        buttonActive: isButtonActive(),
        reason: 'clickBoostButton returned false'
      }).catch(() => {});
    }

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

    // Логируем критическую ошибку
    logger.critical('ContentScript', 'Exception during boost request', {
      url: window.location.href,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }).catch(() => {});

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
  // Update page refresh timer with new interval
  if (settings && settings.refreshInterval) {
    setupPageRefreshWithInterval(settings.refreshInterval);
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
}

// Initialize immediately and on DOM ready
initialize();

// Also try after DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initialize, 100);
  });
} else if (document.readyState === 'interactive') {
  setTimeout(initialize, 100);
}

// Force initialization after page load
window.addEventListener('load', () => {
  setTimeout(initialize, 500);
});

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
