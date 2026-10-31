import { useEffect, useRef, useState } from "react";

// Mesma técnica usada na barra de edição (EditToolbar.jsx): scroll
// horizontal em vez de quebrar para a linha seguinte, com scroll-snap
// (nunca para a meio de um botão) e um desvanecido na borda direita que só
// aparece quando há mesmo mais conteúdo a seguir.
const fade = "linear-gradient(to right, black calc(100% - 18px), transparent 100%)";

function ScrollRow({ className = "", children }) {
  const ref = useRef(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setHasMore(el.scrollWidth - el.scrollLeft - el.clientWidth > 4);
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, [children]);

  return (
    <div
      ref={ref}
      className={`flex items-center overflow-x-auto [scroll-snap-type:x_proximity] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      style={hasMore ? { WebkitOverflowScrolling: "touch", WebkitMaskImage: fade, maskImage: fade } : { WebkitOverflowScrolling: "touch" }}
    >
      {children}
    </div>
  );
}

export { ScrollRow };
