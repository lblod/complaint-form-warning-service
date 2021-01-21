export const FIRST_CHECK_CRON = process.env.FIRST_CHECK_CRON || '0 0 14 * * 1-5'; // every weekday at 14h CET
export const SECOND_CHECK_CRON = process.env.SECOND_CHECK_CRON || '0 0 16 * * 1-5'; // every weekday at 16h CET

export const EMAIL_FROM = process.env.EMAIL_FROM;
export const EMAIL_TO = process.env.EMAIL_TO;
