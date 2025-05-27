// НЕМЕДЛЕННАЯ ДИАГНОСТИКА - ЗАПУСТИТЬ В КОНСОЛИ БРАУЗЕРА
console.log('🚨 НЕМЕДЛЕННАЯ ДИАГНОСТИКА НАЧАТА');

// 1. Проверяем текущую страницу
console.log('📍 Текущий URL:', window.location.href);
console.log('📍 Это резюме?', window.location.href.includes('/resume/'));

// 2. Проверяем наличие кнопки "Поднять в поиске"
const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
console.log('🔍 Всего кнопок на странице:', buttons.length);

// Ищем кнопку поднятия
const boostButtons = buttons.filter(btn => {
  const text = btn.textContent || btn.innerText || '';
  return text.includes('Поднять') || text.includes('поднять') || text.includes('Boost');
});

console.log('🎯 Найдено кнопок поднятия:', boostButtons.length);
boostButtons.forEach((btn, i) => {
  console.log(`  ${i + 1}. "${btn.textContent?.trim()}" - ${btn.tagName} - ${btn.className}`);
  console.log(`     Видимая: ${btn.offsetWidth > 0 && btn.offsetHeight > 0}`);
  console.log(`     Disabled: ${btn.disabled}`);
});

// 3. Проверяем content script
console.log('🔧 Проверяем content script...');
if (window.resumeBoosterLoaded) {
  console.log('✅ Content script загружен');
} else {
  console.log('❌ Content script НЕ загружен');
}

// 4. Проверяем сообщения от background script
let messageReceived = false;
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Получено сообщение:', message);
  messageReceived = true;
  
  if (message.type === 'BOOST_RESUME') {
    console.log('🎯 Получен запрос на поднятие резюме');
    
    // Пробуем найти и кликнуть кнопку
    const button = document.querySelector('[data-qa="resume-update-button"], button:contains("Поднять")');
    if (button) {
      console.log('✅ Кнопка найдена, кликаем...');
      button.click();
      sendResponse({ success: true, message: 'Button clicked successfully' });
    } else {
      console.log('❌ Кнопка НЕ найдена');
      sendResponse({ success: false, message: 'Button not found' });
    }
  }
});

// 5. Тестируем отправку сообщения в background
setTimeout(() => {
  console.log('📤 Тестируем связь с background script...');
  chrome.runtime.sendMessage({ type: 'TEST_MESSAGE' }, (response) => {
    if (chrome.runtime.lastError) {
      console.log('❌ Ошибка связи:', chrome.runtime.lastError);
    } else {
      console.log('✅ Связь работает:', response);
    }
  });
}, 1000);

// 6. Проверяем через 5 секунд получили ли сообщения
setTimeout(() => {
  if (!messageReceived) {
    console.log('❌ За 5 секунд НЕ получено ни одного сообщения от background script');
    console.log('🔧 Возможные причины:');
    console.log('   1. Content script не загружен');
    console.log('   2. Background script не работает');
    console.log('   3. Таймеры не настроены');
  }
}, 5000);

console.log('🚨 ДИАГНОСТИКА ЗАПУЩЕНА - ЖДИТЕ 5 СЕКУНД ДЛЯ ПОЛНЫХ РЕЗУЛЬТАТОВ'); 