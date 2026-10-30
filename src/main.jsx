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

// O <title> e o <link rel="manifest"> certos para esta rota (presos ao
// link exato da atleta, para "Adicionar ao Ecrã Principal" no iPhone
// funcionar bem) já vêm no próprio HTML servido por api/atleta-page.js —
// ver vercel.json. Trocar isto aqui por JavaScript (tentado antes) não
// chega: o iOS lê o HTML tal como veio do servidor, sem esperar que o
// JavaScript da página corra.

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
