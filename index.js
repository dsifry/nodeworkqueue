var http = require("http");
const url = require("url");

const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config();
var log = require("console-log-level")({
  prefix: function (level) {
    return new Date().toISOString();
  },
  level: "debug",
});

let taskQueue = [];
let isProcessingQueue = false;

async function favicon(resource) {
  log.debug("favicon: STARTING...");
  resource.log.push({ cmd: "favicon", params: null });
  log.debug("favicon: END.");
  retval = { type: "img/png", body: "" };
  return retval;
}

async function show_error(resource, queryParams) {
  log.debug("show_error: STARTING...");
  resource.log.push({ cmd: "show_error", params: queryParams });
  const processingTime = 1000 * 0; // 0 seconds
  // simulate processing, by delaying for processingTime microseconds
  const body = await new Promise((resolve) => {
    setTimeout(() => {
      resolve(resource);
    }, processingTime);
  });
  log.debug("show_error: END.");
  const retval = { type: "application/html", body };
  return retval;
}

async function use_resource(resource) {
  log.debug("use_resource STARTING...");
  resource.log.push({ cmd: "use_resource", params: null });
  const processingTime = 1000 * 10; // 10 seconds
  // simulate processing, by delaying for processingTime microseconds
  log.debug("use_resource: Resource: ", resource);
  log.debug("use_resource: Incrementing shared_number...");
  resource.shared_number += 1;
  const body = await new Promise((resolve) => {
    setTimeout(() => {
      resolve(resource);
    }, processingTime);
  });
  log.debug("use_resource: END.");
  const retval = { type: "application/json", body: JSON.stringify({ body }) };
  return retval;
}

async function get_profile(resource, name, email) {
  log.debug("get_profile: STARTING...");
  resource.log.push({ cmd: "get_profile", params: { name, email } });
  const processingTime = 1000 * 30; // 30 seconds
  log.debug("get_profile: Incrementing shared_number...");
  resource.shared_number += 10;
  // simulate processing, by delaying for processingTime microseconds
  const body = await new Promise((resolve) => {
    setTimeout(() => {
      resolve(resource);
    }, processingTime);
  });
  log.debug("get_profile: Incrementing shared_number...");
  resource.shared_number += 10;
  log.debug("get_profile: END.");
  const retval = { type: "application/json", body: JSON.stringify({ body }) };
  return retval;
}

function processQueue() {
  return new Promise(async (resolve, reject) => {
    if (taskQueue.length === 0) {
      resolve(); // Resolve immediately if there are no tasks
      return;
    }

    isProcessingQueue = true;
    while (taskQueue.length > 0) {
      const {
        func,
        args,
        resolve: taskResolve,
        reject: taskReject,
      } = taskQueue.shift();
      try {
        // Dynamically call the function with its arguments
        log.debug("processQueue: Before calling func: ", func);
        const result = await func(...args);
        log.debug("processQueue: Successful result: ", result);
        taskResolve(result); // Resolve the task's promise with the result
      } catch (error) {
        log.debug("processQueue: Error processing task: ", error);
        taskReject(error); // Reject the task's promise in case of an error
      }
    }
    isProcessingQueue = false;
    resolve(); // Ensure the promise is resolved once the queue is empty
  });
}

function startServer(resource) {
  http
    .createServer(async function (req, res) {
      log.debug("createServer: Beginning the processing of request...");
      // Parse the request URL
      const parsedUrl = url.parse(req.url, true); // true to get query as object

      // Extract query parameters
      const queryParams = parsedUrl.query;

      // Define the allowed character pattern
      const pattern = /^[a-zA-Z0-9-]+$/;
      const route = parsedUrl.pathname;
      let profile = queryParams.profile;
      const name = queryParams.name;
      const email = queryParams.email;
      const pathname = parsedUrl.pathname;

      let func = show_error;
      let args = [resource, queryParams];
      if (pathname === "/favicon.ico") {
        func = favicon;
        args = [resource];
      }
      if (pathname === "/") {
        func = use_resource;
        args = [resource];
      }
      if (pathname === "/profile") {
        func = get_profile;
        args = [resource, name, email];
      }
      log.debug("createServer: pathname: ", pathname);
      // Wrap the task in a promise to wait for its completion
      const runProcessQueuePromise = new Promise((resolve, reject) => {
        taskQueue.push({
          func, // This is the function to call
          args, // Arguments for the function
          resolve,
          reject,
        });
        if (!isProcessingQueue) {
          log.debug(
            "runProcessQueuePromise: Before running processQueue: ",
            resource
          );
          processQueue()
            .then(() => {
              log.debug("runProcessQueuePromise: Queue processed");
              log.debug(
                "runProcessQueuePromise: After processQueue run: ",
                resource
              );
            })
            .catch((error) => {
              console.error(
                "runProcessQueuePromise: Queue processing error: ",
                error
              );
            });
        }
      });
      // Add the request to the queue
      let ret = null;
      log.debug("createServer: Right before await taskPromise...");
      log.debug("createServer: Resource: ", resource);
      try {
        ret = await runProcessQueuePromise; // Wait for the task to complete
        log.debug("createServer: Right after await runProcessQueuePromise...");
        log.debug("createServer: Resource: ", resource);
        if (ret && ret.type && ret.body !== null) {
          log.debug("createServer: Success! ", ret);
          res.writeHead(200, { "Content-Type": ret.type });
          const body = ret.body;
          res.end(body);
          return;
        } else {
          log.debug("createServer: Failure: ");
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("Error: Invalid");
          return;
        }
      } catch (error) {
        log.debug("createServer: Error processing request: ", error);
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end("Error: Invalid");
        return;
      }
    })
    .listen(8083);
  log.debug("Server is running on port 8083");
}

async function setup_resource() {
  let err = null;
  let resource = {
    setup_complete: false,
    shared_info: "some shared info...",
    shared_number: 1,
    log: [],
  };

  const setupDelay = 1000 * 5; // 5 seconds
  // sleep for setupDelay microseconds
  log.debug("Setting up resource...");
  await new Promise((resolve) => {
    setTimeout(resolve, setupDelay);
    resource.log.push({ cmd: "setup_resource", params: null });
  });
  resource.setup_complete = true;
  log.debug("Resource set up complete.");
  log.debug("Resource: ", resource);
  return { err, resource };
}

async function main() {
  const { err, resource } = await setup_resource();
  if (err) {
    console.error("Error setting up resource: ", err);
    // TODO: Put in some retry logic.
    return;
  }
  startServer(resource); // Start the HTTP server after the browser is ready
  log.debug("SERVER IS RUNNING...");
}

main().catch(console.error); // Start the main function and log errors
