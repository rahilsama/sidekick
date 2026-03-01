import streamlit as st
import requests
import json

# App Configuration
st.set_page_config(page_title="Reply Sidekick", page_icon="🦜", layout="centered")

st.title("🛡️ Reply Sidekick")
st.caption("No pressure. Just drafts. locally hosted.")

# 1. Inputs
received_msg = st.text_area("What message did you receive?", height=100)
user_intent = st.text_input("What's your rough intent?", placeholder="e.g., 'Say no politely', 'Ask for more time'")

# 2. Controls
col1, col2 = st.columns(2)
with col1:
    tone = st.select_slider("Tone", options=["Strictly Professional", "Casual", "Warm & Friendly", "Direct"])
with col2:
    length = st.select_slider("Length", options=["Brief", "Standard", "Detailed"])

# 3. The Logic
def generate_reply():
    if not received_msg:
        return
    
    # Construct the prompt
    prompt = f"""
    You are a communication assistant.
    Incoming Message: "{received_msg}"
    My Intent: "{user_intent}"
    Target Tone: {tone}
    Target Length: {length}
    
    Task: Write 3 different reply options. 
    Format them clearly as Option 1, Option 2, Option 3.
    """

    # Call Ollama API (Standard port 11434)
    response = requests.post('http://localhost:11434/api/generate', json={
        "model": "llama3.2", # Make sure you pulled this model!
        "prompt": prompt,
        "stream": False
    })
    
    return json.loads(response.content)['response']

# 4. Action
if st.button("Generate Options ✨", type="primary"):
    with st.spinner("Drafting..."):
        try:
            replies = generate_reply()
            st.success("Here are some options:")
            st.markdown(replies)
        except Exception as e:
            st.error(f"Is Ollama running? Error: {e}")

# 5. Anxiety Reducer (Review Zone)
st.markdown("---")
st.info("💡 Tip: You can mix and match parts of these options. You don't have to use them exactly as is.")