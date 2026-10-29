// Manifest (PWA) por atleta — ver src/main.jsx. O manifest.webmanifest
// estático da app tem start_url "/", o que faz o Safari do iPhone (e o
// Chrome do Android) criar o atalho de "Adicionar ao ecrã principal"
// sempre a apontar para a app do treinador, nunca para o link pessoal da
// atleta. Esta função devolve um manifest à parte, com start_url/scope
// presos ao link exato da atleta — servido como um URL http real (não um
// blob: gerado no browser), que é o que o Safari precisa para o ler
// corretamente ao instalar o atalho.
export default function handler(req, res) {
  const token = (req.query.token || "").toString();
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    res.status(400).json({ error: "token inválido" });
    return;
  }

  const manifest = {
    name: "Espaço Atletas",
    short_name: "Atletas",
    description: "O teu espaço pessoal: avisos, treinos, convocatórias e evolução.",
    start_url: `/atleta/${token}`,
    scope: `/atleta/${token}`,
    display: "standalone",
    background_color: "#14181F",
    theme_color: "#14181F",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
  };

  res.setHeader("Content-Type", "application/manifest+json");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).json(manifest);
}
