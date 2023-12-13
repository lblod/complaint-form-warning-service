import * as env from './env';
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import {
  sparqlEscapeString,
  sparqlEscapeUri,
  sparqlEscapeDateTime,
  uuid,
} from 'mu';

/**
 * Creates a new job in the store
 */
export async function createJob() {
  const jobUuid = uuid();
  const jobUri = `${env.JOB_URI_PREFIX}${jobUuid}`;
  const now = new Date().toISOString();

  const q = `
    ${env.PREFIXES}
    INSERT DATA {
      GRAPH ${sparqlEscapeUri(env.JOB_GRAPH)} {
        ${sparqlEscapeUri(jobUri)} a ${sparqlEscapeUri(env.JOB_TYPE)} ;
          mu:uuid ${sparqlEscapeString(jobUuid)} ;
          dct:creator ${sparqlEscapeUri(env.SERVICE_NAME)} ;
          dct:created ${sparqlEscapeDateTime(now)} ;
          dct:modified ${sparqlEscapeDateTime(now)} ;
          task:operation ${sparqlEscapeUri(env.JOB_OPERATION)} ;
          adms:status ${sparqlEscapeUri(env.STATUS_SCHEDULED)} .
      }
    }
  `;
  await update(q);
  return jobUri;
}

/**
 * Creates a new task linked to a job in the store
 */
export async function createTask(jobUri) {
  const taskUuid = uuid();
  const taskUri = `${env.TASK_URI_PREFIX}${taskUuid}`;
  const now = new Date().toISOString();

  const q = `
    ${env.PREFIXES}
    INSERT DATA {
      GRAPH ${sparqlEscapeUri(env.JOB_GRAPH)} {
        ${sparqlEscapeUri(taskUri)} a ${sparqlEscapeUri(env.TASK_TYPE)} ;
          mu:uuid ${sparqlEscapeString(taskUuid)} ;
          dct:created ${sparqlEscapeDateTime(now)} ;
          dct:modified ${sparqlEscapeDateTime(now)} ;
          task:operation ${sparqlEscapeUri(env.CHECK_SENT_EMAILS_OPERATION)} ;
          task:index ${sparqlEscapeString('0')} ;
          dct:isPartOf ${sparqlEscapeUri(jobUri)} ;
          adms:status ${sparqlEscapeUri(env.STATUS_SCHEDULED)} .
      }
    }
  `;
  await update(q);
  return taskUri;
}

/**
 * Updates the status of the given resource
 */
export async function updateStatus(uri, status) {
  const q = `
    ${env.PREFIXES}
    DELETE {
      GRAPH ?g {
        ${sparqlEscapeUri(uri)} adms:status ?status .
      }
    }
    INSERT {
      GRAPH ?g {
        ${sparqlEscapeUri(uri)} adms:status ${sparqlEscapeUri(status)} .
      }
    }
    WHERE {
      GRAPH ?g {
        ${sparqlEscapeUri(uri)} adms:status ?status .
      }
    }
  `;
  await update(q);
}

/**
 * Gets the number of complaint emails sent since the given time
 */
export async function getNumberOfSentEmailSince(time) {
  const q = `
    ${env.PREFIXES}
    SELECT DISTINCT ?email
    WHERE {
      GRAPH ?g {
        ?email a nmo:Email ;
          nmo:sentDate ?sentDate .
      }
      GRAPH ?h {
        ?complaint ext:isConvertedIntoEmail ?email .
      }
      FILTER (STR(?sentDate) >= STR(${sparqlEscapeDateTime(time)}))
    }
  `;

  const result = await query(q);
  return result.results.bindings.length;
}

/**
 * Creates a warning email in the store and put it in the outbox
 */
export async function createWarningEmail(taskUri) {
  const containerUuid = uuid();
  const containerUri = `${env.CONTAINER_URI_PREFIX}${containerUuid}`;
  const emailUuid = uuid();
  const emailUri = `${env.EMAIL_URI_PREFIX}${emailUuid}`;
  const now = new Date().toISOString();

  const q = `
    ${env.PREFIXES}
    INSERT DATA {
      GRAPH ${sparqlEscapeUri(env.JOB_GRAPH)} {
        ${sparqlEscapeUri(taskUri)}
          task:resultsContainer
            ${sparqlEscapeUri(containerUri)} .
        ${sparqlEscapeUri(containerUri)}
          task:hasEmail
            ${sparqlEscapeUri(emailUri)} .
      }
      GRAPH ${sparqlEscapeUri(env.EMAIL_GRAPH)} {
        ${sparqlEscapeUri(emailUri)} a nmo:Email ;
          mu:uuid ${sparqlEscapeString(emailUuid)} ;
          nmo:messageFrom ${sparqlEscapeString(env.EMAIL_FROM)} ;
          nmo:emailTo ${sparqlEscapeString(env.EMAIL_TO)} ;
          nmo:messageSubject ${sparqlEscapeString(env.WARNING_EMAIL_SUBJECT)} ;
          nmo:plainTextMessageContent
            ${sparqlEscapeString(env.WARNING_EMAIL_TEXT)} ;
          nmo:htmlMessageContent ${sparqlEscapeString(env.WARNING_EMAIL_HTML)} ;
          nmo:sentDate ${sparqlEscapeDateTime(now)} ;
          nmo:isPartOf ${sparqlEscapeUri(env.OUTBOX)} .
      }
    }
  `;
  await update(q);
}

/**
 * Adds an error resource to the given job
 */
export async function addError(jobUri, error) {
  const errorUuid = uuid();
  const errorUri = `${env.ERROR_URI_PREFIX}${errorUuid}`;

  const q = `
    ${env.PREFIXES}
    INSERT DATA {
      GRAPH ${sparqlEscapeUri(env.JOB_GRAPH)} {
        ${sparqlEscapeUri(jobUri)} task:error ${sparqlEscapeUri(errorUri)} .
        ${sparqlEscapeUri(errorUri)} a oslc:Error ;
          mu:uuid ${sparqlEscapeString(errorUuid)} ;
          oslc:message ${sparqlEscapeString(error)} .
      }
    }
  `;
  await update(q);
}
