import {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  globalShortcut,
  systemPreferences,
} from "electron";
import fs from "fs";
import path from "path";
import axios from "axios";
import OpenAI from "openai";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import FormData from "form-data";
import { exec } from "child_process";
import { activeWindow } from "get-windows";
import Store from "electron-store";
import { fileURLToPath } from 'url';

import { exampleMilvus } from "./examples/milvus.mjs";
import { exampleOctoAI } from "./examples/octoai.mjs";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename);

const store = new Store();
ffmpeg.setFfmpegPath(ffmpegStatic);

let openAiApiKey = store.get("userApiKey", "");
let openai = new OpenAI({
  apiKey: openAiApiKey,
});

const USE_ELECTRON_PACKAGE_MANAGER = false;
let tmpFileDir = USE_ELECTRON_PACKAGE_MANAGER
  ? path.join(app.getPath("userData"), ".voiceassistant-tmp")
  : path.join(__dirname, ".voiceassistant-tmp")

const appConfig = {
  isDev: true,
  storageKeys: {
    openaiKey: "openaiKey",
  },
  keyboardShortcut: "CommandOrControl+Shift+K",
  tmpFileDir,
  floatWindow: {
    width: 300,
    height: 100,
    opacity: 0.8,
  },
  mainWindow: {
    width: 600,
    height: 400,
  },
  micRecordingFilePath: path.join(tmpFileDir, "micAudio.raw"),
  mp3FilePath: path.join(tmpFileDir, "audioInput.mp3"),
  screenshotFilePath: path.join(tmpFileDir, "screenshot.png"),
  audioFilePath: path.join(tmpFileDir, "ttsResponse.mp3"),
}

let isRecording = false;
let mainWindow;
let floatingWindow;
let captureWindowStatus;

let conversationHistory = [
  {
    role: "system",
    content:
      "You are helping users with questions about their OSX applications based on screenshots, always answer in at most one sentence.",
  },
];

if (!fs.existsSync(appConfig.tmpFileDir)) {
  fs.mkdirSync(appConfig.tmpFileDir, { recursive: true });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: appConfig.mainWindow.width,
    height: appConfig.mainWindow.height,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: appConfig.isDev,
    },
  });
  mainWindow.loadFile("main-window.html");
  if (appConfig.isDev) mainWindow.webContents.openDevTools();
}
function createFloatingWindow() {
  floatingWindow = new BrowserWindow({
    width: appConfig.floatWindow.width,
    height: appConfig.floatWindow.height,
    frame: false,
    transparent: true, // Enable transparency
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: appConfig.isDev,
    },
    alwaysOnTop: true,
    skipTaskbar: true,
    x: 100,
    y: 100,
  });
  floatingWindow.setOpacity(appConfig.floatWindow.opacity);
  floatingWindow.loadFile("floating-window.html");
  if (appConfig.isDev) floatingWindow.webContents.openDevTools({
    mode: 'detach'
  });
}


ipcMain.on("run-example", async (event, payload) => {
  console.log("on [run-example]", payload);
  if (payload?.example === "milvus") {
    const response = await exampleMilvus(payload?.body);
    event.reply("run-example-response", response);
  } else if (payload?.example === "octoai") {
    const response = await exampleOctoAI(payload?.body);
    event.reply("run-example-response", response);
  } else {
    event.reply("run-example-response", "No example found");
  }
});

ipcMain.on("submit-api-key", (_, apiKey) => {
  console.log("API key submitted:", apiKey);
  store.set(appConfig.storageKeys.openaiKey, apiKey); // Directly saving the API key using electron-store
});

ipcMain.on("request-api-key", (event) => {
  const apiKey = store.get(appConfig.storageKeys.openaiKey, "");
  event.reply("send-api-key", apiKey);
});

ipcMain.handle("get-api-key", (event) => {
  return store.get(appConfig.storageKeys.openaiKey, "");
});

