import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from "recharts";
import api from "../../api/axios";

const MONTH_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16"];

// ─────────────────────────────────────────────────────────────
// Banner de upgrade de plano
// ─────────────────────────────────────────────────────────────
function UpgradeBanner() {
    return (
        <div className="card p-8 text-center space-y-4 border-2 border-dashed border-primary-300 dark:border-primary-700">
            <div className="text-5xl">📊</div>
            <h2 className="text-xl font-bold text-[--color-text]">Estatísticas Avançadas</h2>
            <p className="text-[--color-muted] max-w-md mx-auto">
                Desbloqueie análises detalhadas de leitura com o plano <strong>Pro</strong>. Monitore sua evolução mensal, autores favoritos e muito
                mais.
            </p>
            <Link to="/billing/upgrade?feature=statistics" className="btn-primary inline-flex items-center gap-2">
                <i className="fa-solid fa-crown" /> Assinar Pro
            </Link>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// 1. Cards de resumo
// ─────────────────────────────────────────────────────────────
function SummaryCards({ stats }) {
    if (!stats) return null;
    const items = [
        {
            icon: "fa-books",
            label: "Total de Livros",
            value: stats.totalBooks,
            color: "text-primary-600",
            bg: "bg-primary-50 dark:bg-primary-900/20",
        },
        { icon: "fa-check-circle", label: "Livros Lidos", value: stats.booksRead, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
        { icon: "fa-book-open", label: "Lendo Agora", value: stats.booksReading, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
        { icon: "fa-bookmark", label: "Quer Ler", value: stats.booksWantToRead, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/20" },
        {
            icon: "fa-file-lines",
            label: "Páginas Lidas",
            value: stats.totalPagesRead?.toLocaleString("pt-BR"),
            color: "text-orange-600",
            bg: "bg-orange-50 dark:bg-orange-900/20",
        },
        {
            icon: "fa-fire",
            label: "Sequência Atual",
            value: `${stats.currentStreak} dias`,
            color: "text-red-600",
            bg: "bg-red-50 dark:bg-red-900/20",
        },
        {
            icon: "fa-trophy",
            label: "Recorde",
            value: `${stats.longestStreak} dias`,
            color: "text-yellow-600",
            bg: "bg-yellow-50 dark:bg-yellow-900/20",
        },
        {
            icon: "fa-star",
            label: "Avaliação Média",
            value: stats.averageRating ? `${stats.averageRating}★` : "—",
            color: "text-amber-500",
            bg: "bg-amber-50 dark:bg-amber-900/20",
        },
    ];
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {items.map((it) => (
                <div key={it.label} className={`card p-4 text-center rounded-xl ${it.bg}`}>
                    <i className={`fa-solid ${it.icon} text-lg ${it.color} mb-1`} />
                    <p className="text-lg font-bold text-[--color-text]">{it.value}</p>
                    <p className="text-[10px] text-[--color-muted] leading-tight mt-0.5">{it.label}</p>
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// 2. Card de Velocidade de Leitura
// ─────────────────────────────────────────────────────────────
function ReadingVelocityCard({ velocity, stats }) {
    if (!velocity) return null;
    const goalPct = Math.min(stats?.yearlyGoalPercent || 0, 100);
    return (
        <div className="card p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
                <h2 className="text-base font-semibold text-[--color-text] mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-bolt text-violet-500" /> Velocidade de Leitura
                </h2>
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-[--color-muted]">Páginas/dia (30d)</span>
                        <span className="font-bold text-violet-600">{velocity.averagePagesPerDay}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-[--color-muted]">Páginas (30 dias)</span>
                        <span className="font-semibold text-[--color-text]">{velocity.pagesLast30Days}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-[--color-muted]">Páginas (90 dias)</span>
                        <span className="font-semibold text-[--color-text]">{velocity.pagesLast90Days}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-[--color-muted]">Livros (30 dias)</span>
                        <span className="font-semibold text-[--color-text]">{velocity.booksLast30Days}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-[--color-muted]">Dias ativos (30d)</span>
                        <span className="font-semibold text-[--color-text]">{velocity.activeDaysLast30}</span>
                    </div>
                </div>
            </div>
            <div className="flex flex-col justify-center items-center gap-1">
                <p className="text-xs text-[--color-muted]">Páginas semanais</p>
                <p className="text-3xl font-bold text-orange-500">{stats?.weeklyPages || 0}</p>
                <p className="text-xs text-[--color-muted]">últimos 7 dias</p>
            </div>
            <div className="flex flex-col justify-center items-center gap-1">
                <p className="text-xs text-[--color-muted]">Nível</p>
                <p className="text-3xl font-bold text-primary-600">{Math.floor(stats?.level || 1)}</p>
                <p className="text-xs text-[--color-muted]">{stats?.totalPoints || 0} pts</p>
            </div>
            <div className="flex flex-col justify-center gap-2">
                <p className="text-xs text-[--color-muted] text-center">Meta Anual</p>
                <div className="w-full bg-[--color-border] rounded-full h-3">
                    <div className="bg-green-500 h-3 rounded-full transition-all duration-700" style={{ width: `${goalPct}%` }} />
                </div>
                <p className="text-xs text-center font-semibold text-green-600">{goalPct}%</p>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// 3. Gráfico de Tendência (Área) — 12 meses
// ─────────────────────────────────────────────────────────────
function ReadingTrendChart({ trendData }) {
    if (!trendData?.length) return null;
    return (
        <div className="card p-6">
            <h2 className="text-base font-semibold text-[--color-text] mb-4 flex items-center gap-2">
                <i className="fa-solid fa-chart-line text-primary-500" /> Tendência de Leitura — Últimos 12 Meses
            </h2>
            <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendData}>
                    <defs>
                        <linearGradient id="gradBooks" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradPages" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--color-muted)" }} />
                    <YAxis yAxisId="books" allowDecimals={false} tick={{ fontSize: 10, fill: "var(--color-muted)" }} width={28} />
                    <YAxis yAxisId="pages" orientation="right" tick={{ fontSize: 10, fill: "var(--color-muted)" }} width={40} />
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-muted)" }} />
                    <Area
                        yAxisId="books"
                        type="monotone"
                        dataKey="booksRead"
                        name="Livros"
                        stroke="#6366f1"
                        fill="url(#gradBooks)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                    />
                    <Area
                        yAxisId="pages"
                        type="monotone"
                        dataKey="pagesRead"
                        name="Páginas"
                        stroke="#22c55e"
                        fill="url(#gradPages)"
                        strokeWidth={2}
                        dot={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// 4. Gráfico de Barras Mensal (ano atual)
// ─────────────────────────────────────────────────────────────
function MonthlyBarChart({ monthlyData }) {
    if (!monthlyData) return null;
    const chartData = MONTH_ABBR.map((name) => ({ name, livros: monthlyData[name] || 0 }));
    return (
        <div className="card p-6">
            <h2 className="text-base font-semibold text-[--color-text] mb-4 flex items-center gap-2">
                <i className="fa-solid fa-calendar text-orange-500" /> Livros por Mês ({new Date().getFullYear()})
            </h2>
            <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted)" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-muted)" }} />
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                    <Bar dataKey="livros" name="Livros" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// 5. Gráfico de Pizza — Top Categorias
// ─────────────────────────────────────────────────────────────
function CategoryPieChart({ categoryData }) {
    if (!categoryData || !Object.keys(categoryData).length) return null;
    const data = Object.entries(categoryData).map(([name, value]) => ({ name, value }));
    return (
        <div className="card p-6">
            <h2 className="text-base font-semibold text-[--color-text] mb-4 flex items-center gap-2">
                <i className="fa-solid fa-chart-pie text-primary-500" /> Lidos por Categoria
            </h2>
            <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                    <Pie
                        data={data}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={85}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                    >
                        {data.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// 6. Gráfico de Barras Horizontais — Top Autores
// ─────────────────────────────────────────────────────────────
function AuthorBarChart({ authorData }) {
    if (!authorData || !Object.keys(authorData).length) return null;
    const data = Object.entries(authorData).map(([author, cnt]) => ({ author, livros: cnt }));
    return (
        <div className="card p-6">
            <h2 className="text-base font-semibold text-[--color-text] mb-4 flex items-center gap-2">
                <i className="fa-solid fa-user-pen text-green-500" /> Top Autores
            </h2>
            <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-muted)" }} />
                    <YAxis type="category" dataKey="author" width={120} tick={{ fontSize: 11, fill: "var(--color-muted)" }} />
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                    <Bar dataKey="livros" name="Livros lidos" fill="#22c55e" radius={[0, 4, 4, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// 7. Tabela de Comparação Anual (3 anos)
// ─────────────────────────────────────────────────────────────
function YearlyComparisonTable({ yearlyData }) {
    if (!yearlyData) return null;
    const years = Object.values(yearlyData).sort((a, b) => a.year - b.year);
    const chartData = years.map((y) => ({ name: String(y.year), livros: y.booksRead, paginas: y.totalPages }));
    return (
        <div className="card p-6">
            <h2 className="text-base font-semibold text-[--color-text] mb-4 flex items-center gap-2">
                <i className="fa-solid fa-calendar-days text-blue-500" /> Comparativo Anual
            </h2>
            <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-[--color-border]">
                            <th className="text-left py-2 text-[--color-muted] font-medium">Ano</th>
                            <th className="text-right py-2 text-[--color-muted] font-medium">Livros</th>
                            <th className="text-right py-2 text-[--color-muted] font-medium">Variação</th>
                            <th className="text-right py-2 text-[--color-muted] font-medium">Páginas</th>
                            <th className="text-right py-2 text-[--color-muted] font-medium">Avaliação</th>
                        </tr>
                    </thead>
                    <tbody>
                        {years.map((yr, i) => {
                            const prev = years[i - 1];
                            const variation = prev && prev.booksRead > 0 ? ((yr.booksRead - prev.booksRead) / prev.booksRead) * 100 : null;
                            return (
                                <tr key={yr.year} className="border-b border-[--color-border] last:border-0">
                                    <td className="py-2 font-semibold text-[--color-text]">{yr.year}</td>
                                    <td className="py-2 text-right text-[--color-text]">{yr.booksRead}</td>
                                    <td className="py-2 text-right">
                                        {variation !== null ? (
                                            <span
                                                className={`flex items-center justify-end gap-1 text-xs font-medium ${variation >= 0 ? "text-green-600" : "text-red-500"}`}
                                            >
                                                <i className={`fa-solid fa-arrow-${variation >= 0 ? "up" : "down"}`} />
                                                {Math.abs(variation).toFixed(1)}%
                                            </span>
                                        ) : (
                                            <span className="text-[--color-muted] text-xs">—</span>
                                        )}
                                    </td>
                                    <td className="py-2 text-right text-[--color-text]">{yr.totalPages.toLocaleString("pt-BR")}</td>
                                    <td className="py-2 text-right text-amber-500 font-medium">{yr.averageRating ? `${yr.averageRating}★` : "—"}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <ResponsiveContainer width="100%" height={130}>
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted)" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--color-muted)" }} />
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                    <Bar dataKey="livros" name="Livros" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// 8. Tabela Top 10 Livros
// ─────────────────────────────────────────────────────────────
function TopRatedBooksTable({ books }) {
    if (!books?.length) return null;
    return (
        <div className="card p-6">
            <h2 className="text-base font-semibold text-[--color-text] mb-4 flex items-center gap-2">
                <i className="fa-solid fa-medal text-yellow-500" /> Top 10 Livros Mais Bem Avaliados
            </h2>
            <div className="space-y-2">
                {books.map((book, i) => (
                    <div key={i} className="flex items-center gap-3 py-1 border-b border-[--color-border] last:border-0">
                        <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                            ${i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-slate-100 text-slate-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-50 dark:bg-slate-800 text-[--color-muted]"}`}
                        >
                            {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[--color-text] truncate">{book.title}</p>
                            <p className="text-xs text-[--color-muted] truncate">
                                {book.author} · {book.categoryName}
                            </p>
                        </div>
                        <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, s) => (
                                <i
                                    key={s}
                                    className={`fa-solid fa-star text-xs ${s < book.rating ? "text-yellow-400" : "text-gray-200 dark:text-gray-700"}`}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// 9. Insights Inteligentes
// ─────────────────────────────────────────────────────────────
function SmartInsights({ stats }) {
    if (!stats) return null;
    const { booksRead, totalPagesRead, favoriteCategory, currentStreak, longestStreak, averageRating } = stats;

    const avgPagesPerBook = booksRead > 0 ? Math.round(totalPagesRead / booksRead) : 0;
    const ratingText =
        !averageRating || averageRating === 0
            ? "Comece a avaliar seus livros para ter insights personalizados!"
            : averageRating >= 4.5
              ? "Você é muito exigente e adora livros excepcionais!"
              : averageRating >= 4.0
                ? "Você aprecia livros de qualidade!"
                : averageRating >= 3.5
                  ? "Você tem um gosto equilibrado para leituras."
                  : averageRating >= 3.0
                    ? "Você explora diversos tipos de livros."
                    : "Você está descobrindo suas preferências.";

    const insights = [
        {
            icon: "fa-book-open-reader",
            color: "text-blue-500",
            bg: "bg-blue-50 dark:bg-blue-900/20",
            title: "Ritmo de Leitura",
            text:
                booksRead > 0
                    ? `Você leu ${booksRead} livro${booksRead > 1 ? "s" : ""} totalizando ${totalPagesRead.toLocaleString("pt-BR")} páginas. Cada livro tem em média ${avgPagesPerBook} páginas.`
                    : "Ainda não há livros lidos. Comece sua jornada de leitura!",
        },
        {
            icon: "fa-heart",
            color: "text-pink-500",
            bg: "bg-pink-50 dark:bg-pink-900/20",
            title: "Categoria Favorita",
            text:
                favoriteCategory && favoriteCategory !== "N/A"
                    ? `Você adora ${favoriteCategory}! É sua categoria mais lida.`
                    : "Explore diferentes categorias para descobrir suas preferências!",
        },
        {
            icon: "fa-fire",
            color: "text-orange-500",
            bg: "bg-orange-50 dark:bg-orange-900/20",
            title: "Sequência Atual",
            text:
                currentStreak > 0
                    ? `Você está há ${currentStreak} dia${currentStreak > 1 ? "s" : ""} lendo consecutivamente!${currentStreak === longestStreak && longestStreak > 0 ? " 🏆 RECORDE!" : ""}`
                    : "Comece uma sequência lendo hoje!",
        },
        {
            icon: "fa-star",
            color: "text-amber-500",
            bg: "bg-amber-50 dark:bg-amber-900/20",
            title: "Critério de Avaliação",
            text: ratingText,
        },
    ];

    return (
        <div className="card p-6">
            <h2 className="text-base font-semibold text-[--color-text] mb-4 flex items-center gap-2">
                <i className="fa-solid fa-lightbulb text-yellow-500" /> Insights Inteligentes
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {insights.map((ins) => (
                    <div key={ins.title} className={`rounded-xl p-4 ${ins.bg}`}>
                        <div className="flex items-center gap-2 mb-1">
                            <i className={`fa-solid ${ins.icon} ${ins.color}`} />
                            <span className="text-sm font-semibold text-[--color-text]">{ins.title}</span>
                        </div>
                        <p className="text-sm text-[--color-muted]">{ins.text}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// 10. Análise de Integridade de Comportamento
// ─────────────────────────────────────────────────────────────
const SEVERITY_CONFIG = {
    high: { icon: "fa-circle-xmark", color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/20", label: "Alto" },
    medium: { icon: "fa-triangle-exclamation", color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-900/20", label: "Médio" },
    low: { icon: "fa-circle-info", color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-900/20", label: "Baixo" },
};

const SCORE_STYLE = {
    excellent: {
        bar: "bg-green-500",
        ring: "ring-green-400",
        text: "text-green-600",
        bgCard: "bg-green-50 dark:bg-green-900/20",
        border: "border-green-200 dark:border-green-800",
    },
    good: {
        bar: "bg-yellow-400",
        ring: "ring-yellow-400",
        text: "text-yellow-600",
        bgCard: "bg-yellow-50 dark:bg-yellow-900/20",
        border: "border-yellow-200 dark:border-yellow-800",
    },
    warning: {
        bar: "bg-orange-400",
        ring: "ring-orange-400",
        text: "text-orange-600",
        bgCard: "bg-orange-50 dark:bg-orange-900/20",
        border: "border-orange-200 dark:border-orange-800",
    },
    alert: {
        bar: "bg-red-500",
        ring: "ring-red-400",
        text: "text-red-600",
        bgCard: "bg-red-50 dark:bg-red-900/20",
        border: "border-red-200 dark:border-red-800",
    },
};

function IntegrityScoreGauge({ score, level }) {
    const style = SCORE_STYLE[level] || SCORE_STYLE.excellent;
    const circumference = 2 * Math.PI * 36; // raio 36
    const offset = circumference - (score / 100) * circumference;
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="36" strokeWidth="7" stroke="var(--color-border)" fill="none" />
                    <circle
                        cx="40"
                        cy="40"
                        r="36"
                        strokeWidth="7"
                        fill="none"
                        stroke={level === "excellent" ? "#22c55e" : level === "good" ? "#facc15" : level === "warning" ? "#fb923c" : "#ef4444"}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dashoffset 0.8s ease" }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-bold ${style.text}`}>{score}</span>
                    <span className="text-[9px] text-[--color-muted] leading-none">/100</span>
                </div>
            </div>
            <p className={`text-xs font-semibold ${style.text}`}>
                {level === "excellent" ? "Excelente" : level === "good" ? "Bom" : level === "warning" ? "Atenção" : "Alerta"}
            </p>
        </div>
    );
}

function IntegrityAnalysisCard({ integrity }) {
    const [expanded, setExpanded] = useState(false);
    if (!integrity) return null;

    const { score, level, emoji, message, flags, platformStats, stats } = integrity;
    const style = SCORE_STYLE[level] || SCORE_STYLE.excellent;

    return (
        <div className={`card border ${style.border} overflow-hidden`}>
            {/* Cabeçalho */}
            <div className={`${style.bgCard} p-5 flex items-start gap-4`}>
                <IntegrityScoreGauge score={score} level={level} />
                <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold text-[--color-text] flex items-center gap-2 mb-1">
                        <i className="fa-solid fa-shield-halved text-primary-500" />
                        Score de Integridade
                    </h2>
                    <p className={`text-sm font-medium ${style.text} mb-2`}>
                        {emoji} {message}
                    </p>
                    {/* Barra de score */}
                    <div className="w-full bg-[--color-border] rounded-full h-2 max-w-sm">
                        <div className={`${style.bar} h-2 rounded-full transition-all duration-700`} style={{ width: `${score}%` }} />
                    </div>
                </div>
            </div>

            {/* Painel de métricas resumidas */}
            <div className="px-5 pt-4 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-[--color-border]">
                {[
                    { label: "Livros concluídos", value: stats.totalFinished, icon: "fa-check-circle", color: "text-green-500" },
                    {
                        label: "Conclusões no mesmo dia",
                        value: `${stats.instantReads} (${stats.instantPct}%)`,
                        icon: "fa-bolt",
                        color: stats.instantPct >= 30 ? "text-orange-500" : "text-[--color-muted]",
                    },
                    {
                        label: "Adicionado e lido no dia",
                        value: stats.sameDayAddAndRead,
                        icon: "fa-calendar-day",
                        color: stats.sameDayAddAndRead >= 2 ? "text-orange-500" : "text-[--color-muted]",
                    },
                    {
                        label: "Velocidade impossível",
                        value: stats.impossiblyFastCount,
                        icon: "fa-gauge-high",
                        color: stats.impossiblyFastCount > 0 ? "text-red-500" : "text-[--color-muted]",
                    },
                ].map((m) => (
                    <div key={m.label} className="text-center">
                        <i className={`fa-solid ${m.icon} ${m.color} text-lg mb-0.5`} />
                        <p className="text-base font-bold text-[--color-text]">{m.value}</p>
                        <p className="text-[10px] text-[--color-muted] leading-tight">{m.label}</p>
                    </div>
                ))}
            </div>

            {/* Flags de anomalia */}
            {flags.length > 0 && (
                <div className="px-5 py-4">
                    <button
                        onClick={() => setExpanded((v) => !v)}
                        className="flex items-center gap-2 text-sm font-medium text-[--color-text] hover:text-primary-500 transition-colors mb-3"
                    >
                        <i className={`fa-solid fa-chevron-${expanded ? "up" : "down"} text-xs`} />
                        {flags.length} padrão{flags.length !== 1 ? "s" : ""} detectado{flags.length !== 1 ? "s" : ""}
                    </button>

                    {expanded && (
                        <div className="space-y-2">
                            {flags.map((flag, i) => {
                                const cfg = SEVERITY_CONFIG[flag.severity] || SEVERITY_CONFIG.low;
                                return (
                                    <div key={i} className={`rounded-xl p-3 flex gap-3 items-start ${cfg.bg}`}>
                                        <i className={`fa-solid ${cfg.icon} ${cfg.color} mt-0.5 flex-shrink-0`} />
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-[--color-text]">{flag.label}</p>
                                            <p className="text-xs text-[--color-muted] mt-0.5">{flag.detail}</p>
                                        </div>
                                        <span
                                            className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.color} ${cfg.bg} border border-current/20`}
                                        >
                                            {cfg.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Contexto da plataforma */}
            {platformStats && (
                <div className="px-5 pb-4 border-t border-[--color-border] pt-3">
                    <p className="text-xs font-semibold text-[--color-muted] uppercase tracking-wide mb-2">
                        <i className="fa-solid fa-users mr-1" /> Médias da Plataforma ({platformStats.totalUsers} leitor
                        {platformStats.totalUsers !== 1 ? "es" : ""})
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm">
                        <span className="text-[--color-muted]">
                            Livros lidos: <strong className="text-[--color-text]">{platformStats.avgBooksRead}</strong>
                        </span>
                        <span className="text-[--color-muted]">
                            Páginas lidas: <strong className="text-[--color-text]">{platformStats.avgPagesRead.toLocaleString("pt-BR")}</strong>
                        </span>
                        {platformStats.medianReadingDays !== null && (
                            <span className="text-[--color-muted]">
                                Mediana de dias/livro: <strong className="text-[--color-text]">{platformStats.medianReadingDays} dias</strong>
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-[--color-muted] mt-2 italic">
                        <i className="fa-solid fa-circle-info mr-1" />
                        Leituras muito acima das médias da plataforma podem indicar dados inflados. A experiência autêntica é o que importa.
                    </p>
                </div>
            )}

            {/* Nenhum padrão detectado */}
            {flags.length === 0 && score >= 80 && (
                <div className="px-5 pb-4 text-center">
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                        <i className="fa-solid fa-circle-check mr-1" />
                        Nenhum padrão suspeito detectado. Seus registros parecem refletir leituras reais.
                    </p>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// 11. Comparação Social
// ─────────────────────────────────────────────────────────────
function SocialComparison({ social }) {
    if (!social) return null;
    const metrics = [
        {
            label: "Livros Lidos",
            user: social.userBooksRead,
            avg: social.avgBooksRead,
            rank: social.rankByBooks,
            icon: "fa-books",
            color: "text-primary-600",
        },
        {
            label: "Páginas Lidas",
            user: social.userPagesRead,
            avg: social.avgPagesRead,
            rank: social.rankByPages,
            icon: "fa-file-lines",
            color: "text-orange-500",
        },
        { label: "Sequência", user: social.userStreak, avg: social.avgStreak, rank: social.rankByStreak, icon: "fa-fire", color: "text-red-500" },
        { label: "Nível", user: social.userLevel, avg: social.avgLevel, rank: social.rankByPoints, icon: "fa-trophy", color: "text-yellow-500" },
    ];
    return (
        <div className="card p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-base font-semibold text-[--color-text] flex items-center gap-2">
                    <i className="fa-solid fa-users text-blue-500" /> Comparação Social
                </h2>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-[--color-muted]">{social.totalActiveUsers} leitores ativos</span>
                    <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold">
                        Top {social.topPercentile}%
                    </span>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {metrics.map((m) => {
                    const isAbove = m.user >= m.avg;
                    return (
                        <div key={m.label} className="text-center">
                            <i className={`fa-solid ${m.icon} ${m.color} text-lg mb-1`} />
                            <p className="text-xs text-[--color-muted] mb-1">{m.label}</p>
                            <p className="text-xl font-bold text-[--color-text]">{m.user}</p>
                            <p className="text-xs text-[--color-muted]">Média: {m.avg}</p>
                            <span className={`text-xs font-medium ${isAbove ? "text-green-600" : "text-red-500"}`}>
                                <i className={`fa-solid fa-arrow-${isAbove ? "up" : "down"} mr-0.5`} />
                                {isAbove ? "Acima" : "Abaixo"} da média
                            </span>
                            <p className="text-xs text-[--color-muted] mt-0.5">#{m.rank}º lugar</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// 12. Leaderboard Global
// ─────────────────────────────────────────────────────────────
const MEDAL_CONFIG = [
    {
        bg: "bg-gradient-to-br from-yellow-300 to-yellow-500",
        text: "text-yellow-900",
        shadow: "shadow-yellow-300/60",
        emoji: "🥇",
        ring: "ring-2 ring-yellow-400",
    },
    {
        bg: "bg-gradient-to-br from-slate-300 to-slate-400",
        text: "text-slate-800",
        shadow: "shadow-slate-300/60",
        emoji: "🥈",
        ring: "ring-2 ring-slate-400",
    },
    {
        bg: "bg-gradient-to-br from-orange-300 to-orange-500",
        text: "text-orange-900",
        shadow: "shadow-orange-300/60",
        emoji: "🥉",
        ring: "ring-2 ring-orange-400",
    },
];

const AVATAR_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(/\/api$/, "");

function LeaderboardAvatar({ entry, size = "w-10 h-10", textSize = "text-sm" }) {
    const src = entry.avatarPath ? `${AVATAR_BASE}${entry.avatarPath}` : null;
    const initials = (entry.userName || "?")[0].toUpperCase();
    const colors = ["bg-primary-500", "bg-violet-500", "bg-green-500", "bg-pink-500", "bg-orange-500", "bg-teal-500"];
    const color = colors[(entry.userName?.charCodeAt(0) || 0) % colors.length];
    if (src) {
        return <img src={src} alt={entry.userName} className={`${size} rounded-full object-cover flex-shrink-0`} />;
    }
    return (
        <div className={`${size} rounded-full ${color} flex items-center justify-center flex-shrink-0`}>
            <span className={`${textSize} font-bold text-white`}>{initials}</span>
        </div>
    );
}

function GlobalLeaderboard({ leaderboard, currentUserName, totalActiveUsers }) {
    if (!leaderboard?.length) return null;
    return (
        <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-[--color-text] flex items-center gap-2">
                    <i className="fa-solid fa-ranking-star text-yellow-500" /> Leaderboard Global
                </h2>
                <span className="text-xs text-[--color-muted]">{totalActiveUsers || leaderboard.length} leitores</span>
            </div>

            {/* Top 3 em destaque */}
            {leaderboard.length >= 1 && (
                <div className="flex justify-center items-end gap-4 mb-6">
                    {/* 2º lugar — mais baixo */}
                    {leaderboard[1] &&
                        (() => {
                            const e = leaderboard[1];
                            const isMe = e.userName === currentUserName;
                            return (
                                <div className="flex flex-col items-center gap-1 w-24">
                                    <LeaderboardAvatar entry={e} size="w-12 h-12" textSize="text-base" />
                                    <p
                                        className={`text-xs font-semibold text-center truncate w-full leading-tight ${isMe ? "text-primary-500" : "text-[--color-text]"}`}
                                    >
                                        {e.userName}
                                        {isMe && " (você)"}
                                    </p>
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${MEDAL_CONFIG[1].bg} ${MEDAL_CONFIG[1].shadow}`}
                                    >
                                        <span className="text-lg leading-none">🥈</span>
                                    </div>
                                    <p className="text-xs font-bold text-primary-600">{e.totalPoints} pts</p>
                                </div>
                            );
                        })()}

                    {/* 1º lugar — mais alto */}
                    {(() => {
                        const e = leaderboard[0];
                        const isMe = e.userName === currentUserName;
                        return (
                            <div className="flex flex-col items-center gap-1 w-24 -mt-4">
                                <div className="text-2xl leading-none mb-0.5">👑</div>
                                <LeaderboardAvatar entry={e} size="w-14 h-14" textSize="text-lg" />
                                <p
                                    className={`text-xs font-semibold text-center truncate w-full leading-tight ${isMe ? "text-primary-500" : "text-[--color-text]"}`}
                                >
                                    {e.userName}
                                    {isMe && " (você)"}
                                </p>
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${MEDAL_CONFIG[0].bg} ${MEDAL_CONFIG[0].shadow}`}
                                >
                                    <span className="text-lg leading-none">🥇</span>
                                </div>
                                <p className="text-xs font-bold text-yellow-500">{e.totalPoints} pts</p>
                            </div>
                        );
                    })()}

                    {/* 3º lugar */}
                    {leaderboard[2] &&
                        (() => {
                            const e = leaderboard[2];
                            const isMe = e.userName === currentUserName;
                            return (
                                <div className="flex flex-col items-center gap-1 w-24 mt-2">
                                    <LeaderboardAvatar entry={e} size="w-12 h-12" textSize="text-base" />
                                    <p
                                        className={`text-xs font-semibold text-center truncate w-full leading-tight ${isMe ? "text-primary-500" : "text-[--color-text]"}`}
                                    >
                                        {e.userName}
                                        {isMe && " (você)"}
                                    </p>
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${MEDAL_CONFIG[2].bg} ${MEDAL_CONFIG[2].shadow}`}
                                    >
                                        <span className="text-lg leading-none">🥉</span>
                                    </div>
                                    <p className="text-xs font-bold text-orange-500">{e.totalPoints} pts</p>
                                </div>
                            );
                        })()}
                </div>
            )}

            {/* Posições 4–10 em lista */}
            {leaderboard.length > 3 && (
                <div className="space-y-1 border-t border-[--color-border] pt-4">
                    {leaderboard.slice(3).map((entry, i) => {
                        const rank = i + 4;
                        const isMe = entry.userName === currentUserName;
                        return (
                            <div
                                key={rank}
                                className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${isMe ? "bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}
                            >
                                <span className="w-6 text-center text-xs font-bold text-[--color-muted] flex-shrink-0">#{rank}</span>
                                <LeaderboardAvatar entry={entry} size="w-8 h-8" textSize="text-xs" />
                                <div className="flex-1 min-w-0">
                                    <span className={`text-sm font-medium truncate block ${isMe ? "text-primary-600" : "text-[--color-text]"}`}>
                                        {entry.userName}
                                        {isMe && <span className="text-xs text-primary-400 ml-1">(você)</span>}
                                    </span>
                                    <span className="text-xs text-[--color-muted]">
                                        {entry.booksRead} livros · {(entry.totalPages || 0).toLocaleString("pt-BR")} pág.
                                    </span>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-xs font-bold text-primary-600">{entry.totalPoints} pts</p>
                                    <p className="text-xs text-[--color-muted]">Nível {entry.level}</p>
                                </div>
                                <p className="text-xs text-[--color-muted] flex-shrink-0">{entry.currentStreak}🔥</p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// 13. Card de Compartilhamento Social
// ─────────────────────────────────────────────────────────────
const INTEGRITY_BADGE = {
    excellent: { label: "Leitor Autêntico", emoji: "✅", bg: "bg-green-500" },
    good: { label: "Leitor Dedicado", emoji: "💛", bg: "bg-yellow-400" },
    warning: { label: "Em Crescimento", emoji: "⚠️", bg: "bg-orange-400" },
    alert: { label: "Revisando Dados", emoji: "🚨", bg: "bg-red-500" },
};

function SharePreviewCard({ stats, social, integrity }) {
    const topPct = social?.topPercentile ?? 100;
    const intScore = integrity?.score ?? 100;
    const intLevel = integrity?.level ?? "excellent";
    const badge = INTEGRITY_BADGE[intLevel] || INTEGRITY_BADGE.excellent;
    const avgPages = stats.booksRead > 0 ? Math.round((stats.totalPagesRead || 0) / stats.booksRead) : 0;
    const rankLabel = social?.rankByPoints ? `#${social.rankByPoints}` : "—";

    /* Título dinâmico por nível de leitor */
    const readerTitle =
        stats.booksRead >= 100
            ? "Lenda da Leitura 🏆"
            : stats.booksRead >= 50
              ? "Mestre dos Livros 📕"
              : stats.booksRead >= 25
                ? "Bibliófilo 📘"
                : stats.booksRead >= 10
                  ? "Leitor Regular 📗"
                  : stats.booksRead >= 5
                    ? "Leitor Iniciante 📚"
                    : stats.booksRead >= 1
                      ? "Primeiro Passo 📖"
                      : "Futuro Leitor 🌱";

    return (
        <div className="rounded-2xl overflow-hidden shadow-2xl max-w-sm mx-auto select-none">
            {/* Header gradiente */}
            <div className="bg-gradient-to-br from-primary-600 via-violet-600 to-indigo-700 p-5 pb-3 relative">
                {/* Anel decorativo de fundo */}
                <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/5" />
                <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5" />

                {/* Cabeçalho: avatar + nome */}
                <div className="flex items-center gap-3 mb-3 relative z-10">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl ring-2 ring-white/30">📚</div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-lg leading-tight truncate">{stats.userName}</p>
                        <p className="text-white/70 text-xs">{readerTitle}</p>
                    </div>
                    {/* Rank badge */}
                    <div className="flex flex-col items-center bg-white/15 rounded-xl px-2 py-1 backdrop-blur-sm">
                        <span className="text-white text-xs font-bold leading-none">{rankLabel}º</span>
                        <span className="text-white/60 text-[9px]">ranking</span>
                    </div>
                </div>

                {/* Nível + pontos em destaque */}
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 relative z-10">
                    <div className="flex items-center gap-1.5">
                        <span className="text-amber-300 text-sm">⭐</span>
                        <span className="text-white font-bold text-sm">Nível {stats.level}</span>
                    </div>
                    <span className="text-white/30">·</span>
                    <span className="text-white/80 text-xs">{(stats.totalPoints || 0).toLocaleString("pt-BR")} pontos</span>
                    <span className="ml-auto text-white/70 text-xs">Top {topPct}% 🌍</span>
                </div>
            </div>

            {/* Grade de métricas */}
            <div className="bg-gradient-to-b from-indigo-700 to-violet-800 px-4 py-3">
                <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="bg-white/10 rounded-xl p-2.5 text-center backdrop-blur-sm">
                        <p className="text-white text-xl font-extrabold leading-tight">{stats.booksRead}</p>
                        <p className="text-white/60 text-[10px] mt-0.5">📚 livros lidos</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-2.5 text-center backdrop-blur-sm">
                        <p className="text-white text-xl font-extrabold leading-tight">{(stats.totalPagesRead || 0).toLocaleString("pt-BR")}</p>
                        <p className="text-white/60 text-[10px] mt-0.5">📄 páginas</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-2.5 text-center backdrop-blur-sm">
                        <p className="text-white text-xl font-extrabold leading-tight">{stats.currentStreak}🔥</p>
                        <p className="text-white/60 text-[10px] mt-0.5">sequência</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/10 rounded-xl p-2.5 text-center backdrop-blur-sm">
                        <p className="text-white text-base font-bold">{avgPages > 0 ? avgPages : "—"}</p>
                        <p className="text-white/60 text-[10px]">⚡ pg/livro (média)</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-2.5 text-center backdrop-blur-sm">
                        <p className="text-white text-base font-bold">{stats.averageRating ? `${stats.averageRating}★` : "—"}</p>
                        <p className="text-white/60 text-[10px]">avaliação média</p>
                    </div>
                </div>
            </div>

            {/* Rodapé: score de integridade + branding */}
            <div className="bg-violet-900 px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <span className="text-xs">{badge.emoji}</span>
                    <span className="text-white/80 text-[11px] font-medium">{badge.label}</span>
                    <span className="text-white/40 text-[10px]">· integridade {intScore}/100</span>
                </div>
                <span className="text-white/40 text-[10px]">BookLibrary {new Date().getFullYear()}</span>
            </div>
        </div>
    );
}

function SocialShareCard({ social, stats, integrity }) {
    const [copied, setCopied] = useState(false);

    if (!stats) return null;

    const topPct = social?.topPercentile ?? 100;
    const intScore = integrity?.score ?? 100;
    const intLevel = integrity?.level ?? "excellent";
    const badge = INTEGRITY_BADGE[intLevel] || INTEGRITY_BADGE.excellent;

    const shareText = encodeURIComponent(
        `📚 Olá! Sou ${stats.userName} e já li ${stats.booksRead} livro${stats.booksRead !== 1 ? "s" : ""} com ${(stats.totalPagesRead || 0).toLocaleString("pt-BR")} páginas no BookLibrary!` +
            ` 🔥 ${stats.currentStreak} dias de sequência · Nível ${stats.level} · Top ${topPct}% dos leitores.` +
            ` ✅ Score de Integridade: ${intScore}/100 (${badge.label}).`,
    );
    const shareUrl = encodeURIComponent(window.location.origin + "/statistics");

    const networks = [
        {
            name: "Twitter/X",
            icon: "fa-brands fa-x-twitter",
            color: "bg-black text-white",
            url: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,
        },
        {
            name: "Facebook",
            icon: "fa-brands fa-facebook-f",
            color: "bg-blue-600 text-white",
            url: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
        },
        {
            name: "WhatsApp",
            icon: "fa-brands fa-whatsapp",
            color: "bg-green-500 text-white",
            url: `https://api.whatsapp.com/send?text=${shareText}%20${shareUrl}`,
        },
        {
            name: "LinkedIn",
            icon: "fa-brands fa-linkedin-in",
            color: "bg-blue-700 text-white",
            url: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`,
        },
    ];

    const handleCopy = () => {
        navigator.clipboard.writeText(decodeURIComponent(shareText)).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        });
    };

    /* Frase de incentivo gerada dinamicamente */
    const motiveLine =
        stats.booksRead === 0
            ? "Registre seu primeiro livro e conquiste seu lugar no ranking! 🚀"
            : topPct >= 90
              ? `Você está no Top ${topPct}% — continue explorando novos mundos! 📖`
              : topPct >= 50
                ? `Top ${topPct}% da plataforma! Cada página te aproxima do topo! 💪`
                : `Você está entre os ${topPct}% melhores leitores! Impressionante! 🏆`;

    return (
        <div className="card overflow-hidden">
            {/* Faixa superior gradiente com CTA */}
            <div className="bg-gradient-to-r from-primary-600 to-violet-600 px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h2 className="text-white font-bold text-base flex items-center gap-2">
                        <i className="fa-solid fa-share-nodes" /> Compartilhe sua jornada
                    </h2>
                    <p className="text-white/70 text-xs mt-0.5">{motiveLine}</p>
                </div>
                {/* Mini score badge */}
                <div className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2 backdrop-blur-sm flex-shrink-0">
                    <span className="text-lg">{badge.emoji}</span>
                    <div>
                        <p className="text-white text-xs font-bold leading-none">{badge.label}</p>
                        <p className="text-white/60 text-[10px]">integridade {intScore}/100</p>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-5">
                {/* Preview do card */}
                <SharePreviewCard stats={stats} social={social} integrity={integrity} />

                {/* Destaques do leitor */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        {
                            icon: "fa-books",
                            color: "text-primary-500",
                            bg: "bg-primary-50 dark:bg-primary-900/20",
                            label: "Livros lidos",
                            value: stats.booksRead,
                        },
                        {
                            icon: "fa-fire",
                            color: "text-red-500",
                            bg: "bg-red-50 dark:bg-red-900/20",
                            label: "Melhor sequência",
                            value: `${stats.longestStreak}d`,
                        },
                        {
                            icon: "fa-trophy",
                            color: "text-yellow-500",
                            bg: "bg-yellow-50 dark:bg-yellow-900/20",
                            label: "Posição global",
                            value: social?.rankByPoints ? `#${social.rankByPoints}º` : "—",
                        },
                        {
                            icon: "fa-shield-halved",
                            color: "text-green-500",
                            bg: "bg-green-50 dark:bg-green-900/20",
                            label: "Integridade",
                            value: `${intScore}/100`,
                        },
                    ].map((m) => (
                        <div key={m.label} className={`rounded-xl p-3 text-center ${m.bg}`}>
                            <i className={`fa-solid ${m.icon} ${m.color} text-lg mb-1`} />
                            <p className="text-lg font-extrabold text-[--color-text]">{m.value}</p>
                            <p className="text-[10px] text-[--color-muted] leading-tight mt-0.5">{m.label}</p>
                        </div>
                    ))}
                </div>

                {/* Botões de compartilhamento */}
                <div>
                    <p className="text-xs text-[--color-muted] text-center mb-3">Compartilhe em:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                        {networks.map((net) => (
                            <button
                                key={net.name}
                                onClick={() => window.open(net.url, "_blank", "width=600,height=400")}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 hover:shadow-md ${net.color}`}
                            >
                                <i className={net.icon} />
                                {net.name}
                            </button>
                        ))}
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[--color-border] text-[--color-text] hover:bg-[--color-border] transition-all hover:scale-105"
                        >
                            <i className={`fa-solid ${copied ? "fa-check text-green-500" : "fa-copy"}`} />
                            {copied ? "Copiado!" : "Copiar texto"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Página Principal
// ─────────────────────────────────────────────────────────────
export default function StatisticsPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [planError, setPlanError] = useState(false);

    useEffect(() => {
        api.get("/statistics")
            .then((r) => setData(r.data))
            .catch((err) => {
                if (err.response?.status === 403) setPlanError(true);
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading)
        return (
            <div className="flex justify-center py-16">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <i className="fa-solid fa-chart-bar text-primary-600 text-xl" />
                <h1 className="text-2xl font-bold text-[--color-text]">Estatísticas Avançadas</h1>
            </div>

            {planError ? (
                <UpgradeBanner />
            ) : data ? (
                <>
                    {/* 1. Cards de resumo */}
                    <SummaryCards stats={data.userStats} />

                    {/* 2. Velocidade + meta anual */}
                    <ReadingVelocityCard velocity={data.readingVelocity} stats={data.userStats} />

                    {/* 3. Tendência 12 meses */}
                    <ReadingTrendChart trendData={data.readingTrendData} />

                    {/* 4+5. Mensal + Comparativo Anual */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <MonthlyBarChart monthlyData={data.monthlyReadingData} />
                        <YearlyComparisonTable yearlyData={data.yearlyComparison} />
                    </div>

                    {/* 6+7. Categorias + Autores */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <CategoryPieChart categoryData={data.readingByCategory} />
                        <AuthorBarChart authorData={data.readingByAuthor} />
                    </div>

                    {/* 8. Top livros */}
                    <TopRatedBooksTable books={data.topRatedBooks} />

                    {/* 9. Insights — full width */}
                    <SmartInsights stats={data.userStats} />

                    {/* 10. Score de Integridade de Comportamento */}
                    <IntegrityAnalysisCard integrity={data.integrityAnalysis} />

                    {/* 11. Comparação Social */}
                    <SocialComparison social={data.socialComparison} />

                    {/* 12. Leaderboard */}
                    <GlobalLeaderboard
                        leaderboard={data.globalLeaderboard}
                        currentUserName={data.userStats?.userName}
                        totalActiveUsers={data.socialComparison?.totalActiveUsers}
                    />

                    {/* 13. Compartilhamento */}
                    <SocialShareCard social={data.socialComparison} stats={data.userStats} integrity={data.integrityAnalysis} />
                </>
            ) : (
                <div className="card p-8 text-center text-[--color-muted]">
                    <i className="fa-solid fa-chart-bar text-4xl mb-3 opacity-30" />
                    <p>Nenhum dado encontrado. Adicione livros à sua biblioteca para ver as estatísticas.</p>
                </div>
            )}
        </div>
    );
}
