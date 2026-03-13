import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

const LEVEL_LABELS = [
    { min: 1, max: 2, label: "Iniciante", color: "text-slate-500" },
    { min: 3, max: 5, label: "Leitor", color: "text-blue-500" },
    { min: 6, max: 10, label: "Ávido", color: "text-green-500" },
    { min: 11, max: 15, label: "Experiente", color: "text-yellow-500" },
    { min: 16, max: 20, label: "Veterano", color: "text-orange-500" },
    { min: 21, max: 99, label: "Mestre", color: "text-purple-500" },
    { min: 100, max: Infinity, label: "Lendário", color: "text-rose-500" },
];

function getLevelInfo(level) {
    return LEVEL_LABELS.find((l) => level >= l.min && level <= l.max) || LEVEL_LABELS[0];
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
    const { user: currentUser } = useAuth();
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const canViewLeaderboard = currentUser?.plan === "premium" || currentUser?.plan === "pro" || currentUser?.plan === "master";

    useEffect(() => {
        if (!canViewLeaderboard) {
            setLoading(false);
            return;
        }
        api.get("/gamification/leaderboard?limit=20")
            .then((r) => setLeaderboard(r.data.leaderboard || []))
            .catch(() => setError("Não foi possível carregar o ranking."))
            .finally(() => setLoading(false));
    }, [canViewLeaderboard]);

    // ── Lock screen para usuários Free ──
    if (!canViewLeaderboard) {
        return (
            <div className="space-y-4 max-w-2xl mx-auto">
                <div className="flex items-center gap-3">
                    <Link to="/gamification" className="text-[--color-muted] hover:text-[--color-text] transition-colors">
                        <i className="fa-solid fa-arrow-left" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <i className="fa-solid fa-ranking-star text-primary-600 text-xl" />
                        <h1 className="text-2xl font-bold text-[--color-text]">Ranking</h1>
                    </div>
                </div>

                <div className="card overflow-hidden">
                    {/* Preview desfocado */}
                    <div className="relative">
                        <div className="p-6 space-y-3 select-none pointer-events-none filter blur-sm opacity-50">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                                <p className="text-xs font-semibold text-[--color-muted] uppercase tracking-wide">Pódio</p>
                            </div>
                            {[
                                { pts: "2.450", lv: 12, name: "Ana Lima" },
                                { pts: "1.980", lv: 9, name: "Carlos M." },
                                { pts: "1.730", lv: 8, name: "João S." },
                            ].map((u, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                                    <span className="text-xl">{["🥇", "🥈", "🥉"][i]}</span>
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                        {u.name[0]}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-[--color-text]">{u.name}</p>
                                        <p className="text-xs text-[--color-muted]">Nível {u.lv}</p>
                                    </div>
                                    <span className="text-sm font-bold text-[--color-text]">{u.pts} pts</span>
                                </div>
                            ))}
                        </div>

                        {/* Overlay de bloqueio */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-6 text-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-xl">
                                <i className="fa-solid fa-crown text-white text-2xl" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-lg font-bold text-[--color-text]">Ranking é exclusivo</p>
                                <span className="inline-block text-xs font-bold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200 px-2.5 py-0.5 rounded-full">
                                    PREMIUM
                                </span>
                            </div>
                            <p className="text-sm text-[--color-muted] max-w-xs">
                                Veja sua posição no ranking geral, dispute com outros leitores e mostre seu progresso.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Link to="/billing/upgrade?feature=gamification" className="btn-primary text-sm px-5 py-2 flex items-center gap-2">
                                    <i className="fa-solid fa-crown" /> Fazer Upgrade
                                </Link>
                                <Link to="/gamification" className="btn-secondary text-sm px-5 py-2">
                                    Voltar
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (loading)
        return (
            <div className="flex justify-center py-16">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );

    if (error)
        return (
            <div className="card p-8 text-center text-[--color-muted]">
                <i className="fa-solid fa-triangle-exclamation text-3xl text-yellow-500 mb-3" />
                <p>{error}</p>
            </div>
        );

    const myPosition = leaderboard.findIndex((u) => u.user_id === currentUser?.id);

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Link to="/gamification" className="text-[--color-muted] hover:text-[--color-text] transition-colors">
                    <i className="fa-solid fa-arrow-left" />
                </Link>
                <div className="flex items-center gap-2">
                    <i className="fa-solid fa-ranking-star text-primary-600 text-xl" />
                    <h1 className="text-2xl font-bold text-[--color-text]">Ranking</h1>
                </div>
            </div>

            {/* Pódio (top 3) */}
            {leaderboard.length >= 3 && (
                <div className="card p-6">
                    <h2 className="text-sm font-semibold text-[--color-muted] uppercase tracking-wide mb-4 text-center">Pódio</h2>
                    <div className="flex items-end justify-center gap-4">
                        {/* 2º lugar */}
                        <PodiumCard user={leaderboard[1]} position={2} />
                        {/* 1º lugar */}
                        <PodiumCard user={leaderboard[0]} position={1} large />
                        {/* 3º lugar */}
                        <PodiumCard user={leaderboard[2]} position={3} />
                    </div>
                </div>
            )}

            {/* Minha posição (fora do top visível) */}
            {myPosition > 2 && (
                <div className="card p-4 border-2 border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20">
                    <p className="text-xs text-[--color-muted] mb-1">Sua posição</p>
                    <LeaderboardRow user={leaderboard[myPosition]} position={myPosition + 1} highlight />
                </div>
            )}

            {/* Lista completa */}
            <div className="card divide-y divide-slate-100 dark:divide-slate-700">
                <div className="p-4 pb-3">
                    <h2 className="text-sm font-semibold text-[--color-muted] uppercase tracking-wide">Classificação</h2>
                </div>
                {leaderboard.length === 0 ? (
                    <div className="p-8 text-center text-[--color-muted]">
                        <i className="fa-solid fa-users text-3xl mb-3" />
                        <p>Nenhum participante ainda. Seja o primeiro!</p>
                    </div>
                ) : (
                    leaderboard.map((user, i) => (
                        <LeaderboardRow key={user.user_id} user={user} position={i + 1} highlight={user.user_id === currentUser?.id} />
                    ))
                )}
            </div>
        </div>
    );
}

// ─── Pódio Card ──────────────────────────────────────────────
function PodiumCard({ user, position, large = false }) {
    const levelInfo = getLevelInfo(user.level);
    const medal = MEDALS[position - 1];
    const heights = { 1: "h-28", 2: "h-20", 3: "h-16" };

    return (
        <div className="flex flex-col items-center gap-2 flex-1">
            {/* Avatar */}
            <div
                className={`flex items-center justify-center rounded-full font-bold text-white shadow-lg
                    ${large ? "w-16 h-16 text-xl" : "w-12 h-12 text-base"}
                    bg-gradient-to-br from-primary-500 to-purple-600`}
            >
                {(user.full_name || user.user_name || "?")[0].toUpperCase()}
            </div>

            {/* Nome e pontos */}
            <div className="text-center">
                <p className={`font-semibold text-[--color-text] truncate max-w-[80px] ${large ? "text-sm" : "text-xs"}`}>
                    {user.full_name || user.user_name || "—"}
                </p>
                <p className={`${levelInfo.color} font-bold ${large ? "text-base" : "text-sm"}`}>{user.total_points.toLocaleString("pt-BR")} pts</p>
                <p className="text-[10px] text-[--color-muted]">Nv. {user.level}</p>
            </div>

            {/* Barra do pódio + medalha */}
            <div
                className={`w-full ${heights[position]} rounded-t-lg flex items-center justify-center text-2xl
                ${position === 1 ? "bg-yellow-400 dark:bg-yellow-500" : position === 2 ? "bg-slate-300 dark:bg-slate-600" : "bg-amber-600 dark:bg-amber-700"}`}
            >
                {medal}
            </div>
        </div>
    );
}

// ─── Leaderboard Row ─────────────────────────────────────────
function LeaderboardRow({ user, position, highlight = false }) {
    const levelInfo = getLevelInfo(user.level);
    const medal = position <= 3 ? MEDALS[position - 1] : null;

    return (
        <div
            className={`flex items-center gap-3 p-4 transition-colors
                ${highlight ? "bg-primary-50 dark:bg-primary-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
        >
            {/* Posição */}
            <div className="w-8 text-center flex-shrink-0">
                {medal ? <span className="text-xl">{medal}</span> : <span className="text-sm font-bold text-[--color-muted]">{position}</span>}
            </div>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {(user.full_name || user.user_name || "?")[0].toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className={`font-semibold text-[--color-text] truncate text-sm ${highlight ? "text-primary-700 dark:text-primary-300" : ""}`}>
                        {user.full_name || user.user_name || "Leitor"}
                    </p>
                    {highlight && (
                        <span className="text-[10px] bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded-full font-medium">
                            Você
                        </span>
                    )}
                </div>
                <p className={`text-xs ${levelInfo.color}`}>
                    Nível {user.level} · {levelInfo.label}
                </p>
            </div>

            {/* Estatísticas */}
            <div className="flex items-center gap-4 flex-shrink-0 text-right">
                <div className="hidden sm:block text-center">
                    <p className="text-xs font-semibold text-[--color-text]">{user.books_read}</p>
                    <p className="text-[10px] text-[--color-muted]">livros</p>
                </div>
                <div className="hidden sm:block text-center">
                    <p className="text-xs font-semibold text-orange-500">{user.current_streak} 🔥</p>
                    <p className="text-[10px] text-[--color-muted]">sequência</p>
                </div>
                <div className="text-center">
                    <p className="text-sm font-bold text-[--color-text]">{user.total_points.toLocaleString("pt-BR")}</p>
                    <p className="text-[10px] text-[--color-muted]">pts</p>
                </div>
            </div>
        </div>
    );
}
