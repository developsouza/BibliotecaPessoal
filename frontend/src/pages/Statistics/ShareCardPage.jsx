import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "../../api/axios";

/**
 * Página pública do card de compartilhamento.
 * Acessível via /statistics/share-card?type=summary|books|streak
 *
 * Meta tags Open Graph são geradas dinamicamente via document.head.
 */
export default function ShareCardPage() {
    const [searchParams] = useSearchParams();
    const type = searchParams.get("type") || "summary";
    const cardRef = useRef(null);

    const [card, setCard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        api.get(`/statistics/share-card?type=${type}`)
            .then((r) => {
                setCard(r.data);
                // Open Graph meta tags dinâmicas
                updateMetaTags(r.data);
            })
            .catch((err) => {
                if (err.response?.status === 401) {
                    setError("Você precisa estar logado para ver este card.");
                } else if (err.response?.status === 403) {
                    setError("Este recurso requer um plano Premium ou superior.");
                } else {
                    setError("Erro ao carregar o card. Tente novamente.");
                }
            })
            .finally(() => setLoading(false));
    }, [type]);

    function updateMetaTags(data) {
        const setMeta = (prop, content, isProp = true) => {
            let el = document.querySelector(isProp ? `meta[property="${prop}"]` : `meta[name="${prop}"]`);
            if (!el) {
                el = document.createElement("meta");
                el.setAttribute(isProp ? "property" : "name", prop);
                document.head.appendChild(el);
            }
            el.setAttribute("content", content);
        };
        document.title = `${data.userName} no BookLibrary`;
        setMeta("og:title", `${data.userName} no BookLibrary`);
        setMeta("og:description", `Já li ${data.booksRead} livros totalizando ${data.totalPages} páginas! Estou no nível ${data.level}. 📚`);
        setMeta("og:image", `${window.location.origin}/images/share-card-preview.png`);
        setMeta("twitter:card", "summary_large_image", false);
    }

    async function handleDownload() {
        if (!cardRef.current) return;
        try {
            setDownloading(true);
            const html2canvas = (await import("html2canvas")).default;
            const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true });
            const link = document.createElement("a");
            link.download = `booklibrary-card-${card?.userName?.replace(/\s+/g, "_") || "card"}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
        } catch {
            alert("Instale html2canvas para usar o download: npm install html2canvas");
        } finally {
            setDownloading(false);
        }
    }

    if (loading)
        return (
            <div className="min-h-screen flex items-center justify-center bg-[--color-bg]">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );

    if (error)
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[--color-bg] p-6">
                <i className="fa-solid fa-circle-exclamation text-4xl text-red-500" />
                <p className="text-[--color-text] text-center">{error}</p>
                <Link to="/login" className="btn-primary">
                    Fazer login
                </Link>
            </div>
        );

    if (!card) return null;

    const shareText = encodeURIComponent(`Já li ${card.booksRead} livros no BookLibrary! 📚 Estou no nível ${card.level}! 🏆`);
    const shareUrl = encodeURIComponent(window.location.href);

    const networks = [
        {
            name: "Twitter/X",
            icon: "fa-brands fa-x-twitter",
            color: "bg-black text-white hover:opacity-80",
            url: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,
        },
        {
            name: "Facebook",
            icon: "fa-brands fa-facebook-f",
            color: "bg-blue-600 text-white hover:bg-blue-700",
            url: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
        },
        {
            name: "WhatsApp",
            icon: "fa-brands fa-whatsapp",
            color: "bg-green-500 text-white hover:bg-green-600",
            url: `https://api.whatsapp.com/send?text=${shareText}%20${shareUrl}`,
        },
        {
            name: "LinkedIn",
            icon: "fa-brands fa-linkedin-in",
            color: "bg-blue-700 text-white hover:bg-blue-800",
            url: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`,
        },
    ];

    const handleCopy = () => {
        navigator.clipboard.writeText(`${decodeURIComponent(shareText)} ${decodeURIComponent(shareUrl)}`).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        });
    };

    const typeLabel = { summary: "Resumo", books: "Livros", streak: "Sequência" }[card.type] || "Resumo";

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900 flex flex-col items-center justify-center p-6 gap-8">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-2xl font-bold text-white mb-1 flex items-center justify-center gap-2">
                    <i className="fa-solid fa-share-nodes text-primary-400" /> Card de {typeLabel}
                </h1>
                <p className="text-white/60 text-sm">Compartilhe suas conquistas de leitura</p>
            </div>

            {/* Card visual */}
            <div
                ref={cardRef}
                className="rounded-3xl bg-gradient-to-br from-primary-600 via-primary-700 to-violet-800 text-white p-8 w-full max-w-sm shadow-2xl shadow-primary-900/50"
            >
                {/* Header do card */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">📚</div>
                    <div>
                        <p className="font-bold text-xl leading-tight">{card.userName}</p>
                        <p className="text-white/70 text-sm">
                            Nível {card.level} · {card.totalPoints} pontos
                        </p>
                        {card.favoriteCategory && card.favoriteCategory !== "N/A" && (
                            <p className="text-white/60 text-xs mt-0.5">❤️ {card.favoriteCategory}</p>
                        )}
                    </div>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    {(card.type === "summary" || card.type === "books") && (
                        <>
                            <div className="bg-white/10 rounded-2xl p-4 text-center">
                                <p className="text-3xl font-bold">{card.booksRead}</p>
                                <p className="text-white/70 text-xs mt-0.5">Livros lidos</p>
                            </div>
                            <div className="bg-white/10 rounded-2xl p-4 text-center">
                                <p className="text-3xl font-bold">{(card.totalPages || 0).toLocaleString("pt-BR")}</p>
                                <p className="text-white/70 text-xs mt-0.5">Páginas</p>
                            </div>
                        </>
                    )}
                    {(card.type === "summary" || card.type === "streak") && (
                        <div className={`bg-white/10 rounded-2xl p-4 text-center ${card.type === "streak" ? "col-span-2" : ""}`}>
                            <p className="text-3xl font-bold">{card.currentStreak}🔥</p>
                            <p className="text-white/70 text-xs mt-0.5">Sequência atual</p>
                        </div>
                    )}
                    {card.averageRating > 0 && (
                        <div className="bg-white/10 rounded-2xl p-4 text-center">
                            <p className="text-3xl font-bold">{card.averageRating}★</p>
                            <p className="text-white/70 text-xs mt-0.5">Avaliação média</p>
                        </div>
                    )}
                </div>

                {/* Seletor de tipo */}
                <div className="text-center text-white/40 text-xs">BookLibrary · {new Date().getFullYear()}</div>
            </div>

            {/* Seletor de tipo */}
            <div className="flex gap-2">
                {["summary", "books", "streak"].map((t) => (
                    <Link
                        key={t}
                        to={`/statistics/share-card?type=${t}`}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                            type === t ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30" : "bg-white/10 text-white/70 hover:bg-white/20"
                        }`}
                    >
                        {{ summary: "📊 Resumo", books: "📚 Livros", streak: "🔥 Sequência" }[t]}
                    </Link>
                ))}
            </div>

            {/* Botões de ação */}
            <div className="flex flex-wrap gap-3 justify-center max-w-md">
                {networks.map((net) => (
                    <button
                        key={net.name}
                        onClick={() => window.open(net.url, "_blank", "width=600,height=450")}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${net.color}`}
                    >
                        <i className={net.icon} />
                        {net.name}
                    </button>
                ))}
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-all"
                >
                    <i className={`fa-solid ${copied ? "fa-check text-green-400" : "fa-copy"}`} />
                    {copied ? "Copiado!" : "Copiar link"}
                </button>
                <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-all disabled:opacity-50"
                >
                    <i className={`fa-solid ${downloading ? "fa-spinner fa-spin" : "fa-download"}`} />
                    {downloading ? "Gerando..." : "Baixar imagem"}
                </button>
            </div>

            {/* Link de volta */}
            <Link to="/statistics" className="text-white/50 hover:text-white/80 text-sm transition-colors flex items-center gap-1">
                <i className="fa-solid fa-arrow-left text-xs" /> Ver todas as estatísticas
            </Link>
        </div>
    );
}
