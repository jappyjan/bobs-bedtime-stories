// noinspection ExceptionCaughtLocallyJS

const { join } = require('path');

const workspaceRootDir = join(__dirname, '..', '..', '..');

function log(msg) {
  process.send({
    type: 'log',
    payload: msg,
  });
}

function consoleLog(...args) {
  log(args.map((arg) => JSON.stringify(arg, null, 4)).join(', '));
}

console.log = consoleLog.bind(this);
console.error = consoleLog.bind(this);
console.warn = consoleLog.bind(this);
console.info =consoleLog.bind(this);
console.debug = consoleLog.bind(this);

function sendResult(eventId, data) {
  process.send({
    type: 'result',
    payload: data,
    eventId,
  });
}

process.on('message', async (data) => {
  log(`Received message: ${JSON.stringify(data)}`);
  try {
    switch (data.type) {
      case 'execute':
        log(`Executing event ${data.eventId}`);
        return await execute(data.eventId, data.payload);

      default:
        throw new Error(`Unknown action: ${JSON.stringify({ data })}`);
    }
  } catch (e) {
    log(`Message processing failed: ${e.message}`);
    log(e);
    throw e;
  }
});

async function execute(eventId, params) {
  const { event, config } = params;

  // compare process memory in MB usage with config.memory every 100ms and exit process if it is too high
  setInterval(() => {
    const memoryUsage = process.memoryUsage().rss / 1024 / 1024;
    if (memoryUsage > config.memory) {
      log(`Memory usage is too high: ${memoryUsage}MB, exiting...`);
      sendResult(eventId, {
        error: `Memory usage is too high: ${memoryUsage}MB, exiting...`,
      });
    }
  }, 100);

  try {
    const [handlerFileName, handlerFunctionName] = config.handler.split('.');
    const handlerFilePath = join(
      workspaceRootDir,
      config.codePath,
      handlerFileName
    );

    log(`Loading handler file: "${handlerFilePath}"`);
    const handlerFile = require(handlerFilePath);

    log(`Invoking handler function: "${handlerFunctionName}"`);
    const handler = handlerFile[handlerFunctionName];

    if (typeof handler !== 'function') {
      throw new Error(`Handler is not a function`);
    }

    const promise = handler(event, {}, (error, result) => {
      log('handler called callback, sending result...');
      sendResult(eventId, { result, error });
    });


    if (typeof promise.then === 'function') {
      log(`Waiting for handler to finish...`);
      await promise
        .then((result) => {
          log('handler promise resolved, sending result...');
          sendResult(eventId, { result });
        })
        .catch((error) => {
          log('handler promise rejected, returning error...');
          sendResult(eventId, { error });
        });
    }
  } catch (e) {
    log(`Error while executing handler: ${e.message}`);
    log(JSON.stringify({
      name: e.name,
      message: e.message,
      stack: e.stack,
    }));
    sendResult(eventId, { error: e });
  }
}
