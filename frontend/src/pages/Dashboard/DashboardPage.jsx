import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import api from "../../api/axios";
import StarRating from "../../components/UI/StarRating";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";

function coverSrc(path) {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return API_BASE + path;
}

const STATUS_COLORS = {
    want_to_read: "#64748b",
    reading: "#3b82f6",
    read: "#22c55e",
    paused: "#f97316",
};

function StatCard({ icon, label, value, color = "primary" }) {
    const colors = {
        primary: "text-primary-600 bg-primary-50 dark:bg-primary-900/30",
        green: "text-green-600 bg-green-50 dark:bg-green-900/30",
        blue: "text-blue-600 bg-blue-50 dark:bg-blue-900/30",
        orange: "text-orange-600 bg-orange-50 dark:bg-orange-900/30",
        red: "text-red-600 bg-red-50 dark:bg-red-900/30",
        slate: "text-slate-600 bg-slate-50 dark:bg-slate-900/30",
    };
    return (
        <div className="card p-4 flex items-center gap-4">
            <div className={"w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 " + colors[color]}>
                <i className={"text-xl " + icon} />
            </div>
            <div>
                <p className="text-2xl font-bold text-[--color-text]">{value}</p>
                <p className="text-xs text-[--color-muted]">{label}</p>
            </div>
        </div>
    );
}

function ProgressBar({ value = 0 }) {
    const pct = Math.min(100, Math.round((value.currentPage / value.pages) * 100)) || 0;
    return (
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
            <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: pct + "%" }} />
        </div>
    );
}

