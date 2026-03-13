import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import AchievementCard from "../../components/Gamification/AchievementCard";
import { useAuth } from "../../context/AuthContext";

const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 };
const FILTERS = [
    { key: "all", label: "Todas" },
    { key: "unlocked", label: "Desbloqueadas" },
    { key: "locked", label: "Bloqueadas" },
    { key: "legendary", label: "Lendárias" },
    { key: "epic", label: "Épicas" },
    { key: "rare", label: "Raras" },
    { key: "common", label: "Comuns" },
];

// ─── XP Bar ─────────────────────────────────────────────────
function XPBar({ level, points }) {
    const safeLevel = Math.floor(level || 1);
    const pointsPerLevel = 100;
    const currentLevelPoints = (safeLevel - 1) * pointsPerLevel;
    const nextLevelPoints = safeLevel * pointsPerLevel;
    const xpInLevel = Math.max(0, Math.round(points - currentLevelPoints));
    const progress = Math.min(100, Math.max(0, (xpInLevel / pointsPerLevel) * 100));
    return (
        <div className="w-full">
            <div className="flex justify-between text-xs text-[--color-muted] mb-1">
                <span>Nível {safeLevel}</span>
                <span>
                    {xpInLevel} / {pointsPerLevel} XP
                </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                <div
                    className="h-3 rounded-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all duration-700"
                    style={{ width: progress + "%" }}
                />
            </div>
            <p className="text-xs text-[--color-muted] mt-1 text-right">
                Próximo: Nível {safeLevel + 1} — faltam {Math.max(0, nextLevelPoints - points)} pts
            </p>
        </div>
    );
}

// ─── Stat Card ───────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = "text-primary-600" }) {
    return (
        <div className="card p-4 flex items-center gap-3">
            <div className={`text-2xl ${color} flex-shrink-0`}>
                <i className={`fa-solid ${icon}`} />
            </div>
            <div className="min-w-0">
                <p className="text-xl font-bold text-[--color-text] truncate">{value}</p>
                <p className="text-xs text-[--color-muted]">{label}</p>
                {sub && <p className="text-[11px] text-[--color-muted] opacity-75">{sub}</p>}
            </div>
        </div>
    );
}

