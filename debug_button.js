// Скрипт для диагностики кнопки обновления резюме
// Выполните этот код в консоли DevTools на странице резюме HH.kz

console.log('=== ДИАГНОСТИКА КНОПКИ ОБНОВЛЕНИЯ РЕЗЮМЕ ===');

// 1. Проверяем, загружен ли content script
console.log('1. Content script загружен:', !!window.resumeBoosterLoaded);

// 2. Ищем кнопку по data-qa атрибуту
const buttonByDataQa = document.querySelector('button[data-qa="resume-update-button"]');
console.log('2. Кнопка по data-qa:', buttonByDataQa);

// 3. Ищем все кнопки на странице
const allButtons = Array.from(document.querySelectorAll('button')).map(btn => ({
  text: btn.textContent?.trim(),
  dataQa: btn.getAttribute('data-qa'),
  className: btn.className,
  disabled: btn.disabled,
  element: btn
}));
console.log('3. Все кнопки на странице:', allButtons);

// 4. Ищем кнопки с текстом "Поднять" или "Обновить"
const boostButtons = Array.from(document.querySelectorAll('button, a')).filter(btn => 
  btn.textContent?.includes('Поднять') || 
  btn.textContent?.includes('Обновить') ||
  btn.textContent?.includes('поднять') ||
  btn.textContent?.includes('обновить')
);
console.log('4. Кнопки с текстом поднять/обновить:', boostButtons);

// 5. Ищем по классам
const buttonsByClass = Array.from(document.querySelectorAll('[class*="resume"], [class*="boost"], [class*="update"]')).filter(el => 
  el.tagName === 'BUTTON' || el.tagName === 'A'
);
console.log('5. Кнопки по классам:', buttonsByClass);

// 6. Проверяем все элементы с onclick
const clickableElements = Array.from(document.querySelectorAll('[onclick], [role="button"]'));
console.log('6. Кликабельные элементы:', clickableElements);

// 7. Пытаемся найти кнопку функцией из content script (если загружен)
if (window.resumeBoosterLoaded) {
  try {
    // Эмулируем поиск кнопки как в content script
    const exactTextMatches = [
      'Поднять в поиске',
      'Поднять резюме', 
      'Поднять',
      'Обновить резюме',
      'Обновить'
    ];

    let foundButton = null;
    for (const exactText of exactTextMatches) {
      const allElements = document.querySelectorAll('button, a, [role="button"]');
      for (let i = 0; i < allElements.length; i++) {
        const element = allElements[i];
        const elementText = element.textContent?.trim() || '';
        
        if (elementText === exactText || elementText.includes(exactText)) {
          foundButton = element;
          console.log(`7. Найдена кнопка по тексту "${exactText}":`, element);
          break;
        }
      }
      if (foundButton) break;
    }
    
    if (!foundButton) {
      console.log('7. Кнопка не найдена по точному тексту');
    }
  } catch (error) {
    console.error('7. Ошибка при поиске кнопки:', error);
  }
}

// 8. Проверяем URL страницы
console.log('8. URL страницы:', window.location.href);
console.log('9. Заголовок страницы:', document.title);

console.log('=== КОНЕЦ ДИАГНОСТИКИ ==='); 