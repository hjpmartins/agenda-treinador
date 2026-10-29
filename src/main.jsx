import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { UpdateBanner } from "./components/common/UpdateBanner";
import { AtletaPortalApp } from "./components/portal/AtletaPortalApp";
import "./index.css";

// Link pessoal de uma atleta (/atleta/<token>, sem conta/password — ver
// supabase/schema.sql e src/lib/portalDb.js): nesse caminho monta-se um
// ecrã totalmente à parte, sem nenhuma lógica de autenticação do
// treinador a correr. Qualquer outro caminho continua a app normal.
const atletaMatch = window.location.pathname.match(/^\/atleta\/([0-9a-f-]{36})\/?$/i);

// O manifest.webmanifest da app tem start_url "/" — se uma atleta usar
// "Adicionar ao ecrã principal" nesta página, o atalho abriria sempre a
// app do treinador (o start_url do manifest, não a página onde a atleta
// estava). Troca-se o manifest por um devolvido pela função de servidor
// api/atleta-manifest.js, com start_url/scope presos a este link exato —
// tem de ser um URL http real (não um blob: gerado no browser): no Safari
// do iPhone um blob: não é lido corretamente ao instalar o atalho, e o
// manifest antigo (start_url "/") acaba por ser usado na mesma.
if (atletaMatch) {
  document.title = "Espaço Atletas";
  const appleTitle = document.createElement("meta");
  appleTitle.setAttribute("name", "apple-mobile-web-app-title");
  appleTitle.setAttribute("content", "Espaço Atletas");
  document.head.appendChild(appleTitle);
  const appleCapable = document.createElement("meta");
  appleCapable.setAttribute("name", "apple-mobile-web-app-capable");
  appleCapable.setAttribute("content", "yes");
  document.head.appendChild(appleCapable);

  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink) manifestLink.setAttribute("href", `/api/atleta-manifest?token=${atletaMatch[1]}`);
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {atletaMatch ? <AtletaPortalApp token={atletaMatch[1]} /> : <App />}
    <UpdateBanner />
  </StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}
