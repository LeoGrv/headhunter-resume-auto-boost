// Тест расширения - выполните в консоли DevTools
console.log('=== ТЕСТ РАСШИРЕНИЯ ===');

// 1. Проверяем, что content script загружен
if (window.resumeBoosterLoaded) {
  console.log('✅ Content script загружен');
  
  // 2. Отправляем тестовое сообщение
  chrome.runtime.sendMessage({type: 'TEST_MESSAGE'}, (response) => {
    console.log('2. Ответ на TEST_MESSAGE:', response);
  });
  
  // 3. Проверяем состояние кнопки
  chrome.runtime.sendMessage({type: 'CHECK_BUTTON_STATE'}, (response) => {
    console.log('3. Состояние кнопки:', response);
  });
  
  // 4. Пытаемся нажать кнопку
  chrome.runtime.sendMessage({type: 'BOOST_RESUME'}, (response) => {
    console.log('4. Результат нажатия кнопки:', response);
  });
  
} else {
  console.log('❌ Content script НЕ загружен');
  
  // Попробуем найти кнопку вручную
  const button = document.querySelector('button[data-qa="resume-update-button"]') ||
                 Array.from(document.querySelectorAll('button')).find(btn => 
                   btn.textContent?.includes('Поднять') || 
                   btn.textContent?.includes('Обновить')
                 );
  
  if (button) {
    console.log('✅ Кнопка найдена вручную:', button);
    console.log('Текст кнопки:', button.textContent?.trim());
    console.log('Disabled:', button.disabled);
    
    // Пытаемся нажать вручную
    try {
      button.click();
      console.log('✅ Кнопка нажата вручную');
    } catch (error) {
      console.error('❌ Ошибка при нажатии:', error);
    }
  } else {
    console.log('❌ Кнопка НЕ найдена даже вручную');
  }
}

console.log('=== КОНЕЦ ТЕСТА ==='); 