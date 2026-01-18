import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'login-errors.log');

export function logLoginError(message: string, meta?: any) {
    try {
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }

        const timestamp = new Date().toISOString();
        let logMessage = `[LOGIN-ERROR] [${timestamp}] ${message}`;

        if (meta) {
            if (meta instanceof Error) {
                logMessage += ` | Error: ${meta.message}\nStack: ${meta.stack}`;
            } else {
                try {
                    logMessage += ` | Meta: ${JSON.stringify(meta)}`;
                } catch (e) {
                    logMessage += ` | Meta: [Circular or Non-serializable]`;
                }
            }
        }

        logMessage += '\n';

        // Also log to console for immediate visibility
        console.error(logMessage);

        fs.appendFileSync(LOG_FILE, logMessage, 'utf8');
    } catch (error) {
        console.error('Failed to write to login error log:', error);
    }
}
