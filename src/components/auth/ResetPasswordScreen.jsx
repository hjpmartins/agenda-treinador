import { useState } from "react";
import { Trophy, Loader2 } from "lucide-react";
import { updatePassword, signOut } from "../../lib/auth";
import { inputCls } from "../../ui";

// Mostrado depois de se abrir a hiperligação de recuperação de password
// recebida por email — a Supabase já iniciou sessão nessa altura, só falta
// definir a nova palavra-passe antes de entrar na app.
function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("As palavras-passe não coincidem.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await updatePassword(password);
      onDone();
    } catch (err) {
      setError(err.message || "Ocorreu um erro. Tenta novamente.");
    } finally {
      setLoading(false);
    }
  };

  const cancel = async () => {
    await signOut().catch(() => {});
    onDone();
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }} className="min-h-full w-full bg-[#14181F] text-[#F2EDE3] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Trophy size={22} className="text-[#EA5B13]" />
          <span style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide font-semibold">
            Agenda do Treinador
          </span>
        </div>

        <div className="bg-[#1E242E] border border-[#2E3644] rounded-lg p-5">
          <div style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide font-semibold mb-1">
            Nova palavra-passe
          </div>
          <div className="text-xs text-[#8A93A3] mb-4">Define a nova palavra-passe para a tua conta.</div>

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="block text-xs text-[#8A93A3] mb-1">Nova palavra-passe</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="••••••••"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-[#8A93A3] mb-1">Confirmar palavra-passe</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputCls}
                placeholder="••••••••"
              />
            </label>

            {error && (
              <div className="text-xs text-[#D64545] bg-[#D64545]/10 border border-[#D64545]/30 rounded px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#EA5B13] hover:bg-[#FF6B1A] disabled:opacity-60 text-[#14181F] text-sm font-medium rounded-md py-2.5 mt-1"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Guardar nova palavra-passe
            </button>
            <button
              type="button"
              onClick={cancel}
              className="w-full text-xs text-[#8A93A3] hover:text-[#F2EDE3] py-1"
            >
              Cancelar e voltar ao início de sessão
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export { ResetPasswordScreen };
