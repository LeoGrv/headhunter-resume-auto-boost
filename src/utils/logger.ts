// Logger utility for critical events and errors
export interface LogEntry {
  timestamp: string;
  level: 'ERROR' | 'CRITICAL' | 'SUCCESS' | 'WARNING';
  component: string;
  message: string;
  data?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 500; // Ограничиваем количество логов
  private storageKey = 'extension_error_logs';

  async log(level: LogEntry['level'], component: string, message: string, data?: any): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data: data ? JSON.stringify(data).substring(0, 2000) : undefined // Ограничиваем размер данных
    };

    this.logs.push(entry);

    // Ограничиваем количество логов в памяти
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Сохраняем в storage
    try {
      await chrome.storage.local.set({
        [this.storageKey]: this.logs
      });
    } catch (error) {
      console.error('Failed to save logs to storage:', error);
    }

    // Также выводим в консоль для отладки
    const logMessage = `[${level}] ${component}: ${message}`;
    switch (level) {
      case 'ERROR':
      case 'CRITICAL':
        console.error(logMessage, data);
        break;
      case 'WARNING':
        console.warn(logMessage, data);
        break;
      case 'SUCCESS':
        console.log(logMessage, data);
        break;
    }
  }

  async getLogs(): Promise<LogEntry[]> {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      return result[this.storageKey] || [];
    } catch (error) {
      console.error('Failed to get logs from storage:', error);
      return [];
    }
  }

  async clearLogs(): Promise<void> {
    try {
      this.logs = [];
      await chrome.storage.local.remove([this.storageKey]);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  async exportLogs(): Promise<string> {
    const logs = await this.getLogs();
    return logs.map(log => 
      `${log.timestamp} [${log.level}] ${log.component}: ${log.message}${log.data ? ` | Data: ${log.data}` : ''}`
    ).join('\n');
  }

  // Методы для удобства
  async error(component: string, message: string, data?: any): Promise<void> {
    return this.log('ERROR', component, message, data);
  }

  async critical(component: string, message: string, data?: any): Promise<void> {
    return this.log('CRITICAL', component, message, data);
  }

  async success(component: string, message: string, data?: any): Promise<void> {
    return this.log('SUCCESS', component, message, data);
  }

  async warning(component: string, message: string, data?: any): Promise<void> {
    return this.log('WARNING', component, message, data);
  }
}

export const logger = new Logger(); 