import * as env from './env';
import * as que from './queries';
import { app, errorHandler } from 'mu';
import { CronJob } from 'cron';

app.get('/', function (req, res) {
  res.send('Hello from complaint-form-warning :)');
});

// Cron jobs

new CronJob(
  env.FIRST_CHECK_CRON,
  async function () {
    const now = new Date().toISOString();
    console.log(`First check triggered by cron job at ${now}`);
    try {
      await checkSentEmails();
    } catch (err) {
      console.log(`An error occurred during first check at ${now}: ${err}`);
    }
  },
  null,
  true,
  'Europe/Brussels',
);

new CronJob(
  env.SECOND_CHECK_CRON,
  async function () {
    const now = new Date().toISOString();
    console.log(`Second check triggered by cron job at ${now}`);
    try {
      await checkSentEmails();
    } catch (err) {
      console.log(`An error occurred during first check at ${now}: ${err}`);
    }
  },
  null,
  true,
  'Europe/Brussels',
);

// Internal logic

/**
 * Checks if emails related to complains have been sent during the business day until now
 */
async function checkSentEmails() {
  const jobUri = await que.createJob();
  const taskUri = await que.createTask(jobUri);
  try {
    await que.updateStatus(jobUri, env.STATUS_BUSY);
    await que.updateStatus(taskUri, env.STATUS_BUSY);

    const now = new Date();
    const startOfBusinessDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      8,
      0,
      0,
    ); // today at 8h
    const numberOfSentEmails =
      await que.getNumberOfSentEmailSince(startOfBusinessDay);

    console.log(`${numberOfSentEmails} complaint emails have been sent today.`);
    if (numberOfSentEmails === 0) {
      await que.createWarningEmail(taskUri);
    }

    await que.updateStatus(jobUri, env.STATUS_SUCCESS);
    await que.updateStatus(taskUri, env.STATUS_SUCCESS);
  } catch (err) {
    console.log(`An error occurred when checking emails: ${err}`);
    await que.addError(jobUri, err);
    await que.updateStatus(jobUri, env.STATUS_FAILED);
    await que.updateStatus(taskUri, env.STATUS_FAILED);
  }
}

app.use(errorHandler);
