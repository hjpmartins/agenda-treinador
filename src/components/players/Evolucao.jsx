import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ESTATISTICAS_CAMPOS, getTipoTeste } from "../../data";
import { formatDateFull, formatDateShortYear } from "../../utils";
import { Modal, EmptyState } from "../common/Modal";

function EvolucaoChart({ title, unidade, data }) {
  if (data.length === 0) return null;
  return (
    <div className="bg-[#14181F] border border-[#2E3644] rounded-md p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium">{title}</span>
        {unidade && <span className="text-[10px] text-[#5A6272]">{unidade}</span>}
      </div>
      {data.length === 1 ? (
        <div className="text-[11px] text-[#8A93A3] py-4 text-center">
          Só há um registo ({formatDateFull(data[0].dataRaw)}: <b className="text-[#F2EDE3]">{data[0].valor}{unidade}</b>). Adiciona mais para veres a evolução.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2E3644" />
            <XAxis dataKey="dataLabel" tick={{ fill: "#8A93A3", fontSize: 10 }} axisLine={{ stroke: "#2E3644" }} tickLine={false} />
            <YAxis tick={{ fill: "#8A93A3", fontSize: 10 }} axisLine={{ stroke: "#2E3644" }} tickLine={false} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: "#1E242E", border: "1px solid #2E3644", borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: "#F2EDE3" }}
              itemStyle={{ color: "#EA5B13" }}
            />
            <Line type="monotone" dataKey="valor" stroke="#EA5B13" strokeWidth={2} dot={{ r: 3, fill: "#EA5B13" }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function EvolucaoModal({ player, sessions, onClose }) {
  const avaliacoes = [...(player.avaliacoes || [])]
    .filter((a) => a.data)
    .sort((a, b) => (a.data > b.data ? 1 : -1));
  const testes = [...(player.testesFisicos || [])]
    .filter((t) => t.data && t.valor !== "")
    .sort((a, b) => (a.data > b.data ? 1 : -1));
  const jogosComEstatisticas = [...(sessions || [])]
    .filter((s) => s.type === "jogo" && s.estatisticas && s.estatisticas[player.id])
    .sort((a, b) => (a.data > b.data ? 1 : -1));

  const toChartData = (list, key) =>
    list
      .filter((item) => item[key] !== "" && item[key] != null)
      .map((item) => ({ dataLabel: formatDateShortYear(item.data), dataRaw: item.data, valor: Number(item[key]) }));

  const alturaData = toChartData(avaliacoes, "altura");
  const pesoData = toChartData(avaliacoes, "peso");
  const envergaduraData = toChartData(avaliacoes, "envergadura");

  const testesPorTipo = {};
  testes.forEach((t) => {
    const key = t.tipoId;
    testesPorTipo[key] = testesPorTipo[key] || [];
    testesPorTipo[key].push(t);
  });

  const estatisticasChartData = (campo) =>
    jogosComEstatisticas
      .filter((s) => s.estatisticas[player.id][campo] !== "" && s.estatisticas[player.id][campo] != null)
      .map((s) => ({
        dataLabel: `${formatDateShortYear(s.date)} vs ${s.adversario || "?"}`,
        dataRaw: s.date,
        valor: Number(s.estatisticas[player.id][campo]),
      }));

  return (
    <Modal onClose={onClose} title={`Evolução — ${player.nome || "Jogador"}`} wide>
      <div className="grid grid-cols-2 gap-3">
        <EvolucaoChart title="Altura" unidade="m" data={alturaData} />
        <EvolucaoChart title="Peso" unidade="kg" data={pesoData} />
        <EvolucaoChart title="Envergadura" unidade="cm" data={envergaduraData} />
        {Object.entries(testesPorTipo).map(([tipoId, list]) => {
          const tipo = getTipoTeste(tipoId);
          const nome = tipoId === "outro" ? (list[0].nomePersonalizado || "Teste personalizado") : tipo.nome;
          const unidade = tipoId === "outro" ? (list[0].unidadePersonalizada || "") : tipo.unidade;
          return <EvolucaoChart key={tipoId} title={nome} unidade={unidade} data={toChartData(list, "valor")} />;
        })}
      </div>
      {jogosComEstatisticas.length > 0 && (
        <>
          <div className="text-xs uppercase tracking-wide text-[#8A93A3] mt-5 mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Estatísticas de jogo</div>
          <div className="grid grid-cols-2 gap-3">
            {ESTATISTICAS_CAMPOS.map((c) => (
              <EvolucaoChart key={c.key} title={c.nome} unidade="" data={estatisticasChartData(c.key)} />
            ))}
          </div>
        </>
      )}
      {alturaData.length === 0 && pesoData.length === 0 && envergaduraData.length === 0 && Object.keys(testesPorTipo).length === 0 && jogosComEstatisticas.length === 0 && (
        <EmptyState text="Ainda não há dados suficientes para mostrar gráficos." />
      )}
      <div className="flex justify-end mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-[#8A93A3] hover:text-[#F2EDE3]">Fechar</button>
      </div>
    </Modal>
  );
}

export { EvolucaoChart, EvolucaoModal };

