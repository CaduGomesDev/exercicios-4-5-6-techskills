import winston from 'winston';

const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';

const SENSITIVE_FIELDS = ['password', 'senha', 'token', 'cardNumber', 'cartao', 'cpf'];

const serializeNestedErrors = winston.format((info) => {
  for (const [key, value] of Object.entries(info)) {
    if (value instanceof Error) {
      info[key] = { message: value.message, stack: value.stack };
    }
  }
  return info;
});

const redactSensitiveFields = winston.format((info) => {
  for (const field of SENSITIVE_FIELDS) {
    if (field in info) {
      info[field] = '[REDACTED]';
    }
  }
  return info;
});

const developmentFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
  const extra = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level}] ${message}${extra}`;
});

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    serializeNestedErrors(),
    redactSensitiveFields(),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), developmentFormat)
  ),
  transports: [new winston.transports.Console()],
});
