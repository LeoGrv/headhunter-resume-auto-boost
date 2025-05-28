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
    const isTabActive = !document.hidden && document.visibilityState === 'visible';

    // 🤖 ГИБРИДНАЯ ИМИТАЦИЯ ЧЕЛОВЕЧЕСКОГО ПОВЕДЕНИЯ
    
    // Логируем начало имитации
    logger.warning('ContentScript', 'Human simulation started', {
      url: window.location.href,
      tabActive: isTabActive,
      simulationType: isTabActive ? 'full' : 'lightweight',
      buttonText: button.textContent?.trim()
    }).catch(() => {});
    
    // 🎭 ПРОДВИНУТАЯ ИМИТАЦИЯ ЧЕЛОВЕКА для обхода защиты
    
    // 1. Имитируем чтение страницы перед действием
    const pageReadingTime = Math.random() * 1500 + 800; // 0.8-2.3 секунды чтения
    await new Promise(resolve => setTimeout(resolve, pageReadingTime));
    
    // 2. Имитируем движение мыши по странице (только для активных вкладок)
    if (isTabActive) {
      for (let i = 0; i < 2; i++) {
        const randomX = Math.random() * window.innerWidth;
        const randomY = Math.random() * window.innerHeight;
        
        const mouseMoveEvent = new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: randomX,
          clientY: randomY
        });
        document.dispatchEvent(mouseMoveEvent);
        
        await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 200));
      }
    }
    
    // 3. Прокрутка к кнопке (работает везде)
    try {
      const scrollBehavior = isTabActive ? 'smooth' : 'auto';
      button.scrollIntoView({ behavior: scrollBehavior, block: 'center' });
      
      const scrollWait = isTabActive ? 400 : 100;
      await new Promise(resolve => setTimeout(resolve, scrollWait));
    } catch (e) {
      console.warn('Scroll failed:', e);
    }
    
    // 4. Дополнительная пауза после скролла
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
    
    // 1. Универсальная задержка "размышления" (работает везде)
    const thinkingDelay = isTabActive ? 
      (Math.random() * 1000 + 500) :  // 0.5-1.5 сек для активной
      (Math.random() * 300 + 200);    // 0.2-0.5 сек для неактивной
    
    await new Promise(resolve => setTimeout(resolve, thinkingDelay));

    // 2. Прокрутка к кнопке (работает везде)
    try {
      const scrollBehavior = isTabActive ? 'smooth' : 'auto';
      button.scrollIntoView({ behavior: scrollBehavior, block: 'center' });
      
      const scrollWait = isTabActive ? 500 : 100;
      await new Promise(resolve => setTimeout(resolve, scrollWait));
    } catch (e) {
      console.warn('Scroll failed:', e);
    }

    // 3. Имитация визуального взаимодействия
    if (isTabActive) {
      // 🖱️ ПОЛНАЯ ИМИТАЦИЯ для активной вкладки
      
      try {
        const rect = button.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // 🎯 РЕАЛИСТИЧНОЕ ПРИБЛИЖЕНИЕ К КНОПКЕ
        
        // Начинаем с точки рядом с кнопкой
        const startX = centerX + (Math.random() - 0.5) * 100;
        const startY = centerY + (Math.random() - 0.5) * 100;
        
        // Имитируем постепенное приближение к кнопке (3 шага)
        const steps = 3;
        for (let i = 0; i < steps; i++) {
          const progress = (i + 1) / steps;
          const currentX = startX + (centerX - startX) * progress;
          const currentY = startY + (centerY - startY) * progress;
          
          const mouseMoveEvent = new MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: currentX + (Math.random() - 0.5) * 3, // Небольшой джиттер
            clientY: currentY + (Math.random() - 0.5) * 3
          });
          document.dispatchEvent(mouseMoveEvent);
          
          // Человеческая задержка между движениями
          await new Promise(resolve => setTimeout(resolve, 80 + Math.random() * 120));
        }
        
        // Финальное позиционирование на кнопке
        const finalMouseMove = new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: centerX,
          clientY: centerY
        });
        document.dispatchEvent(finalMouseMove);
        
        // Пауза перед hover (как человек прицеливается)
        await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 250));
        
        // Наведение на кнопку
        const mouseEnterEvent = new MouseEvent('mouseenter', {
          bubbles: false,
          cancelable: true,
          view: window,
          clientX: centerX,
          clientY: centerY
        });
        button.dispatchEvent(mouseEnterEvent);
        
        // Hover эффект
        const mouseOverEvent = new MouseEvent('mouseover', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: centerX,
          clientY: centerY
        });
        button.dispatchEvent(mouseOverEvent);
        
        // Имитация чтения кнопки
        const buttonText = button.textContent?.trim() || '';
        const readingTime = Math.max(buttonText.length * 30, 200); // 30ms на символ, минимум 200ms
        await new Promise(resolve => setTimeout(resolve, readingTime));
        
        // 🎯 ИМИТАЦИЯ ПРИНЯТИЯ РЕШЕНИЯ
        const decisionTime = Math.random() * 400 + 200; // 200-600ms на принятие решения
        await new Promise(resolve => setTimeout(resolve, decisionTime));

        // Focus на кнопку
        try {
          button.focus();
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (e) {
          console.warn('Focus failed:', e);
        }
        
        // Логируем успешную имитацию
        logger.success('ContentScript', 'Mouse simulation completed', {
          url: window.location.href,
          mouseEvents: ['mousemove', 'mouseenter', 'mouseover'],
          focusSuccess: true,
          buttonCoords: { x: centerX, y: centerY },
          approachSteps: steps,
          readingTime: readingTime,
          decisionTime: decisionTime
        }).catch(() => {});
        
      } catch (error) {
        // Логируем ошибку имитации
        logger.error('ContentScript', 'Mouse simulation failed', {
          url: window.location.href,
          error: error instanceof Error ? error.message : String(error)
        }).catch(() => {});
      }
    } else {
      // ⚡ ЛЕГКАЯ ИМИТАЦИЯ для неактивной вкладки
      
      try {
        // Имитируем "чтение" кнопки через анализ текста
        const buttonText = button.textContent?.trim() || '';
        const readingTime = Math.max(buttonText.length * 10, 100); // 10ms на символ, минимум 100ms
        await new Promise(resolve => setTimeout(resolve, readingTime));
        
        // Имитируем focus через программные события (работают в фоне)
        let focusSuccess = false;
        try {
          const focusEvent = new FocusEvent('focus', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          button.dispatchEvent(focusEvent);
          await new Promise(resolve => setTimeout(resolve, 50));
          focusSuccess = true;
        } catch (e) {
          console.warn('Focus event failed:', e);
        }
        
        // Имитируем hover через CSS классы (если возможно)
        let hoverSuccess = false;
        try {
          button.classList.add('hover', 'focus-visible');
          await new Promise(resolve => setTimeout(resolve, 100));
          button.classList.remove('hover', 'focus-visible');
          hoverSuccess = true;
        } catch (e) {
          // Игнорируем ошибки CSS классов
        }
        
        // Логируем успешную легкую имитацию
        logger.success('ContentScript', 'Lightweight simulation completed', {
          url: window.location.href,
          buttonText: buttonText,
          readingTime: readingTime,
          focusSuccess: focusSuccess,
          hoverSuccess: hoverSuccess,
          textLength: buttonText.length
        }).catch(() => {});
        
      } catch (error) {
        // Логируем ошибку легкой имитации
        logger.error('ContentScript', 'Lightweight simulation failed', {
          url: window.location.href,
          error: error instanceof Error ? error.message : String(error)
        }).catch(() => {});
      }
    }

    console.log('🤖 Human simulation complete, starting click sequence...');

    // 4. УНИВЕРСАЛЬНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ КЛИКОВ (работает везде)
    let clickSuccess = false;
    const clickResults: string[] = [];

    // 🎲 РАНДОМИЗАЦИЯ ПОРЯДКА МЕТОДОВ для обхода детекции паттернов
    const clickMethods = [
      { name: 'realistic_mouse', weight: isTabActive ? 3 : 1 },
      { name: 'direct_click', weight: 2 },
      { name: 'keyboard_enter', weight: 2 },
      { name: 'programmatic_click', weight: 1 }
    ];
    
    // Перемешиваем методы случайным образом
    const shuffledMethods = clickMethods
      .sort(() => Math.random() - 0.5)
      .filter(() => Math.random() > 0.3); // Иногда пропускаем некоторые методы
    
    // Случайная задержка перед началом кликов
    const preClickDelay = Math.random() * 300 + 100;
    await new Promise(resolve => setTimeout(resolve, preClickDelay));

    // 🔍 ДИАГНОСТИКА: Логируем начальное состояние
    logger.warning('ContentScript', 'DIAGNOSTIC: Starting click sequence', {
      url: window.location.href,
      buttonText: button.textContent?.trim(),
      buttonClasses: button.className,
      buttonDisabled: button.hasAttribute('disabled'),
      buttonAriaDisabled: button.getAttribute('aria-disabled'),
      shuffledMethods: shuffledMethods.map(m => m.name),
      tabActive: isTabActive
    }).catch(() => {});

    for (const method of shuffledMethods) {
      // Случайная задержка между методами
      const methodDelay = Math.random() * 200 + 50;
      await new Promise(resolve => setTimeout(resolve, methodDelay));
      
      if (method.name === 'realistic_mouse' && isTabActive) {
        // Method 1: Реалистичная последовательность событий (только для активных)
        try {
          const rect = button.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          
          // 🎯 БОЛЕЕ РЕАЛИСТИЧНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ
          
          // Имитируем колебания перед кликом (как человек прицеливается)
          for (let i = 0; i < 2; i++) {
            const jitterX = centerX + (Math.random() - 0.5) * 4;
            const jitterY = centerY + (Math.random() - 0.5) * 4;
            
            const jitterMove = new MouseEvent('mousemove', {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: jitterX,
              clientY: jitterY
            });
            document.dispatchEvent(jitterMove);
            
            await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 50));
          }
          
          // Финальное позиционирование
          const finalX = centerX + (Math.random() - 0.5) * 2;
          const finalY = centerY + (Math.random() - 0.5) * 2;
          
          // Реалистичная последовательность с вариативными задержками
          const mouseDownDelay = Math.random() * 50;
          const mouseUpDelay = 80 + Math.random() * 120; // 80-200ms
          const clickDelay = 10 + Math.random() * 20;
          
          const mouseEvents = [
            { type: 'mousedown', delay: mouseDownDelay },
            { type: 'mouseup', delay: mouseUpDelay },
            { type: 'click', delay: clickDelay }
          ];

          for (const eventConfig of mouseEvents) {
            await new Promise(resolve => setTimeout(resolve, eventConfig.delay));
            
            const event = new MouseEvent(eventConfig.type, {
              bubbles: true,
              cancelable: true,
              view: window,
              button: 0,
              buttons: eventConfig.type === 'mousedown' ? 1 : 0,
              clientX: finalX,
              clientY: finalY,
              screenX: finalX + window.screenX,
              screenY: finalY + window.screenY
            });
            
            button.dispatchEvent(event);
          }
          
          clickResults.push('Realistic mouse: SUCCESS');
          clickSuccess = true;
        } catch (error) {
          clickResults.push(`Realistic mouse: FAILED - ${error}`);
        }
      } else if (method.name === 'direct_click') {
        // Method 2: Direct click с человеческой задержкой
        try {
          const delay = isTabActive ? (150 + Math.random() * 250) : (75 + Math.random() * 125);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Добавляем небольшое движение мыши перед кликом
          if (isTabActive) {
            const rect = button.getBoundingClientRect();
            const moveEvent = new MouseEvent('mousemove', {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: rect.left + rect.width / 2 + (Math.random() - 0.5) * 2,
              clientY: rect.top + rect.height / 2 + (Math.random() - 0.5) * 2
            });
            document.dispatchEvent(moveEvent);
            await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30));
          }
          
          button.click();
          clickResults.push('Direct click: SUCCESS');
          clickSuccess = true;
        } catch (error) {
          clickResults.push(`Direct click: FAILED - ${error}`);
        }
      } else if (method.name === 'keyboard_enter') {
        // Method 3: Keyboard activation с реалистичными задержками
        try {
          const keyDelay = isTabActive ? (60 + Math.random() * 80) : (30 + Math.random() * 40);
          await new Promise(resolve => setTimeout(resolve, keyDelay));
          
          // Имитируем нажатие клавиши как человек
          const enterDownEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          });
          button.dispatchEvent(enterDownEvent);
          
          // Человеческая задержка между keydown и keyup
          const keyHoldTime = isTabActive ? (60 + Math.random() * 140) : (40 + Math.random() * 60);
          await new Promise(resolve => setTimeout(resolve, keyHoldTime));
          
          const enterUpEvent = new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          });
          button.dispatchEvent(enterUpEvent);
          
          clickResults.push('Keyboard Enter: SUCCESS');
          clickSuccess = true;
        } catch (error) {
          clickResults.push(`Keyboard Enter: FAILED - ${error}`);
        }
      } else if (method.name === 'programmatic_click') {
        // Method 4: Программный клик через dispatchEvent (запасной)
        try {
          const delay = isTabActive ? (40 + Math.random() * 60) : (20 + Math.random() * 30);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          const clickEvent = new Event('click', {
            bubbles: true,
            cancelable: true
          });
          button.dispatchEvent(clickEvent);
          
          clickResults.push('Programmatic click: SUCCESS');
          clickSuccess = true;
        } catch (error) {
          clickResults.push(`Programmatic click: FAILED - ${error}`);
        }
      }
      
      // 🎲 Случайная пауза между методами (имитация человеческого поведения)
      if (shuffledMethods.indexOf(method) < shuffledMethods.length - 1) {
        const betweenMethodsDelay = Math.random() * 100 + 50;
        await new Promise(resolve => setTimeout(resolve, betweenMethodsDelay));
      }
    }

    console.log('📊 Click attempt summary:', clickResults);

    if (clickSuccess) {
      // 🔍 ДИАГНОСТИКА: Логируем состояние после кликов
      const postClickButton = findBoostButton();
      const postClickActive = postClickButton ? isButtonActive() : false;
      const postClickPageText = document.body.textContent?.toLowerCase() || '';
      
      logger.warning('ContentScript', 'DIAGNOSTIC: Post-click state', {
        url: window.location.href,
        clickResults: clickResults,
        postClickButtonFound: !!postClickButton,
        postClickButtonActive: postClickActive,
        postClickButtonText: postClickButton?.textContent?.trim(),
        postClickButtonClasses: postClickButton?.className,
        pageTextLength: postClickPageText.length,
        hasSuccessKeywords: {
          успешно: postClickPageText.includes('успешно'),
          обновлено: postClickPageText.includes('обновлено'),
          поднято: postClickPageText.includes('поднято')
        }
      }).catch(() => {});

      // Логируем успешный клик с детальной аналитикой
      logger.success('ContentScript', 'Button click attempts completed', {
        url: window.location.href,
        buttonText: button.textContent?.trim(),
        methods: clickResults,
        tabActive: isTabActive,
        simulationType: isTabActive ? 'full' : 'lightweight',
        totalMethods: clickResults.length,
        successfulMethods: clickResults.filter(r => r.includes('SUCCESS')).length,
        failedMethods: clickResults.filter(r => r.includes('FAILED')).length
      }).catch(() => {});
      
      // 5. АДАПТИВНОЕ ОЖИДАНИЕ ОТВЕТА
      const waitTime = isTabActive ? 5000 : 3000; // Немного больше для фоновых вкладок
      
      // Имитируем человеческое ожидание с проверками
      const checkInterval = 500;
      const maxChecks = Math.floor(waitTime / checkInterval);
      let checksPerformed = 0;
      let buttonStateChanges = 0;
      let successIndicatorsFound: string[] = [];
      
      for (let i = 0; i < maxChecks; i++) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        checksPerformed++;
        
        // Проверяем изменения на странице
        const buttonAfterClick = findBoostButton();
        if (buttonAfterClick) {
          const isStillActive = isButtonActive();
          
          if (!isStillActive) {
            buttonStateChanges++;
            
            // 🔍 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: ждем и проверяем, не вернулась ли кнопка к активному состоянию
            await new Promise(resolve => setTimeout(resolve, 1500)); // Ждем 1.5 секунды
            
            const buttonAfterDelay = findBoostButton();
            const stillInactiveAfterDelay = buttonAfterDelay ? !isButtonActive() : false;
            
            if (stillInactiveAfterDelay) {
              // Логируем подтвержденное изменение состояния кнопки
              logger.success('ContentScript', 'Button state change confirmed - click successful', {
                url: window.location.href,
                checksPerformed: checksPerformed,
                waitTime: waitTime,
                simulationType: isTabActive ? 'full' : 'lightweight',
                detectionMethod: 'button_state_change_verified',
                stableInactiveTime: 1500
              }).catch(() => {});
              
              // Дополнительная небольшая задержка для завершения
              await new Promise(resolve => setTimeout(resolve, 500));
              return true;
            } else {
              // Логируем возврат кнопки к активному состоянию
              logger.warning('ContentScript', 'Button returned to active state - possible rollback', {
                url: window.location.href,
                checksPerformed: checksPerformed,
                simulationType: isTabActive ? 'full' : 'lightweight',
                detectionMethod: 'button_reactivation_detected',
                rollbackTime: 1500
              }).catch(() => {});
              
              // Продолжаем цикл ожидания
            }
          }
        }
        
        // Проверяем индикаторы успеха на странице
        const successIndicators = [
          'обновлено', 'поднято', 'успешно', 'updated', 'boosted', 'success'
        ];
        
        const pageText = document.body.textContent?.toLowerCase() || '';
        for (const indicator of successIndicators) {
          if (pageText.includes(indicator) && !successIndicatorsFound.includes(indicator)) {
            successIndicatorsFound.push(indicator);
            
            // 🔍 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: ждем еще немного и проверяем, не откатился ли результат
            await new Promise(resolve => setTimeout(resolve, 2000)); // Ждем 2 секунды
            
            // Проверяем, что кнопка все еще неактивна или индикатор все еще есть
            const buttonAfterDelay = findBoostButton();
            const pageTextAfterDelay = document.body.textContent?.toLowerCase() || '';
            const indicatorStillPresent = pageTextAfterDelay.includes(indicator);
            const buttonStillInactive = buttonAfterDelay ? !isButtonActive() : false;
            
            if (indicatorStillPresent && buttonStillInactive) {
              // Логируем подтвержденный успех
              logger.success('ContentScript', 'Success confirmed after verification delay', {
                url: window.location.href,
                indicator: indicator,
                indicatorStillPresent: indicatorStillPresent,
                buttonStillInactive: buttonStillInactive,
                checksPerformed: checksPerformed,
                waitTime: waitTime,
                simulationType: isTabActive ? 'full' : 'lightweight',
                detectionMethod: 'success_indicator_verified'
              }).catch(() => {});
              
              return true;
            } else {
              // Логируем откат результата
              logger.warning('ContentScript', 'Success indicator disappeared - possible rollback detected', {
                url: window.location.href,
                indicator: indicator,
                indicatorStillPresent: indicatorStillPresent,
                buttonStillInactive: buttonStillInactive,
                checksPerformed: checksPerformed,
                simulationType: isTabActive ? 'full' : 'lightweight',
                detectionMethod: 'rollback_detected'
              }).catch(() => {});
              
              // Продолжаем ожидание, возможно другие методы сработают
            }
          }
        }
      }
      
      // Логируем результаты ожидания
      logger.warning('ContentScript', 'Intelligent waiting completed', {
        url: window.location.href,
        checksPerformed: checksPerformed,
        maxChecks: maxChecks,
        waitTime: waitTime,
        buttonStateChanges: buttonStateChanges,
        successIndicatorsFound: successIndicatorsFound,
        simulationType: isTabActive ? 'full' : 'lightweight'
      }).catch(() => {});
      
      // 🔍 ФИНАЛЬНАЯ ПРОВЕРКА: анализируем общее состояние страницы
      
      const finalButton = findBoostButton();
      const finalButtonActive = finalButton ? isButtonActive() : false;
      const finalPageText = document.body.textContent?.toLowerCase() || '';
      
      // Проверяем дополнительные индикаторы
      const additionalSuccessIndicators = [
        'резюме обновлено',
        'резюме поднято', 
        'поднято в поиске',
        'обновление прошло успешно',
        'resume updated',
        'resume boosted'
      ];
      
      const foundAdditionalIndicators: string[] = [];
      for (const indicator of additionalSuccessIndicators) {
        if (finalPageText.includes(indicator)) {
          foundAdditionalIndicators.push(indicator);
        }
      }
      
      // Проверяем изменения в URL (некоторые сайты добавляют параметры успеха)
      const urlChanged = window.location.href !== window.location.href.split('?')[0];
      const hasSuccessParams = window.location.href.includes('success') || 
                              window.location.href.includes('updated') ||
                              window.location.href.includes('boosted');
      
      // Итоговая оценка успеха
      const successScore = 
        (foundAdditionalIndicators.length > 0 ? 2 : 0) +
        (successIndicatorsFound.length > 0 ? 2 : 0) +
        (!finalButtonActive ? 1 : 0) +
        (buttonStateChanges > 0 ? 1 : 0) +
        (hasSuccessParams ? 1 : 0);
      
      // 🚨 КРИТИЧЕСКАЯ ПРОВЕРКА: если кнопка вернулась в активное состояние после изменений - это rollback!
      const rollbackDetected = buttonStateChanges > 0 && finalButtonActive;
      
      // Если rollback детектирован - это автоматически провал, независимо от других индикаторов
      const isLikelySuccessful = !rollbackDetected && successScore >= 3;
      
      // 🔍 ДИАГНОСТИКА: Детальная финальная проверка
      logger.warning('ContentScript', 'DIAGNOSTIC: Final analysis details', {
        url: window.location.href,
        finalButton: {
          found: !!finalButton,
          active: finalButtonActive,
          text: finalButton?.textContent?.trim(),
          classes: finalButton?.className,
          disabled: finalButton?.hasAttribute('disabled'),
          ariaDisabled: finalButton?.getAttribute('aria-disabled')
        },
        pageAnalysis: {
          textLength: finalPageText.length,
          hasSuccessKeywords: {
            успешно: finalPageText.includes('успешно'),
            обновлено: finalPageText.includes('обновлено'),
            поднято: finalPageText.includes('поднято'),
            'резюме обновлено': finalPageText.includes('резюме обновлено'),
            'резюме поднято': finalPageText.includes('резюме поднято'),
            'поднято в поиске': finalPageText.includes('поднято в поиске')
          }
        },
        scoring: {
          foundAdditionalIndicators: foundAdditionalIndicators,
          successIndicatorsFound: successIndicatorsFound,
          finalButtonActive: finalButtonActive,
          buttonStateChanges: buttonStateChanges,
          hasSuccessParams: hasSuccessParams,
          rollbackDetected: rollbackDetected,
          successScore: successScore,
          threshold: 3,
          isLikelySuccessful: isLikelySuccessful
        },
        urlInfo: {
          current: window.location.href,
          urlChanged: urlChanged,
          hasSuccessParams: hasSuccessParams
        }
      }).catch(() => {});
      
      if (isLikelySuccessful) {
        logger.success('ContentScript', 'Final analysis indicates likely success', {
          url: window.location.href,
          successScore: successScore,
          foundAdditionalIndicators: foundAdditionalIndicators,
          successIndicatorsFound: successIndicatorsFound,
          finalButtonActive: finalButtonActive,
          buttonStateChanges: buttonStateChanges,
          hasSuccessParams: hasSuccessParams,
          rollbackDetected: rollbackDetected,
          urlChanged: urlChanged,
          simulationType: isTabActive ? 'full' : 'lightweight',
          detectionMethod: 'comprehensive_analysis'
        }).catch(() => {});
        
        return true;
      } else {
        logger.warning('ContentScript', 'Final analysis indicates likely failure', {
          url: window.location.href,
          successScore: successScore,
          foundAdditionalIndicators: foundAdditionalIndicators,
          successIndicatorsFound: successIndicatorsFound,
          finalButtonActive: finalButtonActive,
          buttonStateChanges: buttonStateChanges,
          hasSuccessParams: hasSuccessParams,
          rollbackDetected: rollbackDetected,
          urlChanged: urlChanged,
          simulationType: isTabActive ? 'full' : 'lightweight',
          detectionMethod: rollbackDetected ? 'rollback_failure' : 'comprehensive_analysis'
        }).catch(() => {});
        
        return false;
      }
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
