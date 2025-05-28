// HeadHunter Resume Auto-Boost Extension
// Content Script for HeadHunter pages

import { BackgroundMessage, ContentMessage } from '../utils/types';
import { logger } from '../utils/logger';

console.log('HeadHunter Resume Auto-Boost Extension: Content script loaded');

// ✅ ДИАГНОСТИЧЕСКИЙ ФЛАГ для проверки загрузки content script
(window as any).resumeBoosterLoaded = true;
console.log('✅ resumeBoosterLoaded flag set to true');

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
      
      // Логируем ошибку настройки обновления страницы
      logger.error('ContentScript', 'Failed to setup page refresh', {
        url: window.location.href,
        error: error instanceof Error ? error.message : String(error)
      }).catch(() => {});
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
  console.log('🔍 Searching for boost button...');

  // First try the most reliable selector
  const directButton = document.querySelector('button[data-qa="resume-update-button"]') as HTMLElement;
  if (directButton) {
    console.log('✅ Found button via direct selector:', directButton);
    
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

  console.log('🎯 Step 1: Looking for exact text matches...');
  for (const exactText of exactTextMatches) {
    const allElements = document.querySelectorAll('button, a, [role="button"]');
    for (let i = 0; i < allElements.length; i++) {
      const element = allElements[i] as HTMLElement;
      const elementText = element.textContent?.trim() || '';
      
      console.log(`🔍 Checking element: "${elementText}" vs "${exactText}"`);
      
      if (elementText === exactText) {
        console.log(`✅ Found exact match for "${exactText}":`, element);
        
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
  console.log('🎯 Step 2: Looking for partial text matches...');
  for (const partialText of exactTextMatches) {
    const allElements = document.querySelectorAll('button, a, [role="button"]');
    for (let i = 0; i < allElements.length; i++) {
      const element = allElements[i] as HTMLElement;
      const elementText = element.textContent?.trim() || '';
      
      if (elementText.includes(partialText)) {
        console.log(`✅ Found partial match for "${partialText}":`, element);
        
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

  // Debug: log all buttons on the page
  console.log(`❌ No boost button found. Total clickable elements on page: ${document.querySelectorAll('button, a, [role="button"]').length}`);

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

    console.log('🎯 Found boost button, attempting to click:', {
      text: button.textContent?.trim(),
      dataQa: button.getAttribute('data-qa'),
      className: button.className,
      tagName: button.tagName,
      disabled: (button as HTMLButtonElement).disabled || button.hasAttribute('disabled'),
      ariaDisabled: button.getAttribute('aria-disabled'),
      offsetParent: !!button.offsetParent
    });

    // 🔍 Детекция активности вкладки
    const isTabActive = !document.hidden && document.visibilityState === 'visible';
    console.log(`🔍 Tab activity status: ${isTabActive ? 'ACTIVE' : 'BACKGROUND'}`);

    // 🤖 ИМИТАЦИЯ ЧЕЛОВЕЧЕСКОГО ПОВЕДЕНИЯ (только для активных вкладок)
    if (isTabActive) {
      console.log('🤖 Simulating human behavior for active tab...');
      
      // 1. Случайная задержка перед действием (как человек думает)
      const thinkingDelay = Math.random() * 1000 + 500; // 0.5-1.5 сек
      await new Promise(resolve => setTimeout(resolve, thinkingDelay));
      
      // 2. Движение мыши к кнопке (имитация наведения)
      const rect = button.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Создаем события движения мыши
      const mouseMoveEvent = new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: centerX,
        clientY: centerY
      });
      document.dispatchEvent(mouseMoveEvent);
      
      // 3. Наведение на кнопку
      const mouseEnterEvent = new MouseEvent('mouseenter', {
        bubbles: false,
        cancelable: true,
        view: window,
        clientX: centerX,
        clientY: centerY
      });
      button.dispatchEvent(mouseEnterEvent);
      
      // 4. Hover эффект
      const mouseOverEvent = new MouseEvent('mouseover', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: centerX,
        clientY: centerY
      });
      button.dispatchEvent(mouseOverEvent);
      
      // 5. Пауза на hover (как человек читает кнопку)
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

      // Scroll button into view (плавно, как человек)
      button.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Wait for scroll to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // 6. Focus на кнопку (как при Tab навигации)
      try {
        button.focus();
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.warn('Focus failed:', e);
      }

      console.log('🤖 Human simulation complete, starting click sequence...');
    } else {
      console.log('⚡ Background tab detected - using fast click mode...');
      
      // Для неактивных вкладок - быстрый режим без имитации
      try {
        button.scrollIntoView({ behavior: 'auto', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 100)); // Минимальная задержка
      } catch (e) {
        console.warn('Scroll failed in background:', e);
      }
    }

    // Try multiple click methods for better compatibility
    let clickSuccess = false;
    const clickResults: string[] = [];

    if (isTabActive) {
      // Method 1: Realistic mouse click sequence (только для активных вкладок)
      try {
        const rect = button.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Более реалистичная последовательность событий мыши
        const mouseEvents = [
          { type: 'mousedown', delay: 0 },
          { type: 'mouseup', delay: 50 + Math.random() * 100 }, // Человеческая задержка
          { type: 'click', delay: 10 }
        ];

        for (const eventConfig of mouseEvents) {
          await new Promise(resolve => setTimeout(resolve, eventConfig.delay));
          
          const event = new MouseEvent(eventConfig.type, {
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0,
            buttons: eventConfig.type === 'mousedown' ? 1 : 0,
            clientX: centerX + (Math.random() - 0.5) * 2, // Небольшой джиттер
            clientY: centerY + (Math.random() - 0.5) * 2,
            screenX: centerX + window.screenX,
            screenY: centerY + window.screenY
          });
          
          button.dispatchEvent(event);
        }
        
        console.log('✅ Method 1: Realistic mouse sequence executed');
        clickResults.push('Realistic mouse: SUCCESS');
        clickSuccess = true;
      } catch (error) {
        console.warn('❌ Method 1 failed:', error);
        clickResults.push(`Realistic mouse: FAILED - ${error}`);
      }
    }

    // Method 2: Direct click (работает в любых вкладках)
    try {
      const delay = isTabActive ? (100 + Math.random() * 200) : 50; // Быстрее для фоновых
      await new Promise(resolve => setTimeout(resolve, delay));
      button.click();
      console.log('✅ Method 2: Direct click executed');
      clickResults.push('Direct click: SUCCESS');
      clickSuccess = true;
    } catch (error) {
      console.warn('❌ Method 2 failed:', error);
      clickResults.push(`Direct click: FAILED - ${error}`);
    }

    // Method 3: Keyboard activation (работает в любых вкладках)
    try {
      const delay = isTabActive ? 50 : 10; // Быстрее для фоновых
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      button.dispatchEvent(enterEvent);
      
      // Также keyup для полноты
      const enterUpEvent = new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      button.dispatchEvent(enterUpEvent);
      
      console.log('✅ Method 3: Keyboard Enter executed');
      clickResults.push('Keyboard Enter: SUCCESS');
      clickSuccess = true;
    } catch (error) {
      console.warn('❌ Method 3 failed:', error);
      clickResults.push(`Keyboard Enter: FAILED - ${error}`);
    }

    console.log('📊 Click attempt summary:', clickResults);

    if (clickSuccess) {
      console.log('🎉 Boost button click attempts completed');
      
      // Логируем успешный клик
      logger.success('ContentScript', 'Button click attempts completed', {
        url: window.location.href,
        buttonText: button.textContent?.trim(),
        methods: clickResults,
        humanSimulation: isTabActive,
        tabActive: isTabActive
      }).catch(() => {});
      
      // Адаптивное время ожидания
      const waitTime = isTabActive ? 5000 : 2000; // Меньше для фоновых вкладок
      console.log(`⏱️ Waiting ${waitTime}ms for page response...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Check if button state changed (might be disabled after click)
      const buttonAfterClick = findBoostButton();
      if (buttonAfterClick) {
        const isStillActive = isButtonActive();
        console.log('📊 Button state after click:', {
          found: !!buttonAfterClick,
          active: isStillActive,
          text: buttonAfterClick.textContent?.trim(),
          disabled: (buttonAfterClick as HTMLButtonElement).disabled || buttonAfterClick.hasAttribute('disabled'),
          ariaDisabled: buttonAfterClick.getAttribute('aria-disabled')
        });
        
        // If button is now disabled/inactive, it likely worked
        if (!isStillActive) {
          console.log('✅ Button appears to be disabled after click - likely successful');
          return true;
        }
      }
      
      // Check if page content changed (look for success indicators)
      const successIndicators = [
        'обновлено', 'поднято', 'успешно', 'updated', 'boosted', 'success'
      ];
      
      const pageText = document.body.textContent?.toLowerCase() || '';
      for (const indicator of successIndicators) {
        if (pageText.includes(indicator)) {
          console.log(`✅ Found success indicator "${indicator}" on page`);
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
    
    // Логируем критическую ошибку
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
