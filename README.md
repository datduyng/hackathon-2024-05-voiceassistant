# EchoAI

EchoAI reimagine how LLM should be used and interact in your daily life through providing the seamless voice interface and sandbox to run and automate your computer
## Example Usage
- Ask "Open Chrome and research about TSLA stocks"
- Ask "Research indepth on TSLA news and EV market in general"
- Ask "Turn on/off dark/light mode"
- Highlight an error that you are facing in VScode > Ask "Elaborate on this error"
- Select a window > Ask "summarize the current window"

## EchoAI Skills
- Skill ensure that EchoAI will reuse previous action so it doesn't have to figure out how to run the action through trial and error
- Skill can be saved through clicking "Save Skill" after running an action
![CleanShot 2024-05-05 at 16 57 00@2x](https://github.com/datduyng/hackathon-2024-05-voiceassistant/assets/35666615/916c6abc-dd42-4fb1-ac23-ab2a0e4ce93d)
- When creating skill, it will be saved under a temporary folder
![CleanShot 2024-05-05 at 16 50 07@2x](https://github.com/datduyng/hackathon-2024-05-voiceassistant/assets/35666615/8c69b1d2-bc63-475e-b9ca-819cbf3a9e98)

## Running EchoAI locally
```
git clone https://github.com/datduyng/hackathon-2024-05-voiceassistant
npm install
```

- `cp .env.example .env` and fill in the necessary environment variables
  - Get `OPENAI_API_KEY` from https://platform.openai.com/account/api-keys
  - Get `OCTOAI_API_KEY` from https://octoai.cloud/text

- Start the Electron Dev server
```
npm run start
```

- Start the python server
```
npm run start-py-server
```

