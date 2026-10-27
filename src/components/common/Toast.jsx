import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { subscribeToast } from "../../lib/toast";

const DURATION_MS = 3500;

function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return subscribeToast((toast) => {
      setToasts((list) => [...list, toast]);
      setTimeout(() => {
        setToasts((list) => list.filter((t) => t.id !== toast.id));
      }, DURATION_MS);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end" style={{ fontFamily: "'Inter', sans-serif" }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2 bg-[#1E242E] border border-[#4C9A6A]/40 text-[#F2EDE3] text-sm rounded-md px-3.5 py-2.5 shadow-lg"
        >
          <CheckCircle2 size={15} className="text-[#4C9A6A] shrink-0" />
          {t.message}
        </div>
      ))}
    </div>
  );
}

export { ToastHost };
