# 🐛 HeadHunter Resume Auto-Boost - Debugging Documentation

## 📋 Навигация по документации

### 🔍 Активные документы дебагинга
- **[Bug Tracking Log](./bug-tracking-log.md)** - Полный лог всех найденных и исправленных багов
- **[Timer System Debug](./timer-system-debug.md)** - Специфичные проблемы с системой таймеров
- **[Concurrent Processing Debug](./concurrent-processing-debug.md)** - Проблемы с параллельной обработкой
- **[Communication Debug](./communication-debug.md)** - Проблемы межкомпонентной связи
- **[Performance Debug](./performance-debug.md)** - Проблемы производительности

### 📊 Архивные документы
- **[Development History](../development/development-history.md)** - История разработки
- **[Execution Plans](../development/execution-plans.md)** - Планы выполнения задач

### 🏗️ Архитектурная документация
- **[System Architecture](../architecture/system-overview.md)** - Обзор архитектуры системы
- **[Component Interactions](../architecture/component-interactions.md)** - Взаимодействие компонентов

## 🚨 Критические баги (ИСПРАВЛЕНЫ)

### ✅ Bug #1-11: Все критические баги исправлены
- **Статус**: ✅ RESOLVED
- **Дата исправления**: 2024-05-27
- **Детали**: См. [bug-tracking-log.md](./bug-tracking-log.md)

## 🔧 Инструменты дебагинга

### Chrome DevTools
```javascript
// Проверка состояния Service Worker
chrome.runtime.getBackgroundPage((bg) => {
  console.log('Extension State:', bg.extensionState);
  console.log('Managed Tabs:', bg.managedTabs);
});

// Проверка Chrome Storage
chrome.storage.local.get(null, (data) => {
  console.log('Local Storage:', data);
});

chrome.storage.sync.get(null, (data) => {
  console.log('Sync Storage:', data);
});
```

### Логирование
- **Service Worker**: Подробные логи в консоли браузера
- **Content Script**: Логи на страницах резюме
- **Popup**: Логи в DevTools popup

### Мониторинг таймеров
```javascript
// Проверка активных алармов
chrome.alarms.getAll((alarms) => {
  console.log('Active Alarms:', alarms);
});
```

## 📝 Процесс дебагинга

1. **Воспроизведение бага**
2. **Сбор логов** из всех компонентов
3. **Анализ состояния** Chrome Storage
4. **Проверка таймеров** и алармов
5. **Тестирование исправления**
6. **Документирование** в соответствующем файле

## 🎯 Быстрые команды

```bash
# Сборка для дебагинга
npm run dev

# Сборка для продакшена
npm run build

# Проверка TypeScript
npm run lint

# Очистка dist
npm run clean
```

## 📞 Контакты для эскалации

- **Критические баги**: Немедленное исправление
- **Производительность**: Анализ и оптимизация
- **Новые фичи**: Планирование и реализация 