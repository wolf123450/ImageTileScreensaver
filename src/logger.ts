import * as winston from 'winston';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Define log directory - use user's home directory
const logDir = path.join(os.homedir(), '.image-tile-screensaver', 'logs');

// Create log directory if it doesn't exist
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, 'screensaver.log');

// Configure winston
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}${info.data ? ' ' + JSON.stringify(info.data) : ''}`)
    ),
    transports: [
        // Write to console in development mode
        ...(process.env.NODE_ENV === 'development' ? [
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple()
                )
            })
        ] : []),
        // Always write to file
        new winston.transports.File({ 
            filename: logFile,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        })
    ]
});

// Helper function to log with data object
function logWithData(level: string, message: string, data?: any) {
    if (data) {
        logger.log({ level, message, data });
    } else {
        logger.log({ level, message });
    }
}

export default {
    debug: (message: string, data?: any) => logWithData('debug', message, data),
    info: (message: string, data?: any) => logWithData('info', message, data),
    warn: (message: string, data?: any) => logWithData('warn', message, data),
    error: (message: string, data?: any) => logWithData('error', message, data),
    getLogPath: () => logFile
};
