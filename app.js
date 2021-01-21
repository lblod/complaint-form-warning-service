import { app, query, errorHandler } from 'mu';
import { CronJob } from 'cron';
import { FIRST_CHECK_CRON, SECOND_CHECK_CRON } from './config';
import { STATUS_BUSY, STATUS_SUCCESS, STATUS_FAILED } from './constants';
import {
  createJob,
  createTask,
  updateStatus,
  getNumberOfSentEmailSince,
  createWarningEmail,
  addError
} from './queries';

app.get('/', function( req, res ) {
  res.send('Hello from complaint-form-warning :)');
} );

// Cron jobs

new CronJob(FIRST_CHECK_CRON, async function() {
  const now = new Date().toISOString();
  console.log(`First check triggered by cron job at ${now}`);
  try {
    await checkSentEmails();
  } catch (err) {
    console.log(`An error occured during first check at ${now}: ${err}`)
  }
}, null, true, "Europe/Brussels");

new CronJob(SECOND_CHECK_CRON, async function() {
  const now = new Date().toISOString();
  console.log(`Second check triggered by cron job at ${now}`);
  try {
    await checkSentEmails();
  } catch (err) {
    console.log(`An error occured during first check at ${now}: ${err}`)
  }
}, null, true, "Europe/Brussels");

// Internal logic

/**
 * Checks if emails related to complains have been sent during the business day until now
 */
async function checkSentEmails() {
  const jobUri = await createJob();
  const taskUri = await createTask(jobUri);
  try {
    await updateStatus(jobUri, STATUS_BUSY);
    await updateStatus(taskUri, STATUS_BUSY);

    const now = new Date();
    const startOfBusinessDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0); // today at 8h
    const numberOfSentEmails = await getNumberOfSentEmailSince(startOfBusinessDay);

    console.log(`${numberOfSentEmails} complaint emails have been sent today.`);
    if (numberOfSentEmails == 0) {
      throw 'test error :p';
      await createWarningEmail(taskUri);
    }

    await updateStatus(jobUri, STATUS_SUCCESS);
    await updateStatus(taskUri, STATUS_SUCCESS);
  } catch (err) {
    console.log(`An error occured when checking emails: ${err}`);
    await addError(jobUri, err);
    await updateStatus(jobUri, STATUS_FAILED);
    await updateStatus(taskUri, STATUS_FAILED);
  }
}

app.use(errorHandler);
