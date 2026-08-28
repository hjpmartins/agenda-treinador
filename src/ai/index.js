// Chama a nossa função de servidor (api/ai-suggest.js), que por sua vez chama a Anthropic
// com a chave guardada em segredo no servidor. O browser nunca vê a chave da API.
async function callClaudeJSON(promptText) {
  const response = await fetch("/api/ai-suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: promptText }),
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => null);
    throw new Error(errBody?.error || `A IA não respondeu corretamente (erro ${response.status}). Tenta novamente.`);
  }
  const data = await response.json();
  const text = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("\n");
  const clean = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    throw new Error("A IA devolveu uma resposta que não consegui interpretar. Tenta novamente.");
  }
}

export { callClaudeJSON };
