var http = require("http");
const url = require("url");

const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config();

let taskQueue = [];
let isProcessingQueue = false;

function show_error(resource, name, email) {
  console.log("Starting show_error...");
  const processingTime = 1000 * 60; // 60 seconds
  // simulate processing, by delaying for processingTime microseconds
  const retval = new Promise((resolve) => {
    setTimeout(() => {
      resolve("show_error");
    }, processingTime);
  });
  console.log("Ending show_error.");
  return retval;
}

function use_resource(resource, name, email) {
  console.log("Starting use_resource...");
  const processingTime = 1000 * 60; // 60 seconds
  // simulate processing, by delaying for processingTime microseconds
  const retval = new Promise((resolve) => {
    setTimeout(() => {
      resolve("use_resource");
    }, processingTime);
  });
  console.log("Ending use_resource.");
  return retval;
}

function get_profile(resource, name, email) {
  console.log("Starting get_profile...");
  const processingTime = 1000 * 60; // 60 seconds
  // simulate processing, by delaying for processingTime microseconds
  const retval = new Promise((resolve) => {
    setTimeout(() => {
      resolve("get_profile");
    }, processingTime);
  });
  console.log("Ending get_profile.");
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
        const result = await func(...args);
        taskResolve(result); // Resolve the task's promise with the result
      } catch (error) {
        console.log("Error processing task: ", error);
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
      console.log("Beginning the processing of request...");
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
      if (pathname === "/") {
        func = use_resource;
      }
      if (pathname === "/profile") {
        func = get_profile;
      }
      // Wrap the task in a promise to wait for its completion
      const taskPromise = new Promise((resolve, reject) => {
        taskQueue.push({
          func, // This is the function to call
          args: [resource, name, email], // Arguments for the function
          resolve,
          reject,
        });
        if (!isProcessingQueue) {
          processQueue()
            .then(() => {
              console.log("Queue processed");
            })
            .catch((error) => {
              console.error("Queue processing error: ", error);
            });
        }
      });
      // Add the request to the queue
      try {
        const ret = await taskPromise; // Wait for the task to complete
        if (ret) {
          console.log("Success! ", ret);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ret }));
          return;
        } else {
          console.log("Failure: ");
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("Error: Invalid");
          return;
        }
      } catch (error) {
        console.log("Error processing request: ", error);
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end("Error: Invalid");
      }
    })
    .listen(8083);
  console.log("Server is running on port 8083");
}

async function setup_resource() {
  let err = null;
  let resource = true;

  const setupDelay = 1000 * 5; // 5 seconds
  // sleep for setupDelay microseconds
  console.log("Setting up resource...");
  await new Promise((resolve) => setTimeout(resolve, setupDelay));
  console.log("Resource set up complete.");
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
  console.log("SERVER IS RUNNING...");
}

main().catch(console.error); // Start the main function and log errors