ipcMain.on("audio-buffer", (event, buffer) => {
  openAiApiKey = store.get(appConfig.storageKeys.openaiKey, "");
  openai = new OpenAI({
    apiKey: openAiApiKey,
  });

  // Save buffer to the temporary file
  fs.writeFile(appConfig.micRecordingFilePath, buffer, (err) => {
    if (err) {
      console.error("Failed to save temporary audio file:", err);
      return;
    }

    // Convert the temporary file to MP3 and send to Vision API
    try {
      ffmpeg(appConfig.micRecordingFilePath)
        .setFfmpegPath(ffmpegStatic)
        .audioBitrate(32)
        .toFormat("mp3")
        .on("error", (err) => {
          console.error("Error converting to MP3:", err);
        })
        .on("end", async () => {
          fs.unlink(appConfig.micRecordingFilePath, (err) => {
            if (err) console.error("Failed to delete temporary file:", err);
          });
          const transcribedText = await transcribeUserRecording(appConfig.mp3FilePath);
          if (transcribedText) {
            processInputs(appConfig.screenshotFilePath, transcribedText);
          }
          else {
            mainWindow.webContents.send(
              "send-vision-response-to-windows",
              "There was an error transcribing your recording"
            );

            updateNotificationWindowText(
              "There was an error transcribing your recording"
            );
          }
        })
        .save(appConfig.mp3FilePath);
    } catch (error) {
      console.log(error);
    }
  });
});

let inputMethod = store.get("inputMethod", "voice");
function updateNotificationWindowText(textToDisplay) {
  // If the window has been closed by the user, create a new one
  if (!floatingWindow) {
    createNotificationWindow();
  }
  floatingWindow.webContents.send(
    "update-floatingWindow-text",
    textToDisplay
  );
}

async function processInputs(screenshotFilePath, questionInput) {
  let visionApiResponse = await callVisionAPI(
    screenshotFilePath,
    questionInput
  );

  // If the Vision API response failed it will be null, set error message
  visionApiResponse =
    visionApiResponse ?? "There was an error calling the OpenAI Vision API";

  // Update both windows with the response text (refactor this)
  mainWindow.webContents.send(
    "send-vision-response-to-windows",
    visionApiResponse
  );
  updateNotificationWindowText(visionApiResponse);

  // Call function to generate and playback audio of the Vision API response
  await playVisionApiResponse(visionApiResponse);
}

async function captureWindow(windowName) {
  const sources = await desktopCapturer.getSources({
    types: ["window"],
    thumbnailSize: { width: 1920, height: 1080 },
  });
  // Not been able to use window IDs successfully, so have to rely on names
  const selectedSource = sources.find((source) => source.name === windowName);

  if (!selectedSource) {
    console.error("Window not found:", windowName);
    return "Window not found";
  }

  // Capture and save the thumbnail of the window
  const screenshot = selectedSource.thumbnail.toPNG();
  fs.writeFile(appConfig.screenshotFilePath, screenshot, async (err) => {
    if (err) {
      throw err;
    }
  });
  return "Window found";
}

