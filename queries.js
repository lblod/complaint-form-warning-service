import * as env from './env';
import * as mas from '@lblod/mu-auth-sudo';
import * as mu from 'mu';

/**
 * Creates a new job in the store
 */
export async function createJob() {
  const jobUuid = mu.uuid();
  const jobUri = `${env.JOB_URI_PREFIX}${jobUuid}`;
  const now = new Date().toISOString();

  const q = `
    ${env.PREFIXES}
    INSERT DATA {
      GRAPH ${mu.sparqlEscapeUri(env.JOB_GRAPH)} {
        ${mu.sparqlEscapeUri(jobUri)} a ${mu.sparqlEscapeUri(env.JOB_TYPE)} ;
          mu:uuid ${mu.sparqlEscapeString(jobUuid)} ;
          dct:creator ${mu.sparqlEscapeUri(env.SERVICE_NAME)} ;
          dct:created ${mu.sparqlEscapeDateTime(now)} ;
          dct:modified ${mu.sparqlEscapeDateTime(now)} ;
          task:operation ${mu.sparqlEscapeUri(env.JOB_OPERATION)} ;
          adms:status ${mu.sparqlEscapeUri(env.STATUS_SCHEDULED)} .
      }
    }
  `;
  await mas.updateSudo(q);
  return jobUri;
}

/**
 * Creates a new task linked to a job in the store
 */
export async function createTask(jobUri) {
  const taskUuid = mu.uuid();
  const taskUri = `${env.TASK_URI_PREFIX}${taskUuid}`;
  const now = new Date().toISOString();

  const q = `
    ${env.PREFIXES}
    INSERT DATA {
      GRAPH ${mu.sparqlEscapeUri(env.JOB_GRAPH)} {
        ${mu.sparqlEscapeUri(taskUri)} a ${mu.sparqlEscapeUri(env.TASK_TYPE)} ;
          mu:uuid ${mu.sparqlEscapeString(taskUuid)} ;
          dct:created ${mu.sparqlEscapeDateTime(now)} ;
          dct:modified ${mu.sparqlEscapeDateTime(now)} ;
          task:operation
            ${mu.sparqlEscapeUri(env.CHECK_SENT_EMAILS_OPERATION)} ;
          task:index ${mu.sparqlEscapeString('0')} ;
          dct:isPartOf ${mu.sparqlEscapeUri(jobUri)} ;
          adms:status ${mu.sparqlEscapeUri(env.STATUS_SCHEDULED)} .
      }
    }
  `;
  await mas.updateSudo(q);
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
        ${mu.sparqlEscapeUri(uri)} adms:status ?status .
      }
    }
    INSERT {
      GRAPH ?g {
        ${mu.sparqlEscapeUri(uri)} adms:status ${mu.sparqlEscapeUri(status)} .
      }
    }
    WHERE {
      GRAPH ?g {
        ${mu.sparqlEscapeUri(uri)} adms:status ?status .
      }
    }
  `;
  await mas.updateSudo(q);
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
      FILTER (STR(?sentDate) >= STR(${mu.sparqlEscapeDateTime(time)}))
    }
  `;

  const result = await mas.querySudo(q);
  return result.results.bindings.length;
}

/**
 * Creates a warning email in the store and put it in the outbox
 */
export async function createWarningEmail(taskUri) {
  const containerUuid = mu.uuid();
  const containerUri = `${env.CONTAINER_URI_PREFIX}${containerUuid}`;
  const emailUuid = mu.uuid();
  const emailUri = `${env.EMAIL_URI_PREFIX}${emailUuid}`;
  const now = new Date().toISOString();

  const q = `
    ${env.PREFIXES}
    INSERT DATA {
      GRAPH ${mu.sparqlEscapeUri(env.JOB_GRAPH)} {
        ${mu.sparqlEscapeUri(taskUri)}
          task:resultsContainer
            ${mu.sparqlEscapeUri(containerUri)} .
        ${mu.sparqlEscapeUri(containerUri)}
          task:hasEmail
            ${mu.sparqlEscapeUri(emailUri)} .
      }
      GRAPH ${mu.sparqlEscapeUri(env.EMAIL_GRAPH)} {
        ${mu.sparqlEscapeUri(emailUri)} a nmo:Email ;
          mu:uuid ${mu.sparqlEscapeString(emailUuid)} ;
          nmo:messageFrom ${mu.sparqlEscapeString(env.EMAIL_FROM)} ;
          nmo:emailTo ${mu.sparqlEscapeString(env.EMAIL_TO)} ;
          nmo:messageSubject
            ${mu.sparqlEscapeString(env.WARNING_EMAIL_SUBJECT)} ;
          nmo:plainTextMessageContent
            ${mu.sparqlEscapeString(env.WARNING_EMAIL_TEXT)} ;
          nmo:htmlMessageContent
            ${mu.sparqlEscapeString(env.WARNING_EMAIL_HTML)} ;
          nmo:sentDate ${mu.sparqlEscapeDateTime(now)} ;
          nmo:isPartOf ${mu.sparqlEscapeUri(env.OUTBOX)} .
      }
    }
  `;
  await mas.updateSudo(q);
}

/**
 * Stores an error and links to a given Job and/or Task
 */
export async function sendErrorAlert(message, detail, task, job) {
  const id = uuid();
  const uri = `${env.ERROR_URI_PREFIX}${id}`;
  const subject = 'Error - Complaint Form Warning Service';
  const referenceJobTriple = job
    ? `${mu.sparqlEscapeUri(uri)}
         dct:references ${mu.sparqlEscapeUri(job)} .`
    : '';
  const referenceTaskTriple = task
    ? `${mu.sparqlEscapeUri(uri)}
         dct:references ${mu.sparqlEscapeUri(task)} .`
    : '';
  const detailTriple = detail
    ? `${mu.sparqlEscapeUri(uri)}
         oslc:largePreview ${mu.sparqlEscapeString(detail)} .`
    : '';

  const insertErrorQuery = `
    ${env.PREFIXES}
    INSERT DATA {
      GRAPH ${mu.sparqlEscapeUri(env.ERROR_GRAPH)} {
        ${mu.sparqlEscapeUri(uri)}
          rdf:type oslc:Error ;
          mu:uuid ${mu.sparqlEscapeString(id)} ;
          dct:subject ${mu.sparqlEscapeString(subject)} ;
          oslc:message ${mu.sparqlEscapeString(message)} ;
          dct:created ${mu.sparqlEscapeDateTime(new Date().toISOString())} ;
          dct:creator ${mu.sparqlEscapeUri(env.creator)} .
        ${referenceJobTriple}
        ${referenceTaskTriple}
        ${detailTriple}
      }
    }`;
  try {
    await mas.updateSudo(insertErrorQuery);
    return uri;
  } catch (e) {
    console.error(
      `[ERROR] Something went wrong while trying to store an error.\nMessage: ${e}\nQuery: ${insertErrorQuery}`,
    );
    throw e;
  }
}
