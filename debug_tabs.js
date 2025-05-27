// ДИАГНОСТИКА ОБНАРУЖЕНИЯ ТАБОВ - ЗАПУСТИТЬ В КОНСОЛИ БРАУЗЕРА
console.log('🔍 ДИАГНОСТИКА ОБНАРУЖЕНИЯ ТАБОВ НАЧАТА');

// Функция для проверки URL резюме (копия из расширения)
function isResumeUrl(url) {
  if (!url) {
    console.log('❌ URL пустой или undefined');
    return false;
  }

  const hasHttps = url.startsWith('https://');
  const hasHttp = url.startsWith('http://');
  const hasHhKz = url.includes('hh.kz/resume/');
  const hasHhRu = url.includes('hh.ru/resume/');

  const isValid = (hasHhKz || hasHhRu) && (hasHttps || hasHttp);

  console.log(`🔍 Проверка URL: ${url}`);
  console.log(`  - HTTPS: ${hasHttps}, HTTP: ${hasHttp}`);
  console.log(`  - HH.KZ resume: ${hasHhKz}, HH.RU resume: ${hasHhRu}`);
  console.log(`  - Результат: ${isValid ? '✅ ВАЛИДНЫЙ' : '❌ НЕ ВАЛИДНЫЙ'}`);

  return isValid;
}

// Проверка текущего URL
console.log('\n📍 ПРОВЕРКА ТЕКУЩЕГО URL:');
const currentUrl = window.location.href;
console.log('Текущий URL:', currentUrl);
const isCurrentValid = isResumeUrl(currentUrl);
console.log('Текущий URL валидный для резюме:', isCurrentValid ? '✅ ДА' : '❌ НЕТ');

// Проверка через Chrome API (если доступно)
if (typeof chrome !== 'undefined' && chrome.tabs) {
  console.log('\n🔍 ПРОВЕРКА ЧЕРЕЗ CHROME TABS API:');
  
  // Метод 1: Все табы
  chrome.tabs.query({}, (allTabs) => {
    console.log(`📋 Найдено ${allTabs.length} табов всего`);
    
    const resumeTabs = allTabs.filter(tab => {
      if (!tab.url || tab.id === undefined) return false;
      const isValidTab = !tab.discarded && tab.status !== 'unloaded';
      const isResume = isResumeUrl(tab.url);
      return isResume && isValidTab;
    });
    
    console.log(`🎯 Найдено ${resumeTabs.length} табов с резюме:`);
    resumeTabs.forEach((tab, index) => {
      console.log(`  ${index + 1}. ${tab.title} (ID: ${tab.id})`);
      console.log(`     URL: ${tab.url}`);
      console.log(`     Status: ${tab.status}, Discarded: ${tab.discarded}`);
    });
    
    if (resumeTabs.length === 0) {
      console.log('❌ НЕ НАЙДЕНО ТАБОВ С РЕЗЮМЕ!');
      console.log('\n🔍 АНАЛИЗ ВСЕХ HH ТАБОВ:');
      
      const hhTabs = allTabs.filter(tab => 
        tab.url && (tab.url.includes('hh.kz') || tab.url.includes('hh.ru'))
      );
      
      console.log(`📋 Найдено ${hhTabs.length} HH табов:`);
      hhTabs.forEach((tab, index) => {
        console.log(`  ${index + 1}. ${tab.title}`);
        console.log(`     URL: ${tab.url}`);
        console.log(`     Содержит /resume/: ${tab.url.includes('/resume/')}`);
        console.log(`     Status: ${tab.status}, Discarded: ${tab.discarded}`);
      });
    }
  });
  
  // Метод 2: Текущее окно
  chrome.tabs.query({currentWindow: true}, (windowTabs) => {
    console.log(`\n📋 В текущем окне ${windowTabs.length} табов`);
    
    const resumeTabsWindow = windowTabs.filter(tab => {
      if (!tab.url || tab.id === undefined) return false;
      const isValidTab = !tab.discarded && tab.status !== 'unloaded';
      const isResume = isResumeUrl(tab.url);
      return isResume && isValidTab;
    });
    
    console.log(`🎯 В текущем окне ${resumeTabsWindow.length} табов с резюме`);
  });
  
} else {
  console.log('❌ Chrome Tabs API недоступно');
}

// Проверка состояния расширения
if (typeof chrome !== 'undefined' && chrome.runtime) {
  console.log('\n🔍 ПРОВЕРКА СОСТОЯНИЯ РАСШИРЕНИЯ:');
  
  chrome.runtime.sendMessage({type: 'GET_EXTENSION_STATE'}, (response) => {
    if (chrome.runtime.lastError) {
      console.log('❌ Ошибка связи с расширением:', chrome.runtime.lastError);
    } else {
      console.log('✅ Ответ от расширения:', response);
      
      if (response && response.data && response.data.managedTabs) {
        console.log(`📋 Расширение управляет ${response.data.managedTabs.length} табами:`);
        response.data.managedTabs.forEach((tab, index) => {
          console.log(`  ${index + 1}. ${tab.title} (ID: ${tab.tabId})`);
          console.log(`     State: ${tab.state}`);
          console.log(`     URL: ${tab.url}`);
        });
      } else {
        console.log('❌ Расширение не управляет табами');
      }
    }
  });
  
  // Принудительное обновление списка табов
  chrome.runtime.sendMessage({type: 'REFRESH_TABS'}, (response) => {
    console.log('🔄 Результат принудительного обновления табов:', response);
  });
  
} else {
  console.log('❌ Chrome Runtime API недоступно');
}

console.log('\n🏁 ДИАГНОСТИКА ЗАВЕРШЕНА');
console.log('📝 Если табы не обнаруживаются:');
console.log('1. Убедитесь, что URL содержит hh.kz/resume/ или hh.ru/resume/');
console.log('2. Проверьте, что таб не заморожен (discarded: false)');
console.log('3. Проверьте, что таб загружен (status: complete)');
console.log('4. Перезагрузите расширение в chrome://extensions/'); 