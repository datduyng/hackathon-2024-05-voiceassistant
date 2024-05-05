const { ipcRenderer } = require("electron");

let mediaRecorder;
let audioChunks = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

ipcRenderer.on("send-vision-response-to-windows", (event, visionResponse) => {
  console.log("on [send-vision-response-to-windows]", visionResponse);
  updateWindowMessage(visionResponse);
});

ipcRenderer.on("send-question-to-windows", (event, questionText) => {
  console.log("on [send-question-to-windows]", visionResponse);
  updateWindowMessage(`${questionText} ... thinking...`);
});

// This code initializes the media recorder and performs a short 1-second audio recording as a workaround for an issue where the first audio recording doesn't work on some machines.
ipcRenderer.on("init-mediaRecorder", async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.start();
  sleep(1);
  mediaRecorder.stop();
});

ipcRenderer.on('run-example-response', async (event, exampleResponse) => {
  console.log("on [run-example-response]", exampleResponse);
  updateWindowMessage(JSON.stringify(exampleResponse, null, 2));
});

ipcRenderer.on("start-recording", async () => {
  try {
    updateWindowMessage("Recording in progress...");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream); // Use the broader scoped mediaRecorder
    audioChunks = []; // Reset audioChunks for a new recording

    mediaRecorder.addEventListener("dataavailable", (event) => {
      audioChunks.push(event.data);
    });

    mediaRecorder.addEventListener("stop", async () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
      const arrayBuffer = await audioBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Send the buffer to the main process
      ipcRenderer.send("audio-buffer", buffer);
    });

    mediaRecorder.start();
  } catch (error) {
    console.error("Error accessing the microphone", error);
    updateWindowMessage("Failed to record microphone...");
  }
});

ipcRenderer.on("stop-recording", () => {
  updateWindowMessage("Processing...");

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
});

ipcRenderer.on("add-window-name-to-app", (event, windowName) => {
  const analysisContainer = document.getElementById("analysis");

  // Create a new section for this window
  const windowSection = document.createElement("div");
  windowSection.className = "window-section";

  const title = document.createElement("h3");
  title.textContent = `${windowName}`;
  windowSection.appendChild(title);

  const message = document.createElement("div");
  message.className = "window-message";
  windowSection.appendChild(message);

  if (analysisContainer.firstChild) {
    analysisContainer.insertBefore(windowSection, analysisContainer.firstChild);
  } else {
    analysisContainer.appendChild(windowSection);
  }
});

function updateWindowMessage(message) {
  const latestWindowSection = document.querySelector(".window-section");
  if (latestWindowSection) {
    const messageDiv = latestWindowSection.querySelector(".window-message");
    if (messageDiv) {
      messageDiv.textContent = message;
    }
  }
}
