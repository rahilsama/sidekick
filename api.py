import time
import json
import requests
import uvicorn
import logging
from fastapi import FastAPI, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime

# Disable Uvicorn's default access logging for a silent background run
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RequestData(BaseModel):
    chat_history: str

# Console Colors
C_GREEN = '\033[92m'
C_YELLOW = '\033[93m'
C_CYAN = '\033[96m'
C_RESET = '\033[0m'
C_WHITE = '\033[97m'

def print_metrics(start_time: float, chat_length: int, msg_count: int, model_time: float, success: bool):
    total_time = time.time() - start_time
    status = f"{C_GREEN}SUCCESS{C_RESET}" if success else f"\033[91mFAILED{C_RESET}"
    
    print(f"\n{C_CYAN}--- [ Sidekick Interaction metrics ] ---{C_RESET}")
    print(f" {C_WHITE}Time:{C_RESET} {datetime.now().strftime('%H:%M:%S')}")
    print(f" {C_WHITE}Status:{C_RESET} {status}")
    print(f" {C_WHITE}Context Parsed:{C_RESET} {chat_length} chars, ~{msg_count} messages")
    print(f" {C_WHITE}Ollama Inference:{C_RESET} {model_time:.2f}s")
    print(f" {C_WHITE}Total Pipeline:{C_RESET} {total_time:.2f}s")
    print(f"{C_CYAN}----------------------------------------{C_RESET}\n")

@app.post("/generate-reply")
async def generate_reply(data: RequestData, request: Request):
    start_time = time.time()
    
    chat_history = data.chat_history
    msg_count = len(chat_history.split('\n'))
    chat_length = len(chat_history)
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {C_YELLOW}User clicked message box! Reading chat...{C_RESET}")

    prompt = f"""
    You are a helpful communication assistant for a messaging app.
    Here is the recent chat history between "Me" and "Them" (or group members):
    
    {data.chat_history}
    
    The user ("Me") is about to type a reply.
    Task: Write 3 different short and natural reply options for the user ("Me") to send next. 
    Make them varied (Option 1: Professional/Polite, Option 2: Casual/Friendly, Option 3: Short/Direct).
    Your response must be ONLY a raw JSON array containing exactly 3 strings. 
    Example: ["Reply 1", "Reply 2", "Reply 3"]
    """

    model_time_start = time.time()
    success = False
    
    try:
        response = requests.post('http://localhost:11434/api/generate', json={
            "model": "qwen2.5:7b",
            "prompt": prompt,
            "stream": False,
            "format": "json" 
        }, timeout=25)
        
        model_time = time.time() - model_time_start
        content_text = json.loads(response.content)['response']
        
        parsed_json = json.loads(content_text)
        
        if isinstance(parsed_json, dict):
            list_values = [v for v in parsed_json.values() if isinstance(v, list)]
            if list_values:
                replies = list_values[0]
            else:
                replies = list(parsed_json.values())
        else:
            replies = parsed_json
            
        if not isinstance(replies, list):
            replies = [f"Parsing error. Model returned: {str(parsed_json)[:50]}"]
        elif len(replies) == 0:
            replies = ["Model returned an empty list."]
        else:
            replies = [str(r).strip() for r in replies]
            success = True
            
    except requests.exceptions.Timeout:
        model_time = time.time() - model_time_start
        replies = ["Ollama request timed out. Model might be still loading."]
    except Exception as e:
        model_time = time.time() - model_time_start
        replies = [f"Error connecting to local Ollama. Details: {str(e)}"]

    print_metrics(start_time, chat_length, msg_count, model_time, success)
    return {"replies": replies}

if __name__ == "__main__":
    print(f"\n{C_GREEN}=========================================={C_RESET}")
    print(f"{C_CYAN} 🛡️  Sidekick Background Service is running {C_RESET}")
    print(f"{C_GREEN}=========================================={C_RESET}")
    print(f" - Listening for WhatsApp Extension on port 8000")
    print(f" - Waiting for user to click typing box...")
    print(f" - Press Ctrl+C to exit.\n")
    
    # Run silently via uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, log_level="error")
