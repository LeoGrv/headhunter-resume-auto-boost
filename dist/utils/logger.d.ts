export interface LogEntry {
    timestamp: string;
    level: 'ERROR' | 'CRITICAL' | 'SUCCESS' | 'WARNING';
    component: string;
    message: string;
    data?: any;
}
declare class Logger {
    private logs;
    private maxLogs;
    private storageKey;
    log(level: LogEntry['level'], component: string, message: string, data?: any): Promise<void>;
    getLogs(): Promise<LogEntry[]>;
    clearLogs(): Promise<void>;
    exportLogs(): Promise<string>;
    error(component: string, message: string, data?: any): Promise<void>;
    critical(component: string, message: string, data?: any): Promise<void>;
    success(component: string, message: string, data?: any): Promise<void>;
    warning(component: string, message: string, data?: any): Promise<void>;
}
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map