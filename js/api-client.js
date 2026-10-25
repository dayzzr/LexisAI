// /js/api-client.js
const WORKER_URL = "https://lexis-api-bridge.renato-dias0910.workers.dev";

export async function consultarAgenteCodigo(duvida, codigoAtual) {
    // Truncamento preventivo para proteger a janela de contexto do LLM
    const codigoLimitado = codigoAtual.length > 4000 
        ? codigoAtual.substring(0, 4000) + "\n# ... [Código truncado por limite de tamanho] ..." 
        : codigoAtual;

    const promptUsuario = `Dúvida: ${duvida}\n\nCódigo atual:\n\`\`python\n${codigoLimitado}\n\`\`\``;

    try {
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: promptUsuario })
        });

        if (!response.ok) {
            throw new Error(`Falha no Servidor Seguro (Status ${response.status})`);
        }

        const data = await response.json();
        return data.choices && data.choices[0] ? data.choices[0].message.content : "Sem resposta do assistente.";
    } catch (error) {
        console.error("Erro na API Client:", error);
        return `Erro de comunicação: ${error.message}`;
    }
}