export default function DashboardPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const location = useLocation();

    useEffect(() => {
        setLoading(true);
        setData(null);
        api.get("/dashboard")
            .then((r) => setData(r.data))
            .finally(() => setLoading(false));
    }, [location.key]);

    if (loading)
        return (
            <div className="flex justify-center py-16">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );

    if (!data)
        return (
            <div className="card p-8 text-center">
                <p className="text-[--color-muted]">Erro ao carregar dashboard.</p>
            </div>
        );

    const { stats, currentlyReading, recentBooks, featuredBooks, topRated, categoryStats, userProgress, recentAchievements } = data;

    const pieData = categoryStats
        .filter((c) => c.bookCount > 0)
        .map((c) => ({
            name: c.name,
            value: c.bookCount,
            fill: c.color || "#64748b",
        }));

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-[--color-text]">
                <i className="fa-solid fa-house text-primary-600 mr-2" />
                Dashboard
            </h1>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon="fa-solid fa-book" label="Total de livros" value={stats.totalBooks} color="primary" />
                <StatCard icon="fa-solid fa-check-circle" label="Lidos" value={stats.booksRead} color="green" />
                <StatCard icon="fa-solid fa-book-open" label="Lendo" value={stats.booksReading} color="blue" />
                <StatCard icon="fa-solid fa-clock" label="Quero ler" value={stats.booksWantToRead} color="slate" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard icon="fa-solid fa-pause-circle" label="Pausados" value={stats.booksPaused} color="orange" />
                <StatCard icon="fa-solid fa-handshake" label="Empréstimos ativos" value={stats.activeLoans} color="red" />
                <StatCard icon="fa-solid fa-history" label="Total de empréstimos" value={stats.totalLoans} color="slate" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Gamificação */}
                <div className="space-y-3">
                    {userProgress && (
                        <div className="card p-4 space-y-2">
                            <h2 className="font-semibold text-[--color-text] flex items-center gap-2 text-sm">
                                <i className="fa-solid fa-trophy text-yellow-500" /> Meu Progresso
                            </h2>
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center font-bold text-yellow-600 text-lg">
                                    {Math.floor(userProgress.level)}
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-[--color-muted]">Nível {Math.floor(userProgress.level)}</p>
                                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-1">
                                        <div
                                            className="bg-yellow-400 h-1.5 rounded-full"
                                            style={{ width: (userProgress.total_points % 100) + "%" }}
                                        />
                                    </div>
                                    <p className="text-xs text-[--color-muted] mt-0.5">{userProgress.total_points} pontos</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center text-xs">
                                <div className="bg-slate-50 dark:bg-slate-800 rounded p-2">
                                    <p className="text-lg font-bold text-[--color-text]">{userProgress.current_streak}</p>
                                    <p className="text-[--color-muted]">Dias seguidos</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800 rounded p-2">
                                    <p className="text-lg font-bold text-[--color-text]">{userProgress.books_read}</p>
                                    <p className="text-[--color-muted]">Livros lidos</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {recentAchievements.length > 0 && (
                        <div className="card p-4">
                            <h2 className="font-semibold text-[--color-text] text-sm mb-2">
                                <i className="fa-solid fa-medal text-primary-500 mr-1" /> Conquistas recentes
                            </h2>
                            {recentAchievements.map((a, i) => (
                                <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[--color-border] last:border-0">
                                    <span className="text-xl">{a.icon}</span>
                                    <div>
                                        <p className="text-xs font-medium text-[--color-text]">{a.name}</p>
                                        <p className="text-xs text-[--color-muted]">+{a.points} pts</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Lendo Agora */}
                <div className="card p-4 space-y-3">
                    <h2 className="font-semibold text-[--color-text] flex items-center gap-2 text-sm">
                        <i className="fa-solid fa-book-open text-blue-500" /> Lendo agora
                    </h2>
                    {currentlyReading.length === 0 ? (
                        <p className="text-center text-sm text-[--color-muted] py-2">
                            Nenhum livro em leitura.{" "}
                            <Link to="/books" className="text-primary-600 hover:underline">
                                Adicionar livro
                            </Link>
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {currentlyReading.map((b) => {
                                const pct = b.pages ? Math.min(100, Math.round((b.currentPage / b.pages) * 100)) : 0;
                                return (
                                    <Link
                                        key={b.id}
                                        to={"/books/" + b.id}
                                        className="flex gap-3 hover:opacity-80 transition-opacity border-b border-[--color-border] last:border-0 pb-3 last:pb-0"
                                    >
                                        <div className="w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-slate-100 dark:bg-slate-800">
                                            {b.coverImagePath ? (
                                                <img src={coverSrc(b.coverImagePath)} alt={b.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <i className="fa-solid fa-book text-slate-400 text-sm m-auto block mt-4 ml-3" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-[--color-text] text-sm truncate">{b.title}</p>
                                            <p className="text-xs text-[--color-muted] truncate">{b.author}</p>
                                            <div className="mt-2 space-y-1">
                                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                                                    <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: pct + "%" }} />
                                                </div>
                                                <p className="text-xs text-[--color-muted]">
                                                    {b.currentPage || 0} / {b.pages || "?"} pgs ({pct}%)
                                                </p>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Gráfico por categoria */}
                {pieData.length > 0 && (
                    <div className="card p-4">
                        <h2 className="font-semibold text-[--color-text] mb-3 text-sm flex items-center gap-2">
                            <i className="fa-solid fa-chart-pie text-primary-500" />
                            Livros por categoria
                        </h2>
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={70}
                                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                        labelLine={false}
                                    >
                                        {pieData.map((entry, i) => (
                                            <Cell key={i} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>

            {/* Top 5 avaliados */}
            {topRated.length > 0 && (
                <div className="card p-5">
                    <h2 className="font-semibold text-[--color-text] mb-3">
                        <i className="fa-solid fa-star text-yellow-400 mr-2" />
                        Mais bem avaliados
                    </h2>
                    <div className="space-y-2">
                        {topRated.map((b, i) => (
                            <Link
                                key={b.id}
                                to={"/books/" + b.id}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <span className="text-sm font-bold text-[--color-muted] w-4">{i + 1}</span>
                                <div className="w-8 h-10 rounded overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                                    {b.coverImagePath ? (
                                        <img src={coverSrc(b.coverImagePath)} alt={b.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <i className="fa-solid fa-book text-slate-400 text-xs m-auto block mt-2.5 ml-1.5" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[--color-text] truncate">{b.title}</p>
                                    <p className="text-xs text-[--color-muted]">{b.author}</p>
                                </div>
                                <StarRating value={Number(b.rating || 0)} onChange={() => {}} size="sm" />
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Livros Recentes */}
            {recentBooks.length > 0 && (
                <div className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="font-semibold text-[--color-text]">
                            <i className="fa-solid fa-clock-rotate-left text-[--color-muted] mr-2" />
                            Adicionados recentemente
                        </h2>
                        <Link to="/books" className="text-xs text-primary-600 hover:underline">
                            Ver todos
                        </Link>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                        {recentBooks.map((b) => (
                            <Link
                                key={b.id}
                                to={"/books/" + b.id}
                                className="group relative aspect-[2/3] rounded overflow-hidden bg-slate-100 dark:bg-slate-800"
                            >
                                {b.coverImagePath ? (
                                    <img
                                        src={coverSrc(b.coverImagePath)}
                                        alt={b.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <i className="fa-solid fa-book text-slate-400" />
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
