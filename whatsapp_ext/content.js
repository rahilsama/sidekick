console.log("Sidekick WhatsApp Extension Loaded!");

let isSuggesting = false;
let sidekickUI = null;
let lastChatContext = "";

function scanMessages() {
    const mainChat = document.querySelector('#main');
    if (!mainChat) return "";

    const messageRows = mainChat.querySelectorAll('[role="row"]');

    let messages = [];
    messageRows.forEach(row => {
        // WhatsApp creates different class groupings for incoming and outgoing messages
        const isMsgOut = row.querySelector('.message-out') !== null || row.innerHTML.includes('data-id="true_');
        const isMsgIn = row.querySelector('.message-in') !== null || row.innerHTML.includes('data-id="false_');

        let sender = "";
        if (isMsgOut) sender = "Me";
        else if (isMsgIn) sender = "Them";
        else return; // System messages like dates

        // The actual text payload is inside span elements with selectable-text
        const textEls = row.querySelectorAll('span.selectable-text, span.copyable-text');
        let msgText = "";

        textEls.forEach(el => {
            // Check if it's the actual text (not the timestamp)
            if (el.innerText.length > 5 && !el.innerText.includes(':') && !el.className.includes('timestamp')) {
                // Not ideal, but sometimes WhatsApp puts timestamps in selectable text.
            }
            // Often copyable-text has the real message content inside a data attribute
            if (el.getAttribute('data-pre-plain-text')) {
                // it's a message bubble container usually
            } else if (el.innerText && el.innerText.trim() !== '') {
                msgText += el.innerText.trim() + " ";
            }
        });

        // fallback if selectable text loop didn't catch it well
        if (msgText.trim() === "") {
            const fallbackText = Array.from(row.querySelectorAll('span'))
                .find(span => span.dir === 'ltr' && span.className.includes('selectable-text'));
            if (fallbackText) msgText = fallbackText.innerText.trim();
        }

        if (msgText.trim().length > 0) {
            messages.push(`${sender}: ${msgText.trim()}`);
        }
    });

    // Take the last 15 valid messages
    return messages.slice(-15).join("\n");
}


function showSuggestions(suggestions, inputBox) {
    if (!sidekickUI) {
        sidekickUI = document.createElement("div");
        sidekickUI.id = "sidekick-suggestions";
        document.body.appendChild(sidekickUI);
    }

    sidekickUI.innerHTML = `<div class='sk-header'>
        <span>🛡️ Reply Sidekick</span>
        <button id='sk-close'>✕</button>
    </div>`;

    document.getElementById('sk-close').onclick = (e) => {
        e.stopPropagation();
        sidekickUI.style.display = 'none';
        isSuggesting = false;
    };

    const container = document.createElement("div");
    container.className = "sk-options-container";

    suggestions.forEach(sug => {
        const btn = document.createElement("button");
        btn.className = "sk-option";
        btn.innerText = sug;
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            insertText(sug, inputBox);
            sidekickUI.style.display = 'none';
        };
        container.appendChild(btn);
    });

    sidekickUI.appendChild(container);
    sidekickUI.style.display = 'block';

    // Position just above the input box (footer area) but on the right side
    const mainChat = document.querySelector('#main');
    if (mainChat) {
        const footerElement = mainChat.querySelector('footer');
        if (footerElement) {
            const rect = footerElement.getBoundingClientRect();
            // Position above the footer on the right
            sidekickUI.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
            sidekickUI.style.left = 'auto';
            sidekickUI.style.right = (window.innerWidth - rect.right + 20) + 'px';
        }
    }
}

function insertText(text, inputBoxNode) {
    if (inputBoxNode) {
        inputBoxNode.focus();
        document.execCommand('insertText', false, text);
    }
}

async function handleTypingBoxInteraction(e) {
    // Only trigger if we clicked inside an editable typing box inside #main
    const target = e.target;
    const inputBox = target.closest('div[contenteditable="true"]');

    // Check if it's the main chat input
    const mainChat = document.querySelector('#main');
    if (!inputBox || !mainChat || !mainChat.contains(inputBox)) {
        // If clicking outside, maybe hide suggestions
        if (sidekickUI && target.closest('#sidekick-suggestions') === null) {
            // Uncomment to auto-hide when clicking elsewhere
            // sidekickUI.style.display = 'none'; 
        }
        return;
    }

    const chatHistory = scanMessages();
    if (!chatHistory.trim()) return;

    // Prevent re-triggering for the exact same context within a short timeframe
    if (isSuggesting && chatHistory === lastChatContext) return;
    if (chatHistory === lastChatContext && sidekickUI && sidekickUI.style.display === 'block') return;

    lastChatContext = chatHistory;
    console.log("[Sidekick] Scraped History:\n", chatHistory);

    isSuggesting = true;
    showSuggestions(["Thinking... (Reading context 🔍)"], inputBox);

    try {
        chrome.runtime.sendMessage({
            type: "GENERATE_REPLY",
            chatHistory: chatHistory
        }, (response) => {
            if (response && response.success) {
                const data = response.data;
                if (data.replies && data.replies.length > 0) {
                    showSuggestions(data.replies, inputBox);
                } else {
                    showSuggestions(["No response generated. Chat might be too short or error occurred."], inputBox);
                    setTimeout(() => { isSuggesting = false; }, 3000);
                }
            } else {
                console.error("[Sidekick] Background API Error:", response ? response.error : "Unknown");
                showSuggestions(["Error connecting to local API. Is it running? (Check CLI)"], inputBox);
                setTimeout(() => { isSuggesting = false; }, 3000);
            }
        });
    } catch (err) {
        console.error("[Sidekick] Extension Communication Error:", err);
        showSuggestions(["Error: Extension background script failed."], inputBox);
        setTimeout(() => { isSuggesting = false; }, 3000);
    }
}

// We use 'focusin' and 'click' to capture when the user readies to type
document.addEventListener("focusin", handleTypingBoxInteraction, true);
document.addEventListener("click", handleTypingBoxInteraction, true);
