let messageHistory = [];
let conversationHistory = [];
let isProcessing = false;

document.addEventListener('DOMContentLoaded', function() {
    initializeChat();
});

function initializeChat() {
    loadChatHistory();
    setupEventListeners();
    focusInput();
    updateCharCounter();
}

function setupEventListeners() {
    const input = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    
    input.addEventListener('keydown', handleKeyPress);
    input.addEventListener('input', handleInputChange);
    input.addEventListener('paste', handlePaste);
    
    sendButton.addEventListener('click', sendMessage);
    
    window.addEventListener('resize', adjustLayout);
    
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
        }
    });
}

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    } else if (event.key === 'Escape') {
        event.target.blur();
    }
}

function handleInputChange(event) {
    adjustTextareaHeight(event.target);
    updateCharCounter();
    
    const sendButton = document.getElementById('sendButton');
    const hasText = event.target.value.trim().length > 0;
    
    sendButton.style.opacity = hasText ? '1' : '0.7';
    sendButton.style.transform = hasText ? 'scale(1)' : 'scale(0.95)';
}

function handlePaste(event) {
    setTimeout(() => {
        adjustTextareaHeight(event.target);
        updateCharCounter();
    }, 10);
}

function adjustTextareaHeight(textarea) {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = newHeight + 'px';
    const container = document.querySelector('.chat-input-container');
    const baseHeight = 100;
    const extraHeight = Math.max(0, newHeight - 50);
    container.style.paddingBottom = (20 + extraHeight * 0.3) + 'px';
}

function updateCharCounter() {
    const input = document.getElementById('chatInput');
    const counter = document.getElementById('charCounter');
    const currentLength = input.value.length;
    const maxLength = input.getAttribute('maxlength') || 2000; 
    counter.textContent = `${currentLength}/${maxLength}`;
            if (currentLength > maxLength * 0.9) {
                    counter.style.color = '#dc2626';
                } else if (currentLength > maxLength * 0.7) {
                        counter.style.color = '#d97706';
            } else {
            counter.style.color = '#64748b';
    }
}

async function sendMessage() {
    if (isProcessing) return;
    
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (message === '') return;
    if (message.length > 2000) {
        showNotification('Pesan terlalu panjang! Maksimal 2000 karakter.', 'error');
        return;
    }
    isProcessing = true;
    hideWelcomeMessage();
    addMessage('user', message);
    input.value = '';
    input.style.height = 'auto';
    updateCharCounter();
    showTypingIndicator();
    const sendButton = document.getElementById('sendButton');
    sendButton.disabled = true;
    sendButton.style.opacity = '0.5';
    try {
        const response = await getAIResponse(message);
        hideTypingIndicator();
        const formattedResponse = formatResponse(response);
        addMessage('ai', formattedResponse);
        
    } catch (error) {
        console.error('Error:', error);
        hideTypingIndicator();
        
        let errorMessage = 'Maaf, terjadi kesalahan saat menghubungi AI. ';
        if (error.message.includes('API Key')) {
            errorMessage += 'Periksa API Key Anda.';
        } else if (error.message.includes('429')) {
            errorMessage += 'Terlalu banyak permintaan. Coba lagi nanti.';
        } else if (error.message.includes('403')) {
            errorMessage += 'Akses ditolak. Periksa quota API Anda.';
        } else {
            errorMessage += 'Periksa koneksi internet Anda.';
        }
        
        addMessage('ai', errorMessage);
    } finally {
        sendButton.disabled = false;
        sendButton.style.opacity = '1';
        isProcessing = false;
        focusInput();
    }
}

function addMessage(sender, text, timestamp = null) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    const time = timestamp || new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    });

    messageDiv.className = `message ${sender}`;
    messageDiv.innerHTML = `
        <div class="message-avatar">
            ${sender === 'user' ? 'You' : 'Lexi'}
        </div>
        <div class="message-content">
            <div>${text}</div>
            <div class="message-time">${time}</div>
        </div>
    `;

    const typingIndicator = document.getElementById('typingIndicator');
    messagesContainer.insertBefore(messageDiv, typingIndicator);
    
    if (!timestamp || timestamp === time) {
        messageHistory.push({
            sender: sender,
            text: text,
            timestamp: time
        });
        saveChatHistory();
    }
    
    scrollToBottom();
    return messageDiv;
}

