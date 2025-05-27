# 🚀 Quick Debugging Guide

## 📁 Документация организована!

Вся документация по дебагингу теперь структурирована в папке `docs/`:

### 🎯 Быстрый доступ
- **[Главный индекс](docs/README.md)** - Обзор всей документации
- **[Debugging README](docs/debugging/README.md)** - Навигация по дебагингу
- **[Bug Tracking Log](docs/debugging/bug-tracking-log.md)** - Все 11 исправленных багов
- **[Debugging Rules](.cursor/rules/debugging.mdc)** - Правила для эффективного дебагинга

## ⚡ Экстренная диагностика

### Chrome DevTools Commands
```javascript
// 1. Состояние расширения
chrome.runtime.getBackgroundPage(bg => console.log(bg.extensionState));

// 2. Управляемые вкладки
chrome.runtime.getBackgroundPage(bg => console.log(bg.managedTabs));

// 3. Chrome Storage
chrome.storage.local.get(null, console.log);

// 4. Активные алармы
chrome.alarms.getAll(console.log);

// 5. Принудительный перезапуск таймеров
chrome.runtime.getBackgroundPage(bg => bg.discoverAndManageTabs());
```

## 🔧 Быстрые команды

```bash
# Сборка для дебагинга
npm run dev

# Проверка TypeScript
npm run lint

# Очистка и пересборка
npm run clean && npm run build
```

## 📊 Статус проекта

- ✅ **11 критических багов исправлены**
- ✅ **16 задач TaskMaster выполнены**
- ✅ **Все компоненты протестированы**
- ✅ **Документация структурирована**

## 🎯 Следующие шаги

1. **Для новых багов**: Используйте [debugging rules](.cursor/rules/debugging.mdc)
2. **Для анализа**: Изучите [system architecture](docs/architecture/system-overview.md)
3. **Для истории**: Смотрите [development history](docs/development/development-history.md)

---
**Проект готов к использованию!** 🚀 