const { ipcRenderer } = require("electron");

let activeId = null;

ipcRenderer.on("add-window-name-to-app", (event, windowName) => {
  updateWindowMessage(`Window Selected: ${windowName}`);
});

ipcRenderer.on("stop-recording", () => {
  updateWindowMessage("Processing...");
});

ipcRenderer.on("send-question-to-windows", (event, questionText) => {
  console.log("Question sent to windows: ", questionText);
  updateWindowMessage(`${questionText} ... thinking...`);
});

ipcRenderer.on("start-recording", async () => {
  updateWindowMessage("Recording in progress...");
});

ipcRenderer.on("update-floatingWindow-text", (event, message) => {
  const data = JSON.parse(message);
  activeId = data.id ?? null;
  console.log("Working", data)
  updateWindowMessage(data.text);
});

document.getElementById("closeBtn").addEventListener("click", () => {
  ipcRenderer.send("close-notification-window");
});

function updateWindowMessage(message) {
  console.log("UPDATE WINDOW MSG:", message)
  const analysisContainer = document.getElementById("analysis");

  let messageDiv = analysisContainer.querySelector(".window-message");

  if (!messageDiv) {
    messageDiv = document.createElement("div");
    messageDiv.className = "window-message";
    analysisContainer.appendChild(messageDiv);
  }

  const btn = document.getElementById('save-skill')
  if (activeId) {
    btn.classList.remove("hidden")
  } else {
    btn.classList.add("hidden");
  }

  messageDiv.textContent = message ?? "";
}

function handleSaveSkill() {
  if (!activeId) return;
  ipcRenderer.send("save-skill", activeId);
}
