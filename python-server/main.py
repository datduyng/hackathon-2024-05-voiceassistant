# server.py

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from interpreter import interpreter
from dotenv import load_dotenv
import os


load_dotenv()  # take environment variables from .env.

if not os.getenv("OPENAI_API_KEY"):
    raise Exception("OPENAI_API_KEY is not set")

interpreter.llm.api_key = os.getenv("OPENAI_API_KEY")
interpreter.disable_telemetry = True
interpreter.auto_run = True

app = FastAPI()


@app.get("/chat")
def chat_endpoint(message: str):
    def event_stream():
        for result in interpreter.chat(message, stream=True):
            yield f"data: {result}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/chat-raw")
def chat_raw_endpoint(message: str):
    result = interpreter.chat(message, stream=False)
    return {"result": result}


@app.get("/history")
def history_endpoint():
    return interpreter.messages
