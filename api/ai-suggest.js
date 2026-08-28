// Função de servidor (Vercel Function). Corre no servidor, nunca no browser —
// por isso pode usar a chave secreta da Anthropic sem a expor aos utilizadores.
// Configura a variável de ambiente ANTHROPIC_API_KEY no projeto Vercel
// (Project Settings → Environment Variables) antes de fazer deploy.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY não está configurada no servidor." });
    return;
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "Pedido inválido: falta o campo 'prompt'." });
    return;
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await anthropicRes.json();
    if (!anthropicRes.ok) {
      res.status(anthropicRes.status).json({ error: data?.error?.message || "Erro ao contactar a Anthropic." });
      return;
    }
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || "Erro inesperado ao contactar a IA." });
  }
}
