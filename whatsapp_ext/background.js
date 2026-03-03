chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "GENERATE_REPLY") {
        fetch("http://127.0.0.1:8000/generate-reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_history: request.chatHistory })
        })
            .then(response => response.json())
            .then(data => {
                sendResponse({ success: true, data: data });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.toString() });
            });

        return true; // Return true to indicate we will send a response asynchronously
    } else if (request.type === "AUTO_CORRECT") {
        fetch("http://127.0.0.1:8000/auto-correct", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_history: request.chatHistory, current_input: request.currentInput })
        })
            .then(response => response.json())
            .then(data => {
                sendResponse({ success: true, data: data });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.toString() });
            });

        return true;
    }
});
