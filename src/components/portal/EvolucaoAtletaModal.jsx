// Versão do "Ver evolução" (src/components/players/Evolucao.jsx) para o
// portal da atleta: os mesmos gráficos, só que a partir dos dados já
// filtrados pela função portal_get_evolucao (ver src/lib/portalDb.js),
// sem precisar do objeto "player"/"sessions" inteiro do treinador.
import { EvolucaoChart } from "../players/Evolucao";
import { ESTATISTICAS_CAMPOS, getTipoTeste, estatisticaNumero } from "../../data";
import { formatDateShortYear } from "../../utils";
import { Modal, EmptyState } from "../common/Modal";

function EvolucaoAtletaModal({ nome, avaliacoes, testesFisicos, jogos, onClose }) {
  const avaliacoesOrdenadas = [...(avaliacoes || [])].filter((a) => a.data).sort((a, b) => (a.data > b.data ? 1 : -1));
  const testes = [...(testesFisicos || [])].filter((t) => t.data && t.valor !== "").sort((a, b) => (a.data > b.data ? 1 : -1));
  const jogosComEstatisticas = [...(jogos || [])].filter((j) => j.estatisticas).sort((a, b) => (a.date > b.date ? 1 : -1));

  const toChartData = (list, key) =>
    list
      .filter((item) => item[key] !== "" && item[key] != null)
      .map((item) => ({ dataLabel: formatDateShortYear(item.data), dataRaw: item.data, valor: Number(item[key]) }));

  const alturaData = toChartData(avaliacoesOrdenadas, "altura");
  const pesoData = toChartData(avaliacoesOrdenadas, "peso");
  const envergaduraData = toChartData(avaliacoesOrdenadas, "envergadura");

  const testesPorTipo = {};
  testes.forEach((t) => {
    const key = t.tipoId;
    testesPorTipo[key] = testesPorTipo[key] || [];
    testesPorTipo[key].push(t);
  });

  const estatisticasChartData = (campo) =>
    jogosComEstatisticas.map((j) => ({
      dataLabel: `${formatDateShortYear(j.date)} vs ${j.adversario || "?"}`,
      dataRaw: j.date,
      valor: estatisticaNumero(campo, j.estatisticas),
    }));

  const semDados =
    alturaData.length === 0 && pesoData.length === 0 && envergaduraData.length === 0 && Object.keys(testesPorTipo).length === 0 && jogosComEstatisticas.length === 0;

  return (
    <Modal onClose={onClose} title={`A minha evolução — ${nome}`} wide>
      <div className="grid grid-cols-2 gap-3">
        <EvolucaoChart title="Altura" unidade="m" data={alturaData} />
        <EvolucaoChart title="Peso" unidade="kg" data={pesoData} />
        <EvolucaoChart title="Envergadura" unidade="cm" data={envergaduraData} />
        {Object.entries(testesPorTipo).map(([tipoId, list]) => {
          const tipo = getTipoTeste(tipoId);
          const nomeTeste = tipoId === "outro" ? (list[0].nomePersonalizado || "Teste personalizado") : tipo.nome;
          const unidade = tipoId === "outro" ? (list[0].unidadePersonalizada || "") : tipo.unidade;
          return <EvolucaoChart key={tipoId} title={nomeTeste} unidade={unidade} data={toChartData(list, "valor")} />;
        })}
      </div>
      {jogosComEstatisticas.length > 0 && (
        <>
          <div className="text-xs uppercase tracking-wide text-[#8A93A3] mt-5 mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Estatísticas de jogo</div>
          <div className="grid grid-cols-2 gap-3">
            {ESTATISTICAS_CAMPOS.map((c) => (
              <EvolucaoChart key={c.key} title={c.nome} unidade="" data={estatisticasChartData(c)} />
            ))}
          </div>
        </>
      )}
      {semDados && <EmptyState text="Ainda não há dados suficientes para mostrar gráficos." />}
      <div className="flex justify-end mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-[#8A93A3] hover:text-[#F2EDE3]">Fechar</button>
      </div>
    </Modal>
  );
}

export { EvolucaoAtletaModal };
