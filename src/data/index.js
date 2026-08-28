const STORAGE_KEY = "agenda-treinador-data";
const POSICOES = ["Base", "Extremo", "Poste", "Ala", "Ala-Poste"];
const HABILIDADES = [
  { id: "d-ti-1", fase: "Defesa", componente: "Técnica individual", nome: "Posição básica" },
  { id: "d-ti-2", fase: "Defesa", componente: "Técnica individual", nome: "Deslocamentos defensivos" },
  { id: "d-ti-3", fase: "Defesa", componente: "Técnica individual", nome: "Defesa 1x1 com bola" },
  { id: "d-ti-4", fase: "Defesa", componente: "Técnica individual", nome: "Defesa da 1ª linha de passe" },
  { id: "d-ti-5", fase: "Defesa", componente: "Técnica individual", nome: "Defesa do jogador sem bola (lado fraco)" },
  { id: "d-ti-6", fase: "Defesa", componente: "Técnica individual", nome: "Defesa do corte para a bola" },
  { id: "d-ti-7", fase: "Defesa", componente: "Técnica individual", nome: "Defesa do passe e corta" },
  { id: "d-ti-8", fase: "Defesa", componente: "Técnica individual", nome: "Ajuda e recuperação defensiva" },
  { id: "d-ti-9", fase: "Defesa", componente: "Técnica individual", nome: "Lado forte" },
  { id: "d-ti-10", fase: "Defesa", componente: "Técnica individual", nome: "Lado fraco" },
  { id: "d-ti-11", fase: "Defesa", componente: "Técnica individual", nome: "Jogador interior" },
  { id: "d-ti-12", fase: "Defesa", componente: "Técnica individual", nome: "Jogador exterior" },
  { id: "d-ti-13", fase: "Defesa", componente: "Técnica individual", nome: "Ressalto defensivo" },
  { id: "d-ti-14", fase: "Defesa", componente: "Técnica individual", nome: "Defesa do jogador interior" },
  { id: "d-ta-1", fase: "Defesa", componente: "Tática individual", nome: "Identificação e adaptação da defesa em função do atacante c/ bola e da vantagem/desvantagem" },
  { id: "d-ta-2", fase: "Defesa", componente: "Tática individual", nome: "Identificação das características do atacante sem bola e adaptação da defesa às mesmas" },
  { id: "d-ta-3", fase: "Defesa", componente: "Tática individual", nome: "Identificação e adaptação da defesa ao jogador interior em função de situações de vantagem/desvantagem" },
  { id: "d-tc-1", fase: "Defesa", componente: "Tática coletiva", nome: "Transição defensiva / Recuperação Defensiva" },
  { id: "d-tc-2", fase: "Defesa", componente: "Tática coletiva", nome: "Defesa de reposições na linha de fundo" },
  { id: "d-tc-3", fase: "Defesa", componente: "Tática coletiva", nome: "Defesa individual em diferentes extensões do campo" },
  { id: "d-tc-4", fase: "Defesa", componente: "Tática coletiva", nome: "Salta e troca" },
  { id: "d-tc-5", fase: "Defesa", componente: "Tática coletiva", nome: "Defesa em 2x1" },
  { id: "d-tc-6", fase: "Defesa", componente: "Tática coletiva", nome: "Defesa em 2x1 sobre jogador interior" },
  { id: "a-ti-1", fase: "Ataque", componente: "Técnica individual", nome: "Posição básica, deslizamentos e jogo sem bola" },
  { id: "a-ti-2", fase: "Ataque", componente: "Técnica individual", nome: "Receção de bola e fintas de receção" },
  { id: "a-ti-3", fase: "Ataque", componente: "Técnica individual", nome: "Passes estáticos, em movimento e em drible" },
  { id: "a-ti-4", fase: "Ataque", componente: "Técnica individual", nome: "Posição básica com bola, manejo de bola e fundamentos do drible" },
  { id: "a-ti-5", fase: "Ataque", componente: "Técnica individual", nome: "Penetrações para o cesto depois de passe e drible com máxima variação" },
  { id: "a-ti-6", fase: "Ataque", componente: "Técnica individual", nome: "Lançamento em suspensão" },
  { id: "a-ti-7", fase: "Ataque", componente: "Técnica individual", nome: "Lançamento estatico" },
  { id: "a-ti-8", fase: "Ataque", componente: "Técnica individual", nome: "Gancho / Semi-gancho" },
  { id: "a-ti-9", fase: "Ataque", componente: "Técnica individual", nome: "Lançamentos de baixo do aro e efeitos" },
  { id: "a-ti-10", fase: "Ataque", componente: "Técnica individual", nome: "Movimentos do jogador interior" },
  { id: "a-ti-11", fase: "Ataque", componente: "Técnica individual", nome: "Ressalto ofensivo" },
  { id: "a-ti-12", fase: "Ataque", componente: "Técnica individual", nome: "Jogo 2x2" },
  { id: "a-ti-13", fase: "Ataque", componente: "Técnica individual", nome: "2 Jogadores exteriores" },
  { id: "a-ti-14", fase: "Ataque", componente: "Técnica individual", nome: "Interior-exterior" },
  { id: "a-ti-15", fase: "Ataque", componente: "Técnica individual", nome: "Jogo 3x3" },
  { id: "a-ti-16", fase: "Ataque", componente: "Técnica individual", nome: "3 Jogadores exteriores" },
  { id: "a-ti-17", fase: "Ataque", componente: "Técnica individual", nome: "2 Jogadores exteriores e 1 jogador interior" },
  { id: "a-ti-18", fase: "Ataque", componente: "Técnica individual", nome: "Superioridades" },
  { id: "a-ta-1", fase: "Ataque", componente: "Tática individual", nome: "Possibilidades táticas ofensivas no 1x1 com bola – prioridades: o uso do passe, drible e lançamento." },
  { id: "a-ta-2", fase: "Ataque", componente: "Tática individual", nome: "Identificação e castigo no 1x1 às desvantagens defensivas por razões físicas ou técnicas" },
  { id: "a-ta-3", fase: "Ataque", componente: "Tática individual", nome: "Alternativas táticas, sem bola na 1ª linha de passe:" },
  { id: "a-ta-4", fase: "Ataque", componente: "Tática individual", nome: "Fintas de receção" },
  { id: "a-ta-5", fase: "Ataque", componente: "Tática individual", nome: "Cortes para o lado fraco" },
  { id: "a-ta-6", fase: "Ataque", componente: "Tática individual", nome: "Corte em V" },
  { id: "a-ta-7", fase: "Ataque", componente: "Tática individual", nome: "Possibilidade táticas sem bola - lado fraco" },
  { id: "a-ta-8", fase: "Ataque", componente: "Tática individual", nome: "Posição de tripla ameaça - simular lançamento" },
  { id: "a-ta-9", fase: "Ataque", componente: "Tática individual", nome: "Corte nas costas" },
  { id: "a-ta-10", fase: "Ataque", componente: "Tática individual", nome: "Corte para o lado forte" },
  { id: "a-ta-11", fase: "Ataque", componente: "Tática individual", nome: "Conhecimento e exploração das capacidades individuais" },
  { id: "a-ta-12", fase: "Ataque", componente: "Tática individual", nome: "Conhecimento e exploração das capacidades dos companheiros" },
  { id: "a-tc-1", fase: "Ataque", componente: "Tática coletiva", nome: "Conceitos de colocação em bolas aéreas disputadas" },
  { id: "a-tc-2", fase: "Ataque", componente: "Tática coletiva", nome: "Conceitos e jogadas de reposição na linha de fundo" },
  { id: "a-tc-3", fase: "Ataque", componente: "Tática coletiva", nome: "Conceitos de colocação em lances-livres próprios" },
  { id: "a-tc-4", fase: "Ataque", componente: "Tática coletiva", nome: "Transição defesa-ataque" },
  { id: "a-tc-5", fase: "Ataque", componente: "Tática coletiva", nome: "Depois de roubar bola" },
  { id: "a-tc-6", fase: "Ataque", componente: "Tática coletiva", nome: "Depois de ressalto defensivo" },
  { id: "a-tc-7", fase: "Ataque", componente: "Tática coletiva", nome: "Equilíbrio ofensivo:" },
  { id: "a-tc-8", fase: "Ataque", componente: "Tática coletiva", nome: "Ressalto ofensivo" },
  { id: "a-tc-9", fase: "Ataque", componente: "Tática coletiva", nome: "Ressalto longo" },
  { id: "a-tc-10", fase: "Ataque", componente: "Tática coletiva", nome: "Preparação do balanço defensivo/recuperação defensiva" },
  { id: "a-tc-11", fase: "Ataque", componente: "Tática coletiva", nome: "Jogo 2x2" },
  { id: "a-tc-12", fase: "Ataque", componente: "Tática coletiva", nome: "2 Jogadores exteriores" },
  { id: "a-tc-13", fase: "Ataque", componente: "Tática coletiva", nome: "Interior-exterior" },
  { id: "a-tc-14", fase: "Ataque", componente: "Tática coletiva", nome: "2 Jogadores interiores" },
  { id: "a-tc-15", fase: "Ataque", componente: "Tática coletiva", nome: "Jogo 3x3" },
  { id: "a-tc-16", fase: "Ataque", componente: "Tática coletiva", nome: "3 Jogadores exteriores" },
  { id: "a-tc-17", fase: "Ataque", componente: "Tática coletiva", nome: "2 Jogadores exteriores e 1 jogador interior" },
  { id: "a-tc-18", fase: "Ataque", componente: "Tática coletiva", nome: "Ataque por conceitos e sistemas contra defesas individuais" },
  { id: "a-tc-19", fase: "Ataque", componente: "Tática coletiva", nome: "4 Jogadores exteriores e 1 jogador interior" },
  { id: "a-tc-20", fase: "Ataque", componente: "Tática coletiva", nome: "5 Jogadores exteriores" },
];
function getHabilidade(id) {
  return HABILIDADES.find((h) => h.id === id);
}
function habilidadeLabel(id) {
  const h = getHabilidade(id);
  return h ? h.nome : id || "—";
}
const emptyPlayer = {
  nome: "",
  numero: "",
  posicao: POSICOES[0],
  nascimento: "",
  notas: "",
  foto: "",
  morada: "",
  cidade: "",
  cc: "",
  nif: "",
  profissao: "",
  email: "",
  telemovel: "",
  epocasClube: "",
  medicacao: "",
  outrosDesportos: "",
  lesoes: [],
  avaliacoes: [],
  testesFisicos: [],
};
const emptyLesao = { id: "", ano: "", descricao: "" };
const emptyAvaliacao = { id: "", data: "", altura: "", peso: "", envergadura: "", obs: "" };
const TIPOS_TESTE = [
  { id: "sprint10", nome: "Sprint 10m", unidade: "s", categoria: "Velocidade" },
  { id: "sprint20", nome: "Sprint 20m", unidade: "s", categoria: "Velocidade" },
  { id: "sprint30", nome: "Sprint 30m", unidade: "s", categoria: "Velocidade" },
  { id: "t_test", nome: "T-Test", unidade: "s", categoria: "Agilidade" },
  { id: "illinois", nome: "Illinois Agility Test", unidade: "s", categoria: "Agilidade" },
  { id: "shuttle_run", nome: "Shuttle Run 5-10-5", unidade: "s", categoria: "Agilidade" },
  { id: "salto_vertical", nome: "Salto vertical (CMJ)", unidade: "cm", categoria: "Força" },
  { id: "salto_horizontal", nome: "Salto horizontal (sem impulso)", unidade: "cm", categoria: "Força" },
  { id: "lancamento_medicinal", nome: "Lançamento bola medicinal", unidade: "m", categoria: "Força" },
  { id: "vaivem", nome: "Vaivém / Course Navette (nível)", unidade: "nível", categoria: "Resistência" },
  { id: "cooper", nome: "Teste de Cooper (12 min)", unidade: "m", categoria: "Resistência" },
  { id: "yoyo", nome: "Yo-Yo Intermittent Recovery", unidade: "m", categoria: "Resistência" },
  { id: "outro", nome: "Outro (personalizado)", unidade: "", categoria: "Outro" },
];
function getTipoTeste(id) {
  return TIPOS_TESTE.find((t) => t.id === id) || TIPOS_TESTE[TIPOS_TESTE.length - 1];
}
const emptyTesteFisico = { id: "", data: "", tipoId: TIPOS_TESTE[0].id, nomePersonalizado: "", valor: "", obs: "" };
const emptySession = { type: "treino", date: "", title: "", objetivo: "", exercicios: [], observacoes: "", adversario: "", resultado: "", conteudo: "", realizado: false };
const emptyJogo = {
  type: "jogo",
  date: "",
  horario: "",
  title: "",
  campeonato: "",
  jogoNumero: "",
  local: "",
  adversario: "",
  treinadorPrincipal: "",
  treinadorPrincipalLicenca: "",
  treinadorAdjunto: "",
  treinadorAdjuntoLicenca: "",
  dirigentes: [], // [{id, nome, licenca}]
  convocatoria: {}, // { playerId: [p1, p2, p3, p4] }
  objetivosJogo: [], // [{id, texto}]
  reflexaoPreparacao: "",
  palestraInicial: "",
  descontosTempo: "",
  resultado: "",
  conteudo: "",
  apreciacaoGeral: "",
  estatisticas: {}, // { playerId: { pontos, ressaltos, assistencias, roubos, bloqueios, faltas } }
};
const ESTATISTICAS_CAMPOS = [
  { key: "pontos", label: "Pts", nome: "Pontos" },
  { key: "ressaltos", label: "Res", nome: "Ressaltos" },
  { key: "assistencias", label: "Ass", nome: "Assistências" },
  { key: "roubos", label: "Rou", nome: "Roubos de bola" },
  { key: "bloqueios", label: "Blq", nome: "Bloqueios" },
  { key: "faltas", label: "Flt", nome: "Faltas cometidas" },
];
const emptyLibraryItem = { nome: "", categoria: HABILIDADES[0].id, duracaoPadrao: "", descricao: "", diagramas: [] };
const ARROW_TYPES = [
  { id: "passe", label: "Passe", desc: "linha tracejada" },
  { id: "drible", label: "Drible", desc: "linha ondulada" },
  { id: "corte", label: "Corte", desc: "linha contínua" },
  { id: "bloqueio", label: "Bloqueio", desc: "traço grosso, arrasta na direção do bloqueio" },
  { id: "lancamento", label: "Lançamento", desc: "arco pontilhado até ao alvo" },
];
const HALF_VB = { w: 300, h: 320 };
const FULL_VB = { w: 300, h: 560 };
const COMPONENTES = ["Técnica individual", "Tática individual", "Tática coletiva"];
function habilidadeGroups() {
  const groups = [];
  const seen = new Map();
  HABILIDADES.forEach((h) => {
    const key = `${h.fase}|${h.componente}`;
    if (!seen.has(key)) {
      const g = { label: `${h.fase} — ${h.componente}`, items: [] };
      seen.set(key, g);
      groups.push(g);
    }
    seen.get(key).items.push(h);
  });
  return groups;
}

const PERIODOS = ["1º", "2º", "3º", "4º"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DIAS_SEMANA = ["S", "T", "Q", "Q", "S", "S", "D"];

export {
  STORAGE_KEY,
  POSICOES,
  HABILIDADES,
  getHabilidade,
  habilidadeLabel,
  emptyPlayer,
  emptyLesao,
  emptyAvaliacao,
  TIPOS_TESTE,
  getTipoTeste,
  emptyTesteFisico,
  emptySession,
  emptyJogo,
  ESTATISTICAS_CAMPOS,
  emptyLibraryItem,
  ARROW_TYPES,
  HALF_VB,
  FULL_VB,
  COMPONENTES,
  habilidadeGroups,
  PERIODOS,
  MESES,
  MESES_ABREV,
  DIAS_SEMANA,
};
