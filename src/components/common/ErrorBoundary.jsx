// Apanha erros de renderização dentro de um separador (ex: um campo com
// formato inesperado que a app ainda não previa) para não levar a app
// inteira a ficar em branco — só esta secção fica com uma mensagem, o
// resto (barra lateral, outros separadores) continua a funcionar.
import { Component } from "react";
import { AlertTriangle } from "lucide-react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Erro apanhado pelo ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="bg-[#1E242E] border border-[#D64545]/40 rounded-lg p-5 max-w-xl">
          <div className="flex items-center gap-2 text-[#D64545] mb-2">
            <AlertTriangle size={18} />
            <span style={{ fontFamily: "'Oswald', sans-serif" }} className="uppercase tracking-wide font-semibold">
              Ocorreu um erro nesta secção
            </span>
          </div>
          <div className="text-sm text-[#8A93A3] mb-3">
            O resto da app continua a funcionar — muda de separador na barra lateral. Se o erro persistir, envia esta mensagem a quem desenvolve a app:
          </div>
          <pre className="text-xs text-[#D64545] bg-[#14181F] border border-[#2E3644] rounded p-2 overflow-auto whitespace-pre-wrap">
            {String((this.state.error && this.state.error.message) || this.state.error)}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-3 text-xs px-3 py-1.5 rounded-md border border-[#2E3644] text-[#8A93A3] hover:text-[#F2EDE3] hover:border-[#5A6272]"
          >
            Tentar outra vez
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export { ErrorBoundary };
