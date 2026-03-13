import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import billingService, { PLAN_FEATURES } from "../../api/billingService";
import PlanCard from "../../components/Billing/PlanCard";

const PLANS_ORDER = ["free", "premium", "pro"];

// ─── Spotlights de funcionalidades ───────────────────────────
const FEATURE_SPOTLIGHTS = {
    "google-books": {
        requiredPlan: "PREMIUM",
        planColor: "from-yellow-500 to-amber-500",
        planBadgeBg: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
        accentBg: "bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/10",
        accentBorder: "border-yellow-200 dark:border-yellow-800",
        icon: "fa-brands fa-google",
        iconBg: "bg-white dark:bg-slate-800 shadow-md",
        iconColor: "text-blue-500",
        title: "Google Books Import",
        subtitle: "Chega de digitar tudo manualmente.",
        description:
            "Importe qualquer livro direto da maior base de dados do mundo. Busque por título, autor ou ISBN e preencha todos os campos automaticamente em segundos — incluindo capa, sinopse, editora e muito mais.",
        benefits: [
            { icon: "fa-magnifying-glass", text: "Busca por título, autor ou ISBN" },
            { icon: "fa-wand-magic-sparkles", text: "Preenchimento automático de todos os campos" },
            { icon: "fa-image", text: "Capa importada em alta resolução" },
            { icon: "fa-tags", text: "Detecção automática de categoria" },
            { icon: "fa-layer-group", text: "Importação em lote pela página Google Books" },
        ],
        preview: (
            <div className="relative w-full max-w-xs mx-auto select-none">
                {/* Mockup de card de livro importado */}
                <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-white dark:bg-slate-800 shadow-lg p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                        <i className="fa-brands fa-google" /> google books
                    </div>
                    <div className="flex gap-3">
                        <div className="w-12 h-16 rounded bg-gradient-to-br from-indigo-400 to-purple-500 flex-shrink-0 flex items-center justify-center">
                            <i className="fa-solid fa-book text-white text-lg" />
                        </div>
                        <div className="space-y-1 flex-1 min-w-0">
                            <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded w-3/4" />
                            <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded w-1/2" />
                            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded w-2/3 mt-1" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                        {["Título", "Autor", "Editora", "ISBN", "Páginas", "Sinopse"].map((f) => (
                            <div key={f} className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
                                <i className="fa-solid fa-check-circle text-[9px]" /> {f}
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs py-1.5 px-2.5 rounded-lg">
                        <i className="fa-solid fa-circle-check" /> Tudo preenchido automaticamente!
                    </div>
                </div>
                {/* Decoração */}
                <div className="absolute -top-3 -right-3 w-8 h-8 bg-yellow-400 rounded-full opacity-30 blur-sm" />
                <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-amber-400 rounded-full opacity-20 blur-sm" />
            </div>
        ),
    },
    statistics: {
        requiredPlan: "PRO",
        planColor: "from-blue-500 to-indigo-600",
        planBadgeBg: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
        accentBg: "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10",
        accentBorder: "border-blue-200 dark:border-blue-800",
        icon: "fa-chart-bar",
        iconBg: "bg-white dark:bg-slate-800 shadow-md",
        iconColor: "text-indigo-600",
        title: "Estatísticas Avançadas",
        subtitle: "Conheça seus hábitos de leitura.",
        description:
            "Visualize sua evolução como leitor com gráficos interativos e detalhados. Descubra seus autores favoritos, os meses mais produtivos e acompanhe cada livro lido ao longo do tempo.",
        benefits: [
            { icon: "fa-chart-area", text: "Evolução de páginas lidas por mês" },
            { icon: "fa-user-pen", text: "Ranking dos seus autores favoritos" },
            { icon: "fa-tags", text: "Distribuição por gêneros e categorias" },
            { icon: "fa-calendar-check", text: "Comparativo entre períodos de leitura" },
            { icon: "fa-share-nodes", text: "Card de perfil para compartilhar" },
        ],
        preview: (
            <div className="relative w-full max-w-xs mx-auto select-none space-y-2">
                {/* Mini gráfico de barras simulado */}
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 shadow-lg p-4">
                    <p className="text-[10px] font-semibold text-[--color-muted] mb-3 uppercase tracking-widest">Livros lidos por mês</p>
                    <div className="flex items-end gap-1.5 h-16">
                        {[3, 5, 2, 7, 4, 8, 6, 9, 5, 7, 4, 10].map((v, i) => (
                            <div
                                key={i}
                                className="flex-1 rounded-t"
                                style={{
                                    height: `${(v / 10) * 100}%`,
                                    background: i === 11 ? "rgb(99,102,241)" : "rgba(99,102,241,0.25)",
                                }}
                            />
                        ))}
                    </div>
                    <div className="flex justify-between text-[9px] text-[--color-muted] mt-1">
                        <span>Jan</span>
                        <span>Jun</span>
                        <span>Dez</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { label: "Livros lidos", value: "38", icon: "fa-book", color: "text-green-500" },
                        { label: "Páginas", value: "9.420", icon: "fa-file-lines", color: "text-blue-500" },
                        { label: "Melhor autor", value: "Tolkien", icon: "fa-user-pen", color: "text-amber-500" },
                        { label: "Gênero top", value: "Fantasia", icon: "fa-dragon", color: "text-violet-500" },
                    ].map((s) => (
                        <div
                            key={s.label}
                            className="rounded-lg border border-[--color-border] bg-white dark:bg-slate-800 p-2.5 flex items-center gap-2"
                        >
                            <i className={`fa-solid ${s.icon} ${s.color} text-sm`} />
                            <div>
                                <p className="text-[10px] text-[--color-muted] leading-none">{s.label}</p>
                                <p className="text-xs font-bold text-[--color-text] leading-tight">{s.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="absolute -top-3 -right-3 w-8 h-8 bg-blue-400 rounded-full opacity-30 blur-sm" />
            </div>
        ),
    },
    export: {
        requiredPlan: "PREMIUM",
        planColor: "from-emerald-500 to-teal-500",
        planBadgeBg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
        accentBg: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10",
        accentBorder: "border-emerald-200 dark:border-emerald-800",
        icon: "fa-file-export",
        iconBg: "bg-white dark:bg-slate-800 shadow-md",
        iconColor: "text-emerald-600",
        title: "Exportar Biblioteca",
        subtitle: "Sua biblioteca, onde e como quiser.",
        description:
            "Exporte toda a sua coleção de livros em segundos para CSV, Excel ou PDF. Tenha sempre um backup completo e compartilhe sua lista com quem quiser.",
        benefits: [
            { icon: "fa-file-csv", text: "Exportar para CSV (compatível com planilhas)" },
            { icon: "fa-file-excel", text: "Planilha Excel formatada e pronta" },
            { icon: "fa-file-pdf", text: "PDF elegante para impressão ou envio" },
            { icon: "fa-database", text: "Todos os campos incluídos no arquivo" },
            { icon: "fa-shield-halved", text: "Backup completo da sua biblioteca" },
        ],
        preview: (
            <div className="relative w-full max-w-xs mx-auto select-none space-y-2.5">
                {[
                    {
                        icon: "fa-file-csv",
                        label: "biblioteca.csv",
                        color: "text-green-600",
                        bg: "bg-green-50 dark:bg-green-900/30",
                        border: "border-green-200 dark:border-green-800",
                        size: "12 KB",
                    },
                    {
                        icon: "fa-file-excel",
                        label: "biblioteca.xlsx",
                        color: "text-emerald-600",
                        bg: "bg-emerald-50 dark:bg-emerald-900/30",
                        border: "border-emerald-200 dark:border-emerald-800",
                        size: "38 KB",
                    },
                    {
                        icon: "fa-file-pdf",
                        label: "biblioteca.pdf",
                        color: "text-red-500",
                        bg: "bg-red-50 dark:bg-red-900/30",
                        border: "border-red-200 dark:border-red-800",
                        size: "94 KB",
                    },
                ].map((f) => (
                    <div key={f.label} className={`flex items-center gap-3 rounded-xl border ${f.border} ${f.bg} px-4 py-3 shadow-sm`}>
                        <i className={`fa-solid ${f.icon} text-2xl ${f.color}`} />
                        <div className="flex-1">
                            <p className="text-xs font-semibold text-[--color-text]">{f.label}</p>
                            <p className="text-[10px] text-[--color-muted]">Pronto para download</p>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] text-[--color-muted]">{f.size}</span>
                            <div className="mt-0.5">
                                <i className="fa-solid fa-circle-check text-green-500 text-sm" />
                            </div>
                        </div>
                    </div>
                ))}
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-400 rounded-full opacity-20 blur-sm" />
            </div>
        ),
    },
    gamification: {
        requiredPlan: "PREMIUM",
        planColor: "from-purple-500 to-indigo-600",
        planBadgeBg: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
        accentBg: "bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/10",
        accentBorder: "border-purple-200 dark:border-purple-800",
        icon: "fa-trophy",
        iconBg: "bg-white dark:bg-slate-800 shadow-md",
        iconColor: "text-purple-600",
        title: "Gamificação Completa",
        subtitle: "Leia mais, conquiste mais, suba no ranking.",
        description:
            "Desbloqueie todas as conquistas, veja o histórico do seu streak de leituras e dispute posições no ranking global entre os leitores da plataforma.",
        benefits: [
            { icon: "fa-medal", text: "Todas as conquistas sem limite de visualização" },
            { icon: "fa-ranking-star", text: "Acesso ao ranking geral de leitores" },
            { icon: "fa-fire", text: "Histórico completo de streak de leitura" },
            { icon: "fa-trophy", text: "Conquistas épicas e lendárias" },
            { icon: "fa-crown", text: "Destaque no pódio dos melhores leitores" },
        ],
        preview: (
            <div className="relative w-full max-w-xs mx-auto select-none space-y-2">
                {/* Mini pódio */}
                <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 shadow-lg p-4">
                    <p className="text-[10px] font-semibold text-[--color-muted] mb-3 uppercase tracking-widest text-center">🏆 Ranking</p>
                    <div className="flex items-end justify-center gap-3 mb-3">
                        {[
                            { medal: "🥈", name: "Ana L.", pts: "1.980", h: "h-14", bg: "bg-slate-300 dark:bg-slate-600" },
                            { medal: "🥇", name: "Carlos M.", pts: "2.450", h: "h-20", bg: "bg-yellow-400 dark:bg-yellow-500" },
                            { medal: "🥉", name: "João S.", pts: "1.730", h: "h-10", bg: "bg-amber-600 dark:bg-amber-700" },
                        ].map((u, i) => (
                            <div key={i} className="flex flex-col items-center gap-1 flex-1">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                                    {u.name[0]}
                                </div>
                                <p className="text-[9px] font-semibold text-[--color-text] truncate max-w-[50px] text-center">{u.name}</p>
                                <p className="text-[9px] font-bold text-primary-600">{u.pts}</p>
                                <div className={`w-full ${u.h} ${u.bg} rounded-t-md flex items-center justify-center text-base`}>{u.medal}</div>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Conquistas preview */}
                <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 shadow p-3">
                    <p className="text-[10px] font-semibold text-[--color-muted] mb-2 uppercase tracking-widest">Conquistas</p>
                    <div className="flex gap-2 flex-wrap">
                        {[
                            { icon: "🏆", label: "Lendário", color: "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700" },
                            { icon: "💎", label: "Épico", color: "bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700" },
                            { icon: "⭐", label: "Raro", color: "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700" },
                            { icon: "🔥", label: "Streak", color: "bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700" },
                        ].map((c) => (
                            <div key={c.label} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${c.color}`}>
                                <span className="text-base">{c.icon}</span>
                                <span className="text-[9px] font-medium text-[--color-text]">{c.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="absolute -top-3 -right-3 w-8 h-8 bg-purple-400 rounded-full opacity-30 blur-sm" />
                <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-indigo-400 rounded-full opacity-20 blur-sm" />
            </div>
        ),
    },
};

// ─── Componente de spotlight ──────────────────────────────────
function FeatureSpotlight({ featureKey }) {
    const feature = FEATURE_SPOTLIGHTS[featureKey];
    if (!feature) return null;

    return (
        <div className={`rounded-2xl border ${feature.accentBorder} ${feature.accentBg} overflow-hidden`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                {/* Lado esquerdo: texto */}
                <div className="p-6 md:p-8 space-y-5 flex flex-col justify-center">
                    {/* Badge do plano */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${feature.planBadgeBg}`}>
                            <i className="fa-solid fa-lock mr-1 text-[10px]" />
                            Plano {feature.requiredPlan}
                        </span>
                        <span className="text-xs text-[--color-muted]">necessário para este recurso</span>
                    </div>

                    {/* Ícone + Título */}
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl ${feature.iconBg} flex-shrink-0`}>
                            <i className={`${feature.icon} text-xl ${feature.iconColor}`} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[--color-text] leading-tight">{feature.title}</h2>
                            <p className={`text-sm font-medium bg-gradient-to-r ${feature.planColor} bg-clip-text text-transparent`}>
                                {feature.subtitle}
                            </p>
                        </div>
                    </div>

                    {/* Descrição */}
                    <p className="text-sm text-[--color-muted] leading-relaxed">{feature.description}</p>

                    {/* Lista de benefícios */}
                    <ul className="space-y-2">
                        {feature.benefits.map((b, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm text-[--color-text]">
                                <span
                                    className={`w-6 h-6 rounded-full bg-gradient-to-br ${feature.planColor} flex items-center justify-center flex-shrink-0`}
                                >
                                    <i className={`fa-solid ${b.icon} text-white text-[10px]`} />
                                </span>
                                {b.text}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Lado direito: preview visual */}
                <div className="hidden md:flex items-center justify-center p-6 md:p-8 relative">{feature.preview}</div>
            </div>
        </div>
    );
}

export default function UpgradePage() {
    const navigate = useNavigate();
    const { user, updateToken } = useAuth();
    const { addToast } = useToast();
    const [searchParams] = useSearchParams();

    const [loadingPlan, setLoadingPlan] = useState(null);

    const currentPlan = user?.plan || "free";
    const featureKey = searchParams.get("feature") || null;
    const spotlight = featureKey ? FEATURE_SPOTLIGHTS[featureKey] : null;

    async function handleSelectPlan(plan) {
        if (plan === "free") return;
        setLoadingPlan(plan);

        try {
            const { data } = await billingService.upgrade(plan);

            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
                return;
            }

            if (data.newToken) {
                await updateToken(data.newToken);
            }

            addToast(data.message || "Plano atualizado com sucesso!", "success");
            navigate("/billing");
        } catch (err) {
            const msg = err.response?.data?.error || "Erro ao processar upgrade. Tente novamente.";
            addToast(msg, "error");
        } finally {
            setLoadingPlan(null);
        }
    }

    return (
        <div className="space-y-8 max-w-4xl">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2 mb-1">
                    <Link to="/billing" className="text-[--color-muted] text-sm hover:text-[--color-text] transition-colors">
                        ← Voltar ao Billing
                    </Link>
                </div>
                <h1 className="text-3xl font-bold text-[--color-text]">Escolha seu Plano</h1>
                <p className="text-[--color-muted]">Desbloqueie recursos avançados e leve sua biblioteca ao próximo nível.</p>
            </div>

            {/* Feature Spotlight — aparece apenas quando há ?feature= na URL */}
            {spotlight && <FeatureSpotlight featureKey={featureKey} />}

            {/* Divisor se houver spotlight */}
            {spotlight && (
                <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-[--color-border]" />
                    <span className="text-xs text-[--color-muted] uppercase tracking-widest font-semibold">Escolha seu plano</span>
                    <div className="flex-1 h-px bg-[--color-border]" />
                </div>
            )}

            {/* Cards de plano */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PLANS_ORDER.map((planKey) => (
                    <PlanCard
                        key={planKey}
                        plan={PLAN_FEATURES[planKey]}
                        currentPlan={currentPlan}
                        onSelect={handleSelectPlan}
                        loading={loadingPlan === planKey}
                    />
                ))}
            </div>

            {/* Nota downgrade Free */}
            {currentPlan !== "free" && (
                <p className="text-center text-sm text-[--color-muted]">
                    Para voltar ao plano Free, cancele sua assinatura na{" "}
                    <Link to="/billing" className="underline text-primary-600 dark:text-primary-400">
                        página de cobrança
                    </Link>
                    .
                </p>
            )}

            {/* Garantias */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                {[
                    { icon: "fa-shield-halved", text: "Pagamento seguro via Stripe" },
                    { icon: "fa-rotate-left", text: "Cancele quando quiser" },
                    { icon: "fa-clock", text: "Trial gratuito em planos pagos" },
                ].map((g) => (
                    <div key={g.text} className="flex items-center gap-2 justify-center text-sm text-[--color-muted]">
                        <i className={`fa-solid ${g.icon} text-green-500`} />
                        {g.text}
                    </div>
                ))}
            </div>
        </div>
    );
}
