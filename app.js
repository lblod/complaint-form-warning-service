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

app.use(errorHandler);

// Internal logic

/**
 * Checks if emails related to complaints have been sent during the business day until now
 */
async function checkSentEmails() {
  try {
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

      console.log(
        `Complaint emails that have been sent today: ${numberOfSentEmails}`,
      );
      if (numberOfSentEmails === 0) await que.createWarningEmail(taskUri);

      await que.updateStatus(jobUri, env.STATUS_SUCCESS);
      await que.updateStatus(taskUri, env.STATUS_SUCCESS);
    } catch (taskErr) {
      const taskErrMsg = `An error occurred when checking emails: ${taskErr.message}`;
      console.error(taskErrMsg);
      const errUri = await que.sendErrorAlert(
        taskErrMsg,
        taskErr.message,
        taskUri,
        jobUri,
      );
      await que.updateStatus(jobUri, env.STATUS_FAILED, errUri);
      await que.updateStatus(taskUri, env.STATUS_FAILED, errUri);
    }
  } catch (generalError) {
    const generalErrorMsg =
      'A general error prevented the start of a Job or Task for checking sent complaint emails.';
    console.error(generalErrorMsg);
    await que.sendErrorAlert(generalErrorMsg, generalError.message);
  }
}
