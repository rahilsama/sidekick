# 🛡️ Reply Sidekick for WhatsApp Web

A privacy-first, locally-hosted Chrome Extension that seamlessly integrates with WhatsApp Web to auto-suggest intelligent, context-aware replies using an offline LLM (Qwen 2.5 via Ollama).

Unlike other AI assistants, **Reply Sidekick runs 100% locally on your machine**. Your private WhatsApp chats are never sent to external servers like OpenAI or Anthropic.

---

## ✨ Features
- **Privacy First**: Fully offline inference. Your chat data never leaves your computer.
- **Context-Aware**: Automatically reads the last 15 messages of your active chat to understand the conversation flow.
- **Varied Suggestions**: Generates 3 distinct reply options (Professional, Casual, Short/Direct).
- **Seamless UI**: Injects a beautiful, unobtrusive overlay directly above your WhatsApp typing box.
- **Silent Background API**: A lightweight FastAPI backend that runs quietly in your terminal with gorgeous metric logs.

---

## 📋 Prerequisites
Before you start, make sure you have the following installed on your machine:
1. **Python 3.9+** (For the local API server)
2. **[Ollama](https://ollama.com/)** (To run the local LLM)

Once Ollama is installed, you need to pull the Qwen 2.5 (7B) model in your terminal:
```bash
ollama run qwen2.5:7b
```

---

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/rahilsama/sidekick.git
cd sidekick
```

### 2. Set Up the Python Backend
Create a virtual environment to keep your dependencies clean, and install the required packages:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## 🏃‍♂️ Running the Assistant

You need to have two things running for Sidekick to work: the local API server, and the Chrome Extension.

### 1. Start the Background API
Open your terminal, ensure you are in the `sidekick` directory with your virtual environment activated, and run:
```bash
python3 api.py
```
*You should see a message saying "🛡️ Sidekick Background Service is running on port 8000". Leave this terminal open!*

### 2. Install the Chrome Extension
Because this is a local tool, you need to load it into Chrome in Developer Mode:
1. Open Google Chrome (or any Chromium browser like Brave, Edge).
2. Go to `chrome://extensions/` in your address bar.
3. Toggle on **"Developer mode"** in the top-right corner.
4. Click the **"Load unpacked"** button in the top-left area.
5. Select the `whatsapp_ext` folder located inside your cloned `sidekick` directory.
6. Make sure the extension is turned ON.

---

## 💬 How to Use It
1. Go to [WhatsApp Web](https://web.whatsapp.com) and let your chats load.
2. Open any conversation.
3. **Click on the "Type a message" text box.**
4. A sleek "🛡️ Reply Sidekick" overlay will appear, indicating it is "Thinking...".
5. It will fetch the recent context, contact your local Ollama API, and seconds later present you with 3 custom replies.
6. Click any suggestion to instantly snap it into your text box!

---

## 🛠️ Architecture & Troubleshooting
**How it works under the hood:**
- **`content.js`**: Injected onto WhatsApp Web. Reads the chat DOM when you click the text box.
- **`background.js`**: A Service Worker that acts as a secure bridge, bypassing WhatsApp's strict Content Security Policy (CSP) to communicate with your localhost.
- **`api.py`**: A FastAPI web server that fields requests from the extension, formats the prompt, and hands it to the local Ollama instance on port `11434`.

**Common Issues:**
- `Error: Is the Sidekick API running?`: Ensure `python3 api.py` is running in your terminal.
- `Ollama request timed out`: Your Ollama model might still be loading into RAM. Give it a few seconds and try clicking the text box again.
- `Extension not triggering`: Make sure you reload the extension in `chrome://extensions/` if you make any code changes, and then refresh your WhatsApp Web tab.
