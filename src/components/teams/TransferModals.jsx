import { useState } from "react";
import { inputCls } from "../../ui";
import { Modal, Field, ModalActions, EmptyState } from "../common/Modal";

function TransferModal({ teams, onClose, onConfirm }) {
  const [targetId, setTargetId] = useState(teams[0]?.id || "");
  return (
    <Modal onClose={onClose} title="Copiar para outra equipa">
      {teams.length === 0 ? (
        <EmptyState text="Ainda não tens outra equipa criada. Cria uma primeiro em 'Gerir equipas'." />
      ) : (
        <>
          <p className="text-sm text-[#8A93A3] mb-3">
            Cria uma cópia deste registo (exercícios, objetivos e conteúdo) noutra equipa. Presenças/convocatória e resultado não são copiados, já que dependem do plantel de cada equipa.
          </p>
          <Field label="Equipa de destino">
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={inputCls}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </Field>
        </>
      )}
      <ModalActions onCancel={onClose} onSave={() => onConfirm(targetId)} disabled={teams.length === 0} saveLabel="Copiar" />
    </Modal>
  );
}

function MovePlayerModal({ player, teams, onClose, onConfirm }) {
  const [targetId, setTargetId] = useState(teams[0]?.id || "");
  return (
    <Modal onClose={onClose} title="Mudar de equipa">
      {teams.length === 0 ? (
        <EmptyState text="Ainda não tens outra equipa criada. Cria uma primeiro em 'Gerir equipas'." />
      ) : (
        <>
          <p className="text-sm text-[#F2EDE3] mb-3">
            Vais mover <b>{player.nome}</b> para outra equipa. Ela deixa de aparecer no plantel atual e passa a fazer parte do plantel de destino.
          </p>
          <Field label="Equipa de destino">
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={inputCls}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-[#8A93A3] mt-3">
            A ficha dela (contactos, saúde, avaliações, testes físicos) mantém-se intacta. O histórico de presenças/estatísticas na equipa antiga continua guardado nos treinos/jogos já registados, mas deixa de contar nas estatísticas atuais.
          </p>
        </>
      )}
      <ModalActions onCancel={onClose} onSave={() => onConfirm(targetId)} disabled={teams.length === 0} saveLabel="Mudar de equipa" />
    </Modal>
  );
}

export { TransferModal, MovePlayerModal };
