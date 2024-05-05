# server.py

from typing import Any
from fastapi import FastAPI, Body
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
    prompt = f"""You Follow these rules
- Don't use 'computer' module as you aren't running in --os mode. Try to use applescript and python
- To browse the web, you could use webdriver or requests module depends on if that website would be blocked or not i.e use webdriver for google websearch if needed w
- You don't have access to read or understand images just focus on text
- If you need to search the web, call following endpoints
curl -X GET 'https://openai-gateway.vercel.app/api/websearch/image?query=<YOUR_QUERY>'
{{
    "totalEstimatedMatches": 646,
    "nextOffset": 2,
    "currentOffset": 0,
    "value": [
        {{
            "name": "Testing - Anne Arundel Community College",
            "contentUrl": "https://www.aacc.edu/media/college/images/students/general-stock/testing_shutterstock_119579611_1200x600.jpg",
            "encodingFormat": "jpeg",
            "width": 1200,
            "height": 600
        }},
        {{
            "name": "B.C. COVID-19 update: Free rapid tests coming for 60+ - New West Record",
            "contentUrl": "https://www.vmcdn.ca/f/files/biv/images/covid-test-gettyimages-1316289788.jpg;w=960",
            "encodingFormat": "jpeg",
            "width": 960,
            "height": 641
        }}
  ]
}}

{message}
"""

    result = interpreter.chat(prompt, stream=False)
    return {"result": result}


@app.post("/chat-raw-post")
def chat_raw_endpoint_post(payload: Any = Body(None)):
    return chat_raw_endpoint(payload.get("message"))


@app.get("/history")
def history_endpoint():
    return interpreter.messages
