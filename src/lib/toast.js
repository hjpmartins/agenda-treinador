// Aviso global e simples (ex: "Treino descarregado") para ações como
// descarregar um ficheiro, que não têm mais nenhuma confirmação visível na
// app — o download em si é silencioso (o navegador só mostra algo, se
// mostrar, fora da janela da app). Qualquer módulo pode chamar showToast
// diretamente, sem precisar de passar funções de contexto React por várias
// camadas de componentes; só o <ToastHost/>, montado uma vez no topo da app,
// é que ouve e mostra.
let listeners = [];
let idCounter = 0;

function showToast(message) {
  const id = ++idCounter;
  listeners.forEach((fn) => fn({ id, message }));
}

function subscribeToast(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export { showToast, subscribeToast };
