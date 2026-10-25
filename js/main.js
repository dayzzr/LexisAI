// /js/main.js
import { consultarAgenteCodigo } from './api-client.js';

let worker;
let editor;
let db;

// Inicialização do IndexedDB para persistência contra perda de dados
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("LexisAIDB", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("workspace")) {
                db.createObjectStore("workspace", { keyPath: "id" });
            }
        };
    });
}

async function saveToIDB(content) {
    if (!db) return;
    const tx = db.transaction("workspace", "readwrite");
    tx.objectStore("workspace").put({ id: "currentCode", code: content });
}

async function loadFromIDB() {
    if (!db) return "";
    return new Promise((resolve) => {
        const tx = db.transaction("workspace", "readonly");
        const req = tx.objectStore("workspace").get("currentCode");
        req.onsuccess = () => resolve(req.result ? req.result.code : "");
        req.onerror = () => resolve("");
    });
}

window.addEventListener("DOMContentLoaded", async () => {
    try {
        db = await initDB();
    } catch (e) {
        console.warn("IndexedDB indisponível:", e);
    }

    // Configuração do CodeMirror
    const savedCode = await loadFromIDB();
    editor = CodeMirror(document.getElementById("editor-container"), {
        value: savedCode || "# Escreva seu código Python aqui...\nprint('Lexis AI pronto!')",
        mode: "python",
        theme: "dracula",
        lineNumbers: true,
        indentUnit: 4
    });

    // Debounce para salvamento automático de estado e prevenção de perda de dados
    let timeoutEditor;
    editor.on("change", () => {
        clearTimeout(timeoutEditor);
        timeoutEditor = setTimeout(() => {
            saveToIDB(editor.getValue());
        }, 300);
    });

    // Inicialização do Web Worker para o Pyodide
    worker = new Worker("./js/pyodide-worker.js");
    const terminal = document.getElementById("terminal-output");

    worker.onmessage = (event) => {
        const { type, msg, error, result } = event.data;
        if (type === "status" || type === "ready") {
            terminal.innerText += `\n> ${msg || result}`;
        } else if (type === "stdout") {
            terminal.innerText += `\n${result}`;
        } else if (type === "stderr" || type === "error") {
            terminal.innerText += `\n[Erro]: ${error}`;
        } else if (type === "success" && result !== undefined) {
            terminal.innerText += `\n[Resultado]: ${result}`;
        }
    };

    // Botão Executar
    document.getElementById("run-code-btn").addEventListener("click", () => {
        const code = editor.getValue();
        terminal.innerText += `\n> A executar código...`;
        worker.postMessage({ id: Date.now(), pythonCode: code });
    });

    // Chat / Copilot IA com Sanitização Segura contra DOM XSS (DOMPurify)
    const chatMessages = document.getElementById("chat-messages");
    document.getElementById("send-chat-btn").addEventListener("click", async () => {
        const inputField = document.getElementById("chat-input");
        const duvida = inputField.value.trim();
        if (!duvida) return;

        // Renderiza mensagem do utilizador de forma segura
        chatMessages.innerHTML += `<div class="mb-2 text-right"><strong>Você:</strong> ${DOMPurify.sanitize(duvida)}</div>`;
        inputField.value = "";

        const codigoAtual = editor.getValue();
        const respostaIA = await consultarAgenteCodigo(duvida, codigoAtual);

        // Sanitização e formatação segura da resposta da IA
        const respostaFormatada = DOMPurify.sanitize(
            respostaIA.replace(/\n/g, '<br>').replace(/```python/g, '<pre class="bg-gray-900 p-2 rounded text-xs">').replace(/```/g, '</pre>')
        );

        chatMessages.innerHTML += `
            <div class="mb-2 text-left bg-gray-700 p-2 rounded">
                <strong>Agente IA (Seguro):</strong><br><br>${respostaFormatada}
            </div>`;
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    // Gestão de Tema Automática e Manual
    const htmlElement = document.documentElement;
    const sunIcon = document.getElementById("theme-icon-sun");
    const moonIcon = document.getElementById("theme-icon-moon");

    function setTheme(isDark) {
        if (isDark) {
            htmlElement.classList.add("dark");
            sunIcon.classList.remove("hidden");
            moonIcon.classList.add("hidden");
        } else {
            htmlElement.classList.remove("dark");
            sunIcon.classList.add("hidden");
            moonIcon.classList.remove("hidden");
        }
    }

    // Leitura da preferência do sistema operativo (Media Query)
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(systemPrefersDark);

    document.getElementById("theme-toggle").addEventListener("click", () => {
        setTheme(!htmlElement.classList.contains("dark"));
    });
});