function formatResponse(text) {
    if (!text) return 'Tidak ada balasan dari AI.';
    
    let codeBlocks = [];
    let codeBlockIndex = 0;
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, language, code) => {
        const placeholder = `__CODEBLOCK_${codeBlockIndex}__`;
        codeBlocks[codeBlockIndex] = {
            language: language || 'text',
            code: code.trim()
        };
        codeBlockIndex++;
        return placeholder;
    });
    
    let inlineCodes = [];
    let inlineIndex = 0;
    text = text.replace(/`([^`]+)`/g, (match, code) => {
        const placeholder = `__INLINECODE_${inlineIndex}__`;
        inlineCodes[inlineIndex] = code;
        inlineIndex++;
        return placeholder;
    });

    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    if (/^\d+\.\s/m.test(text)) {
        text = formatOrderedList(text);
    }

    if (/^[-*+]\s/m.test(text)) {
        text = formatUnorderedList(text);
    }
    
    text = text.replace(/\n{2,}/g, "</p><p>");
    text = text.replace(/\n/g, "<br>");
    for (let i = 0; i < codeBlocks.length; i++) {
        const block = codeBlocks[i];
        const formattedCode = `
            <div class="code-block">
                <div class="code-header">
                    <span class="code-language">${block.language}</span>
                    <button class="copy-btn" onclick="copyCode(this)" data-code="${escapeHtml(block.code)}">
                        📋 Copy
                    </button>
                </div>
                <pre><code class="language-${block.language}">${escapeHtml(block.code)}</code></pre>
            </div>
        `;
        text = text.replace(`__CODEBLOCK_${i}__`, formattedCode);
    }
    
    for (let i = 0; i < inlineCodes.length; i++) {
        text = text.replace(`__INLINECODE_${i}__`, `<code class="inline-code">${escapeHtml(inlineCodes[i])}</code>`);
    }
    if (!text.includes('<') && !text.includes('>')) {
        return `<p>${text}</p>`;
    }
    
    return `<div class="formatted-response">${text}</div>`;
}

function formatOrderedList(text) {
    let lines = text.split('\n');
    let inList = false;
    let result = [];
    
    for (let line of lines) {
        const match = line.match(/^(\d+)\.\s*(.+)/);
        if (match) {
            if (!inList) {
                result.push('<ol class="formatted-list">');
                inList = true;
            }
            result.push(`<li>${match[2]}</li>`);
        } else {
            if (inList && line.trim() === '') {
                continue;
            } else if (inList && line.trim() !== '') {
                result.push('</ol>');
                inList = false;
                result.push(line);
            } else {
                result.push(line);
            }
        }
    }
    
    if (inList) {
        result.push('</ol>');
    }
    
    return result.join('\n');
}

function formatUnorderedList(text) {
    let lines = text.split('\n');
    let inList = false;
    let result = [];
    
    for (let line of lines) {
        const match = line.match(/^[-*+]\s*(.+)/);
        if (match) {
            if (!inList) {
                result.push('<ul class="formatted-list">');
                inList = true;
            }
            result.push(`<li>${match[1]}</li>`);
        } else {
            if (inList && line.trim() === '') {
                continue;
            } else if (inList && line.trim() !== '') {
                result.push('</ul>');
                inList = false;
                result.push(line);
            } else {
                result.push(line);
            }
        }
    }
    
    if (inList) {
        result.push('</ul>');
    }
    
    return result.join('\n');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function getAIResponse(prompt) {
    const apiKey = "AIzaSyCB2WT0-KYhXVFS09HnGZd01Uuidvp_5k4";
    
    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
        throw new Error('API Key tidak ditemukan. Harap masukkan API Key Gemini Anda.');
    }
    
    const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
    
    if (conversationHistory.length === 0) {
        conversationHistory.push({
            role: "user",
            parts: [{ 
                text: "Halo! Kamu adalah Lexi.AI, assistant AI berbahasa Indonesia yang membantu user dengan ramah dan informatif. Selalu jawab dalam bahasa Indonesia dan ingat konteks percakapan kita. Berikan penjelasan yang detail dan mudah dipahami." 
            }]
        });
        conversationHistory.push({
            role: "model", 
            parts: [{ 
                text: "Halo! Saya Lexi.AI, siap membantu Anda. Saya akan menjawab semua pertanyaan dalam bahasa Indonesia dan mengingat konteks percakapan kita. Ada yang bisa saya bantu hari ini?" 
            }]
        });
    }
    
    conversationHistory.push({
        role: "user",
        parts: [{ text: prompt }]
    });
    
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            contents: conversationHistory,
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2048,
            }
        }),
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.candidates && 
        data.candidates.length > 0 && 
        data.candidates[0].content && 
        data.candidates[0].content.parts && 
        data.candidates[0].content.parts.length > 0) {
        
        const aiResponse = data.candidates[0].content.parts[0].text;
        
        conversationHistory.push({
            role: "model",
            parts: [{ text: aiResponse }]
        });
        if (conversationHistory.length > 32) {
            const systemMessages = conversationHistory.slice(0, 2);
            const recentMessages = conversationHistory.slice(-28);
            conversationHistory = [...systemMessages, ...recentMessages];
        }
        
        saveConversationHistory();
        return aiResponse;
        
    } else {
        console.error('Invalid response structure:', data);
        throw new Error('AI gagal memberikan balasan yang valid.');
    }
}

function showTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.style.display = 'flex';
        scrollToBottom();
    }
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

function hideWelcomeMessage() {
    const welcomeMsg = document.querySelector('.welcome-message');
    if (welcomeMsg && welcomeMsg.style.display !== 'none') {
        welcomeMsg.style.display = 'none';
    }
}

function sendSuggestion(text) {
    const input = document.getElementById('chatInput');
    if (input && !isProcessing) {
        input.value = text;
        adjustTextareaHeight(input);
        updateCharCounter();
        sendMessage();
    }
}

function clearChat() {
    if (isProcessing) {
        if (!confirm('Sedang memproses pesan. Yakin ingin menghapus chat?')) {
            return;
        }
    }
    
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = `
        <div class="welcome-message">
            <h2>Selamat datang! 👋</h2>
            <p>Saya adalah Lexi.AI Assistant yang siap membantu Anda. Apa yang bisa saya bantu hari ini?</p>
            
            <div class="welcome-suggestions">
                <div class="suggestion-chip" onclick="sendSuggestion('Jelaskan tentang kecerdasan buatan')">
                    Tentang AI
                </div>
                <div class="suggestion-chip" onclick="sendSuggestion('Buatkan contoh kode')">
                    Coding Help
                </div>
                <div class="suggestion-chip" onclick="sendSuggestion('Berikan tips belajar')">
                    Tips Belajar
                </div>
                <div class="suggestion-chip" onclick="sendSuggestion('Ceritakan tentang teknologi terbaru')">
                    Tech News
                </div>
            </div>
        </div>
        
        <div class="typing-indicator" id="typingIndicator">
            <div class="message-avatar">
                Lexi
            </div>
            <div class="typing-content">
                <div class="typing-dots">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        </div>
    `;
    
    messageHistory = [];
    conversationHistory = [];
    isProcessing = false;

    const sendButton = document.getElementById('sendButton');
    if (sendButton) {
        sendButton.disabled = false;
        sendButton.style.opacity = '1';
    }
    
    const input = document.getElementById('chatInput');
    if (input) {
        input.value = '';
        input.style.height = 'auto';
        updateCharCounter();
    }

    saveChatHistory();
    saveConversationHistory();
    focusInput();
    
    showNotification('Chat berhasil dibersihkan!', 'success');
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
    }
}

function focusInput() {
    const input = document.getElementById('chatInput');
    if (input && !isProcessing) {
        setTimeout(() => input.focus(), 100);
    }
}

function adjustLayout() {
    const input = document.getElementById('chatInput');
    if (input) {
        adjustTextareaHeight(input);
    }
    scrollToBottom();
}

function saveChatHistory() {
    try {
        const data = JSON.stringify(messageHistory);
        console.log('Chat history would be saved:', messageHistory.length + ' messages');
    } catch (error) {
        console.log('Cannot save chat history:', error);
    }
}

function saveConversationHistory() {
    try {
        const data = JSON.stringify(conversationHistory);
        console.log('Conversation history would be saved:', conversationHistory.length + ' messages');
    } catch (error) {
        console.log('Cannot save conversation history:', error);
    }
}

function loadChatHistory() {
    try {
        console.log('Chat history would be loaded from localStorage');
        messageHistory = [];
        conversationHistory = [];
    } catch (error) {
        console.log('Cannot load chat history:', error);
        messageHistory = [];
        conversationHistory = [];
    }
}

function copyCode(button) {
    const code = button.getAttribute('data-code');
    
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(code).then(() => {
            button.innerHTML = '✅ Copied!';
            setTimeout(() => {
                button.innerHTML = '📋 Copy';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            fallbackCopyTextToClipboard(code, button);
        });
    } else {
        fallbackCopyTextToClipboard(code, button);
    }
}

function fallbackCopyTextToClipboard(text, button) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        button.innerHTML = '✅ Copied!';
        setTimeout(() => {
            button.innerHTML = '📋 Copy';
        }, 2000);
    } catch (err) {
        console.error('Fallback: Could not copy text: ', err);
        button.innerHTML = '❌ Failed';
        setTimeout(() => {
            button.innerHTML = '📋 Copy';
        }, 2000);
    }
    
    document.body.removeChild(textArea);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatResponse,
        escapeHtml,
        getAIResponse,
        copyCode,
        showNotification
    };

}
