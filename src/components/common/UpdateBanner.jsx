import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

// A URL do próprio módulo compilado — em produção corresponde ao ficheiro
// com hash (/assets/index-XXXX.js) que está mesmo a correr neste separador.
const CURRENT_BUNDLE = import.meta.url;
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

function extractBundleUrl(html) {
  const match = html.match(/src="(\/assets\/index-[\w.-]+\.js)"/);
  return match ? match[1] : null;
}

async function hasNewVersion() {
  try {
    const res = await fetch(`/index.html?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return false;
    const html = await res.text();
    const latest = extractBundleUrl(html);
    return Boolean(latest) && !CURRENT_BUNDLE.endsWith(latest);
  } catch {
    return false;
  }
}

// Deteta quando já foi publicada uma versão mais recente enquanto esta
// continua aberta num separador — comum em tablets/telemóveis que ficam
// "suspensos" em vez de recarregar sozinhos — e mostra um aviso para
// atualizar, em vez de a pessoa ficar presa numa versão antiga sem saber.
function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let cancelled = false;
    const check = async () => {
      const found = await hasNewVersion();
      if (found && !cancelled) setUpdateAvailable(true);
    };
    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <button
      onClick={() => window.location.reload()}
      style={{ fontFamily: "'Inter', sans-serif" }}
      className="fixed top-0 inset-x-0 z-[100] bg-[#EA5B13] hover:bg-[#FF6B1A] text-[#14181F] text-sm font-medium py-2 px-4 flex items-center justify-center gap-2 transition-colors"
    >
      <RefreshCw size={14} /> Nova versão disponível — toca para atualizar
    </button>
  );
}

export { UpdateBanner };
