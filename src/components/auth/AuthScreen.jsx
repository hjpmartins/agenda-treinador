import { useState } from "react";
import { Trophy, Loader2 } from "lucide-react";
import { signIn, signUp } from "../../lib/auth";
import { inputCls } from "../../ui";

function AuthScreen() {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [signupDone, setSignupDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        setSignupDone(true);
      }
    } catch (err) {
      setError(err.message || "Ocorreu um erro. Tenta novamente.");
    } finally {
      setLoading(false);
    }
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
          <div className="flex gap-1.5 mb-5 bg-[#14181F] rounded-md p-1">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); setSignupDone(false); }}
              className={`flex-1 text-sm py-1.5 rounded ${mode === "login" ? "bg-[#EA5B13] text-[#14181F] font-medium" : "text-[#8A93A3]"}`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setError(null); setSignupDone(false); }}
              className={`flex-1 text-sm py-1.5 rounded ${mode === "signup" ? "bg-[#EA5B13] text-[#14181F] font-medium" : "text-[#8A93A3]"}`}
            >
              Criar conta
            </button>
          </div>

          {signupDone ? (
            <div className="text-sm text-[#4C9A6A] bg-[#4C9A6A]/10 border border-[#4C9A6A]/30 rounded px-3 py-2.5">
              Conta criada! Verifica o teu email para confirmares o registo antes de entrares.
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <label className="block">
                <span className="block text-xs text-[#8A93A3] mb-1">Email</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="treinador@exemplo.com"
                />
              </label>
              <label className="block">
                <span className="block text-xs text-[#8A93A3] mb-1">Palavra-passe</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                {mode === "login" ? "Entrar" : "Criar conta"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export { AuthScreen };
