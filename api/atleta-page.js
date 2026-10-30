// Página HTML da rota /atleta/<token> — servida por esta função em vez do
// index.html estático (ver vercel.json), para o Safari do iPhone ler o
// <title> e o <link rel="manifest"> certos logo no HTML que o servidor
// devolve. Trocar esses valores por JavaScript depois da página carregar
// (como se tentou antes, em src/main.jsx) não chega: o "Adicionar ao Ecrã
// Principal" do iOS lê o HTML tal como veio do servidor, sem esperar que o
// JavaScript da página corra — confirmado porque, mesmo num iPhone novo e
// a abrir pelo Safari a sério, o atalho continuava a cair na app do
// treinador.
//
// Acoplamento: os dois literais abaixo ("<title>Agenda do Treinador</title>"
// e a tag <link rel="manifest">) têm de corresponder exatamente ao que está
// em index.html — se um dia mudares o título ou o manifest aí, atualiza
// também aqui.
export default async function handler(req, res) {
  const token = (req.query.token || "").toString();
  const tokenValido = /^[0-9a-f-]{36}$/i.test(token);

  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;

  let html;
  try {
    const origem = await fetch(`${proto}://${host}/index.html`);
    html = await origem.text();
  } catch {
    // Falha a ir buscar o index.html (rara, transitória) — nunca mandar
    // para "/" aqui, isso seria mesmo o bug que esta função existe para
    // evitar. Pede só para tentar outra vez.
    res.status(502).send("Não foi possível carregar a página. Tenta recarregar.");
    return;
  }

  if (tokenValido) {
    html = html
      .replace("<title>Agenda do Treinador</title>", "<title>Espaço Atletas</title>")
      .replace(
        '<link rel="manifest" href="/manifest.webmanifest" />',
        `<link rel="manifest" href="/api/atleta-manifest?token=${token}" />\n    <meta name="apple-mobile-web-app-title" content="Espaço Atletas" />\n    <meta name="apple-mobile-web-app-capable" content="yes" />`
      );
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(html);
}
