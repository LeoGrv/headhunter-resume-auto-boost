// Ручной тест кнопки - выполните в консоли DevTools
console.log('=== РУЧНОЙ ТЕСТ КНОПКИ ===');

// Находим кнопку
const button = document.querySelector('button[data-qa="resume-update-button"]');
console.log('Найдена кнопка:', button);

if (button) {
  console.log('Текст кнопки:', button.textContent?.trim());
  console.log('Disabled:', button.disabled);
  console.log('Classes:', button.className);
  
  // Проверяем, видима ли кнопка
  const rect = button.getBoundingClientRect();
  console.log('Размеры кнопки:', rect);
  console.log('Видима:', rect.width > 0 && rect.height > 0);
  
  // Пытаемся нажать
  console.log('Пытаемся нажать кнопку...');
  
  try {
    // Метод 1: Простой клик
    button.click();
    console.log('✅ Простой клик выполнен');
    
    // Ждем 2 секунды и проверяем изменения
    setTimeout(() => {
      const buttonAfter = document.querySelector('button[data-qa="resume-update-button"]');
      if (buttonAfter) {
        console.log('Состояние кнопки после клика:');
        console.log('- Текст:', buttonAfter.textContent?.trim());
        console.log('- Disabled:', buttonAfter.disabled);
        console.log('- Classes:', buttonAfter.className);
      }
      
      // Проверяем, появились ли уведомления об успехе
      const notifications = document.querySelectorAll('[class*="notification"], [class*="toast"], [class*="alert"], [class*="message"]');
      console.log('Уведомления на странице:', notifications);
      
      // Проверяем изменения в тексте страницы
      const pageText = document.body.textContent?.toLowerCase() || '';
      const successWords = ['обновлено', 'поднято', 'успешно', 'updated', 'boosted'];
      const foundSuccess = successWords.filter(word => pageText.includes(word));
      console.log('Найдены слова успеха:', foundSuccess);
      
    }, 2000);
    
  } catch (error) {
    console.error('❌ Ошибка при клике:', error);
  }
  
  // Метод 2: События мыши
  try {
    console.log('Пытаемся через события мыши...');
    
    const mouseEvents = ['mousedown', 'mouseup', 'click'];
    mouseEvents.forEach(eventType => {
      const event = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window
      });
      button.dispatchEvent(event);
    });
    
    console.log('✅ События мыши отправлены');
  } catch (error) {
    console.error('❌ Ошибка с событиями мыши:', error);
  }
  
} else {
  console.log('❌ Кнопка не найдена');
}

console.log('=== КОНЕЦ РУЧНОГО ТЕСТА ==='); 