async function transcribeUserRecording(mp3FilePath) {
  let response;
  try {
    const form = new FormData();

    form.append("file", fs.createReadStream(mp3FilePath));
    form.append("model", "whisper-1");
    form.append("response_format", "text");
    response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${openAiApiKey}`,
        },
      }
    );

    // Adding user's question to windows to give sense of progress
    updateNotificationWindowText(response.data);
    mainWindow.webContents.send("send-question-to-windows", response.data);

    return response.data;
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    return false;
  }
}

// Function to call the Vision API with the screenshot and transcription of the user question
async function callVisionAPI(inputScreenshot, audioInput) {
  const base64Image = fs.readFileSync(inputScreenshot).toString("base64");
  const dataUrl = `data:image/png;base64,${base64Image}`;
  const userMessage = {
    role: "user",
    content: [
      { type: "text", text: audioInput },
      {
        type: "image_url",
        image_url: {
          url: dataUrl,
        },
      },
    ],
  };

  conversationHistory.push(userMessage);

  try {
    const response = await openai.chat.completions.create({
      max_tokens: 850,
      model: "gpt-4-vision-preview",
      messages: conversationHistory,
    });

    const responseContent = response.choices[0].message.content;

    conversationHistory.push({
      role: "assistant",
      content: responseContent,
    });

    return responseContent;
  } catch (error) {
    console.log(error);
    // return null to show error message to user
    return null;
  }
}

// Function that takes text input, calls TTS API, and plays back the response audio
async function playVisionApiResponse(inputText) {
  const url = "https://api.openai.com/v1/audio/speech";
  const voice = "echo"; // you can change voice if you want
  const model = "tts-1";
  const headers = {
    Authorization: `Bearer ${openAiApiKey}`, // API key for authentication
  };

  const data = {
    model: model,
    input: inputText,
    voice: voice,
    response_format: "mp3",
  };

  try {
    const response = await axios.post(url, data, {
      headers: headers,
      responseType: "stream",
    });

    // Save the response stream to a file
    const writer = fs.createWriteStream(appConfig.audioFilePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    }).then(() => {
      // Play the audio file using a system command
      let playCommand;
      switch (process.platform) {
        case "darwin": // macOS
          playCommand = `afplay "${appConfig.audioFilePath}"`;
          break;
        default:
          console.error("Unsupported platform for audio playback");
          return;
      }

      exec(playCommand, (error) => {
        if (error) {
          console.error("Failed to play audio:", error);
        } else {
        }
      });
    });
  } catch (error) {
    if (error.response) {
      console.error(
        `Error with HTTP request: ${error.response.status} - ${error.response.statusText}`
      );
    } else {
      console.error(`Error in streamedAudio: ${error.message}`);
    }
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  // Unregister all shortcuts when the application is about to quit
  globalShortcut.unregisterAll();
});

// Close and nullify the notification window if it's closed by the user
ipcMain.on("close-notification-window", () => {
  if (floatingWindow) {
    floatingWindow.close();
    floatingWindow = null;
  }
});

app.whenReady().then(() => {
  createMainWindow();
  createFloatingWindow();

  // Request microphone access
  systemPreferences
    .askForMediaAccess("microphone")
    .then((accessGranted) => {
      if (accessGranted) {
        console.log("Microphone access granted");
      } else {
        console.log("Microphone access denied");
      }
    })
    .catch((err) => {
      console.error("Error requesting microphone access:", err);
    });

  // This call initializes MediaRecorder with an 1ms audio recording, to get around an issue seen on some machines where the first user-triggered recording doesn't work.
  mainWindow.webContents.send("init-mediaRecorder");

  // If defined keyboard shortcut is triggered then run
  globalShortcut.register(appConfig.keyboardShortcut, async () => {
    // If the microphone recording isn't already running
    if (!isRecording) {
      let activeWindowRef;
      try {
        activeWindowRef = await activeWindow();
        captureWindowStatus = await captureWindow(activeWindowRef.title);
        if (!floatingWindow) {
          createNotificationWindow();
        }
        // If captureWindow() can't find the selected window, show an error and exit the process
        if (captureWindowStatus != "Window found") {
          const responseMessage = "Unable to capture this window, try another.";
          mainWindow.webContents.send(
            "add-window-name-to-app",
            responseMessage
          );
          updateNotificationWindowText(responseMessage);
          return;
        }

        // If window is found, continue as expected
        const responseMessage = `${activeWindowRef.owner.name}: ${activeWindowRef.title}`;
        mainWindow.webContents.send("add-window-name-to-app", responseMessage);
        updateNotificationWindowText(responseMessage);
      } catch (error) {
        console.error("Error capturing the active window:", error);
      }
      // only start recording if the user is using voice input
      if (inputMethod == "voice") {
        mainWindow.webContents.send("start-recording");
        floatingWindow.webContents.send("start-recording");
        isRecording = true;
      }
      // If voice isn't used as input, trigger the text-based input
      else {
        if (!textInputWindow) {
          createTextInputWindow();
        }
        repositionWindow(activeWindowRef, "textInputWindow");
      }
    } else {
      // If we're already recording, the keyboard shortcut means we should stop
      mainWindow.webContents.send("stop-recording");
      floatingWindow.webContents.send("stop-recording");
      isRecording = false;
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});
