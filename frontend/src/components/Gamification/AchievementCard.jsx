const RARITY_STYLES = {
    common: {
        ring: "ring-slate-300 dark:ring-slate-600",
        bg: "bg-slate-50 dark:bg-slate-800",
        text: "text-slate-600 dark:text-slate-400",
        badge: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
        label: "Comum",
    },
    rare: {
        ring: "ring-blue-300 dark:ring-blue-700",
        bg: "bg-blue-50 dark:bg-blue-900/30",
        text: "text-blue-600 dark:text-blue-400",
        badge: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
        label: "Raro",
    },
    epic: {
        ring: "ring-purple-300 dark:ring-purple-700",
        bg: "bg-purple-50 dark:bg-purple-900/30",
        text: "text-purple-600 dark:text-purple-400",
        badge: "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300",
        label: "Épico",
    },
    legendary: {
        ring: "ring-yellow-300 dark:ring-yellow-600",
        bg: "bg-yellow-50 dark:bg-yellow-900/30",
        text: "text-yellow-600 dark:text-yellow-400",
        badge: "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300",
        label: "Lendário",
    },
};

function formatDate(dateStr) {
    if (!dateStr) return null;
    try {
        return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
        return null;
    }
}

export default function AchievementCard({ achievement, compact = false }) {
    const style = RARITY_STYLES[achievement.rarity] || RARITY_STYLES.common;
    const unlocked = !!achievement.unlocked;
    const isNew = unlocked && achievement.has_been_viewed === 0;
    const unlockedDate = formatDate(achievement.unlocked_at);

    return (
        <div
            className={`relative rounded-xl border-2 p-4 flex flex-col items-center text-center gap-2 transition-all duration-200
      ${unlocked ? `ring-2 ${style.ring} ${style.bg} border-transparent` : "border-slate-200 dark:border-slate-700 bg-[--color-card]"}
      ${unlocked ? "hover:scale-[1.03]" : "opacity-50 grayscale hover:opacity-70"}
    `}
            title={unlocked ? `Desbloqueado${unlockedDate ? ` em ${unlockedDate}` : ""}` : "Bloqueado"}
        >
            {/* Badge "Novo" para conquistas recentemente desbloqueadas não visualizadas */}
            {isNew && (
                <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-tight animate-pulse">
                    NOVO
                </span>
            )}

            <div className={`text-4xl ${compact ? "text-3xl" : ""}`}>{achievement.icon}</div>

            <p className={`text-sm font-semibold leading-tight ${unlocked ? style.text : "text-[--color-muted]"}`}>{achievement.name}</p>

            {!compact && <p className="text-xs text-[--color-muted] leading-snug">{achievement.description}</p>}

            <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.badge}`}>{style.label}</span>
                <span className="text-xs text-[--color-muted]">+{achievement.points} pts</span>
            </div>

            {/* Data de desbloqueio */}
            {unlocked && unlockedDate && !compact && <p className="text-[10px] text-[--color-muted] leading-none mt-0.5">{unlockedDate}</p>}

            {/* Check verde no canto */}
            {unlocked && (
                <div className="absolute top-2 right-2">
                    <i className="fa-solid fa-check-circle text-green-500 text-sm" />
                </div>
            )}
        </div>
    );
}