// ─── Goal Modal ──────────────────────────────────────────────
function GoalModal({ goal, onSave, onClose }) {
    const [value, setValue] = useState(goal || 12);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="card w-full max-w-sm p-6 space-y-4">
                <h3 className="text-lg font-bold text-[--color-text]">Meta de Leitura Anual</h3>
                <div>
                    <label className="block text-sm font-medium text-[--color-muted] mb-1">Livros por ano</label>
                    <input type="number" min={1} max={365} value={value} onChange={(e) => setValue(+e.target.value)} className="input" />
                </div>
                <div className="flex gap-2 justify-end">
                    <button onClick={onClose} className="btn-secondary text-sm">
                        Cancelar
                    </button>
                    <button onClick={() => onSave(value)} className="btn-primary text-sm">
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────
export default function GamificationPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const canViewLeaderboard = user?.plan === "premium" || user?.plan === "pro" || user?.plan === "master";

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [recalculating, setRecalculating] = useState(false);
    const [recalcMsg, setRecalcMsg] = useState("");

    const load = () => {
        setLoading(true);
        api.get("/gamification")
            .then((r) => setData(r.data))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
        // Marca conquistas como vistas ao abrir a página
        api.post("/gamification/mark-viewed").catch(() => {});
    }, []);

    const handleRecalculate = async () => {
        setRecalculating(true);
        setRecalcMsg("");
        try {
            const res = await api.post("/gamification/recalculate");
            setRecalcMsg(res.data.message || "Progresso recalculado!");
            load();
        } catch (err) {
            setRecalcMsg(err.response?.data?.error || "Erro ao recalcular");
        } finally {
            setRecalculating(false);
        }
    };

    const saveGoal = async (val) => {
        await api.put("/gamification/goal", { yearlyGoal: val });
        setShowGoalModal(false);
        load();
    };

    if (loading)
        return (
            <div className="flex justify-center py-16">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );

    const { userProgress: up, achievements = [], lockedAchievements = [], isLimited = false, recentUnlocked = [], stats = {} } = data || {};

    const yearlyGoal = up?.yearly_goal || 12;
    const yearlyDone = up?.yearly_books_read || stats.yearlyBooksRead || 0;
    const goalPct = Math.min(100, Math.round((yearlyDone / yearlyGoal) * 100));
    const totalPoints = up?.total_points || 0;
    // Garante inteiro — o banco pode conter float (ex: 1.2) por bug histórico no cálculo SQL
    const level = Math.floor(up?.level || 1);

    const filtered = achievements
        .filter((a) => {
            if (filter === "unlocked") return a.unlocked;
            if (filter === "locked") return !a.unlocked;
            if (["legendary", "epic", "rare", "common"].includes(filter)) return a.rarity === filter;
            return true;
        })
        .sort((a, b) => {
            const rd = RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
            return rd !== 0 ? rd : b.unlocked - a.unlocked;
        });

    const unlockedCount = achievements.filter((a) => a.unlocked).length;
    const newCount = achievements.filter((a) => a.unlocked && a.has_been_viewed === 0).length;

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <i className="fa-solid fa-trophy text-primary-600 text-xl" />
                    <h1 className="text-2xl font-bold text-[--color-text]">Gamificação</h1>
                    {newCount > 0 && (
                        <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                            {newCount} nova{newCount > 1 ? "s" : ""}!
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {canViewLeaderboard ? (
                        <Link to="/gamification/leaderboard" className="btn-secondary text-sm">
                            <i className="fa-solid fa-ranking-star mr-1" /> Ranking
                        </Link>
                    ) : (
                        <button
                            onClick={() => navigate("/billing/upgrade?feature=gamification")}
                            className="btn-secondary text-sm flex items-center gap-1.5"
                            title="Disponível nos planos Premium e Pro"
                        >
                            <i className="fa-solid fa-ranking-star" />
                            Ranking
                            <span className="ml-0.5 text-[9px] font-bold bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full">PREMIUM</span>
                        </button>
                    )}
                    {recalcMsg && <span className="text-xs text-green-600 dark:text-green-400">{recalcMsg}</span>}
                    <button
                        onClick={handleRecalculate}
                        disabled={recalculating}
                        className="btn-secondary text-sm"
                        title="Recalcular progresso e pontos do zero"
                    >
                        {recalculating ? (
                            <>
                                <i className="fa-solid fa-spinner animate-spin" /> Recalculando...
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-rotate" /> Recalcular
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Nível + Meta ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Card nível */}
                <div className="lg:col-span-2 card p-6 space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                            <span className="text-white font-bold text-2xl">{level}</span>
                        </div>
                        <div className="flex-1">
                            <p className="text-lg font-bold text-[--color-text]">Nível {level}</p>
                            <p className="text-sm text-[--color-muted]">{totalPoints} pontos totais</p>
                            <p className="text-xs text-[--color-muted]">
                                {unlockedCount} / {achievements.length + lockedAchievements.length} conquistas
                            </p>
                        </div>
                    </div>
                    <XPBar level={level} points={totalPoints} />
                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-[--color-text]">{up?.books_read || 0}</p>
                            <p className="text-xs text-[--color-muted]">Livros Lidos</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-orange-500">{up?.current_streak || 0} 🔥</p>
                            <p className="text-xs text-[--color-muted]">Sequência Atual</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-[--color-text]">{up?.longest_streak || 0}</p>
                            <p className="text-xs text-[--color-muted]">Maior Sequência</p>
                        </div>
                    </div>
                </div>

                {/* Meta anual */}
                <div className="card p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-[--color-text]">Meta Anual</h3>
                        <button onClick={() => setShowGoalModal(true)} className="text-xs text-primary-600 hover:underline">
                            Editar
                        </button>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative w-28 h-28">
                            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="40"
                                    fill="none"
                                    strokeWidth="10"
                                    stroke="currentColor"
                                    className="text-slate-200 dark:text-slate-700"
                                />
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="40"
                                    fill="none"
                                    strokeWidth="10"
                                    stroke="#6366f1"
                                    strokeLinecap="round"
                                    strokeDasharray={`${2 * Math.PI * 40}`}
                                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - goalPct / 100)}`}
                                    className="transition-all duration-700"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-2xl font-bold text-[--color-text]">{goalPct}%</span>
                            </div>
                        </div>
                        <p className="text-sm text-[--color-muted] text-center">
                            <strong className="text-[--color-text]">{yearlyDone}</strong> de{" "}
                            <strong className="text-[--color-text]">{yearlyGoal}</strong> livros em {new Date().getFullYear()}
                        </p>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div className="h-2 rounded-full bg-primary-500 transition-all" style={{ width: goalPct + "%" }} />
                    </div>
                </div>
            </div>

            {/* ── Stats Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon="fa-book-open" label="Livros Lidos" value={stats.booksRead ?? up?.books_read ?? 0} color="text-primary-600" />
                <StatCard
                    icon="fa-file-lines"
                    label="Páginas Lidas"
                    value={(stats.totalPagesRead ?? up?.total_pages_read ?? 0).toLocaleString("pt-BR")}
                    color="text-blue-600"
                />
                <StatCard icon="fa-pen-nib" label="Avaliações" value={stats.reviewsCount ?? up?.reviews_count ?? 0} color="text-violet-600" />
                <StatCard
                    icon="fa-star"
                    label="Média de Avaliação"
                    value={stats.averageRating ? `${stats.averageRating} ⭐` : "—"}
                    sub="(livros avaliados)"
                    color="text-yellow-500"
                />
            </div>

            {/* ── Conquistas Recentes ── */}
            {recentUnlocked.length > 0 && (
                <div className="card p-5 space-y-3">
                    <h3 className="font-semibold text-[--color-text] flex items-center gap-2">
                        <i className="fa-solid fa-star text-yellow-500" />
                        Conquistas Recentes
                    </h3>
                    <div className="flex gap-3 overflow-x-auto pb-1">
                        {recentUnlocked.map((a) => (
                            <div key={a.id} className="flex-shrink-0 w-32">
                                <AchievementCard achievement={a} compact />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Grade de Conquistas ── */}
            <div className="card p-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h2 className="text-lg font-semibold text-[--color-text]">
                        Conquistas
                        <span className="ml-2 text-sm font-normal text-[--color-muted]">
                            {unlockedCount}/{achievements.length + lockedAchievements.length}
                        </span>
                    </h2>
                </div>

                {/* Banner plano limitado */}
                {isLimited && lockedAchievements.length > 0 && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                        <i className="fa-solid fa-lock text-amber-500 text-lg flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                +{lockedAchievements.length} conquistas bloqueadas pelo plano
                            </p>
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                Seu plano exibe apenas as primeiras conquistas. Faça upgrade para ver todas.
                            </p>
                        </div>
                        <a href="/billing/upgrade?feature=gamification" className="btn-primary text-xs flex-shrink-0">
                            Upgrade
                        </a>
                    </div>
                )}

                {/* Filtros */}
                <div className="flex flex-wrap gap-2">
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                filter === f.key
                                    ? "bg-primary-600 text-white"
                                    : "bg-slate-100 dark:bg-slate-700 text-[--color-muted] hover:bg-slate-200 dark:hover:bg-slate-600"
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {filtered.length === 0 ? (
                    <p className="text-center py-8 text-[--color-muted]">Nenhuma conquista nesta categoria.</p>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {filtered.map((a) => (
                            <AchievementCard key={a.id} achievement={a} />
                        ))}
                    </div>
                )}

                {/* Preview conquistas premium */}
                {isLimited && lockedAchievements.length > 0 && (
                    <div className="mt-4 p-5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white space-y-3">
                        <div className="flex items-center gap-2">
                            <i className="fa-solid fa-crown text-yellow-300" />
                            <span className="font-semibold">Conquistas Premium</span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {lockedAchievements.slice(0, 6).map((a) => (
                                <div
                                    key={a.id}
                                    className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/10 backdrop-blur-sm filter blur-[1px]"
                                >
                                    <span className="text-2xl">{a.icon}</span>
                                    <span className="text-[10px] text-center leading-tight opacity-80">{a.name}</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-sm opacity-90">
                            Desbloqueie mais {lockedAchievements.length} conquistas e acesse todo o sistema de gamificação fazendo upgrade.
                        </p>
                        <a
                            href="/billing/upgrade?feature=gamification"
                            className="inline-block bg-yellow-400 text-gray-900 text-sm font-bold px-4 py-2 rounded-lg hover:bg-yellow-300 transition-colors"
                        >
                            Fazer Upgrade
                        </a>
                    </div>
                )}
            </div>

            {showGoalModal && <GoalModal goal={yearlyGoal} onSave={saveGoal} onClose={() => setShowGoalModal(false)} />}
        </div>
    );
}
