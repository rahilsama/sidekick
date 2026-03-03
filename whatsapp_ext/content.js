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

    document.getElementById('sk-close').onmousedown = (e) => e.preventDefault();
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
        // CRITICAL: Prevent the button from stealing focus from the text box
        btn.onmousedown = (e) => {
            e.preventDefault();
        };
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            insertText(sug);
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

function insertText(text) {
    // Always re-find the LIVE input box fresh from the DOM at click time.
    const mainChat = document.querySelector('#main');
    if (!mainChat) return;
    const liveInput = mainChat.querySelector('footer div[contenteditable="true"]');
    if (!liveInput) return;

    liveInput.focus();

    // Step 1: Select all content in the live input box
    const range = document.createRange();
    range.selectNodeContents(liveInput);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    // Step 2: Wait a tick so Lexical internally registers the selection change.
    // Without this delay, Lexical ignores our programmatic selection and
    // the beforeinput event has no effect.
    setTimeout(() => {
        // Tell Lexical "the user typed this text" while text is selected.
        // Lexical handles this by deleting the selection first, then inserting.
        // Lexical fires its own 'input' event after processing, so we only need beforeinput.
        liveInput.dispatchEvent(new InputEvent('beforeinput', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: text
        }));

        // Reset state so next autocomplete cycle works identically to the first
        isSuggesting = false;
        lastChatContext = "";
    }, 50);
}

let typingTimer;
const DONE_TYPING_INTERVAL = 250; // Ultra-fast real-time typing debounce (250ms)
let currentRequestToken = 0;

async function handleAction(inputBox, isAutoCorrection) {
    const chatHistory = scanMessages();
    if (!chatHistory.trim()) return;

    // Grab what the user has currently typed (if anything)
    let currentInputText = "";
    if (inputBox) {
        currentInputText = inputBox.innerText.trim();
    }

    // Prevent re-triggering for the exact same context
    const contextKey = chatHistory + "|||" + currentInputText;
    if (isSuggesting && contextKey === lastChatContext) return;
    if (contextKey === lastChatContext && sidekickUI && sidekickUI.style.display === 'block') return;

    lastChatContext = contextKey;

    currentRequestToken++;
    const thisRequestToken = currentRequestToken;

    isSuggesting = true;

    // Only show "Thinking..." if the UI isn't already open with old suggestions, 
    // to avoid flickering the UI during fast typing
    if (!sidekickUI || sidekickUI.style.display === 'none') {
        showSuggestions(["Thinking... (Reading context 🔍)"], inputBox);
    }

    try {
        const endpoint = isAutoCorrection ? "http://127.0.0.1:8000/auto-correct" : "http://127.0.0.1:8000/generate-reply";

        chrome.runtime.sendMessage({
            type: isAutoCorrection ? "AUTO_CORRECT" : "GENERATE_REPLY",
            chatHistory: chatHistory,
            currentInput: currentInputText
        }, (response) => {
            // Ignore stale responses if the user has typed since this request was sent
            if (thisRequestToken !== currentRequestToken) return;

            if (response && response.success) {
                const data = response.data;
                if (data.replies && data.replies.length > 0) {
                    showSuggestions(data.replies, inputBox);
                } else {
                    showSuggestions(["No response generated. Chat might be too short or error occurred."], inputBox);
                    setTimeout(() => { if (thisRequestToken === currentRequestToken) isSuggesting = false; }, 3000);
                }
            } else {
                console.error("[Sidekick] Background API Error:", response ? response.error : "Unknown");
                showSuggestions(["Error connecting to local API. Is it running? (Check CLI)"], inputBox);
                setTimeout(() => { if (thisRequestToken === currentRequestToken) isSuggesting = false; }, 3000);
            }
        });
    } catch (err) {
        if (thisRequestToken !== currentRequestToken) return;
        console.error("[Sidekick] Extension Communication Error:", err);
        showSuggestions(["Error: Extension background script failed."], inputBox);
        setTimeout(() => { isSuggesting = false; }, 3000);
    }
}

function getValidInputBox(target) {
    // If the target is a text block, we must get its parent element first, 
    // otherwise .closest() throws a Javascript Type Error!
    let el = target.nodeType === 3 ? target.parentNode : target;
    if (!el || !el.closest) return null;

    const inputBox = el.closest('div[contenteditable="true"]');
    const mainChat = document.querySelector('#main');
    if (!inputBox || !mainChat || !mainChat.contains(inputBox)) {
        return null;
    }
    return inputBox;
}

function handleTypingEvent(e) {
    const inputBox = getValidInputBox(e.target);
    if (!inputBox) return;

    clearTimeout(typingTimer);

    // Only set timer if there's actually text typed
    if (inputBox.innerText.trim().length > 0) {
        typingTimer = setTimeout(() => {
            handleAction(inputBox, true); // true = isAutoCorrection
        }, DONE_TYPING_INTERVAL);
    } else {
        // If they backspace everything, hide the UI immediately
        if (sidekickUI) {
            sidekickUI.style.display = 'none';
        }
        isSuggesting = false;
    }
}

async function handleTypingBoxInteraction(e) {
    const inputBox = getValidInputBox(e.target);
    if (!inputBox) {
        if (sidekickUI && e.target.closest('#sidekick-suggestions') === null) {
            // sidekickUI.style.display = 'none'; 
        }
        return;
    }

    // Standard click handling (generate reply options from empty box)
    if (inputBox.innerText.trim() === '') {
        handleAction(inputBox, false); // false = Standard Reply Generaton
    }
}

// Event Listeners
document.addEventListener("focusin", handleTypingBoxInteraction, true);
document.addEventListener("click", handleTypingBoxInteraction, true);

// Listen for actual typing events
document.addEventListener("input", handleTypingEvent, true);
document.addEventListener("keydown", (e) => {
    const inputBox = getValidInputBox(e.target);
    if (inputBox) clearTimeout(typingTimer);
}, true);


