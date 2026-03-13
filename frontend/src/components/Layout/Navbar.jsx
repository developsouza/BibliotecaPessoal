import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

export default function Navbar({ onMenuClick }) {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const avatarSrc = user?.avatarPath ? `http://localhost:3001${user.avatarPath}` : null;

    return (
        <header className="border-b border-[--color-border] bg-[--color-surface] px-4 py-3">
            <div className="flex items-center justify-between gap-4">
                {/* Left: hamburger (mobile) + logo */}
                <div className="flex items-center gap-2">
                    <button onClick={onMenuClick} className="md:hidden btn-ghost p-2 rounded-lg text-[--color-muted]" aria-label="Abrir menu">
                        <i className="fa-solid fa-bars text-base" />
                    </button>
                    <div className="flex items-center gap-2 md:hidden">
                        <span className="text-xl">📚</span>
                        <span className="font-bold text-[--color-text]">BookLibrary</span>
                    </div>
                </div>
                <div className="hidden md:block" />

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    {/* Add book shortcut — oculto para master admin */}
                    {!user?.isMasterAdmin && (
                        <Link to="/books/new" className="btn btn-primary btn-sm hidden sm:inline-flex">
                            <i className="fa-solid fa-plus" />
                            <span>Novo livro</span>
                        </Link>
                    )}

                    {/* Theme toggle */}
                    <button onClick={toggleTheme} className="btn-ghost p-2 rounded-lg" title={theme === "dark" ? "Modo claro" : "Modo escuro"}>
                        {theme === "dark" ? (
                            <i className="fa-solid fa-sun text-yellow-400 text-base" />
                        ) : (
                            <i className="fa-solid fa-moon text-slate-600 text-base" />
                        )}
                    </button>

                    {/* User avatar */}
                    <Link to={user?.isMasterAdmin ? "/admin" : "/profile"} className="flex items-center gap-2 group">
                        {avatarSrc ? (
                            <img
                                src={avatarSrc}
                                alt="avatar"
                                className="w-8 h-8 rounded-full object-cover ring-2 ring-[--color-border] group-hover:ring-primary-400 transition-all"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center text-sm font-bold ring-2 ring-[--color-border] group-hover:ring-primary-400 transition-all">
                                {user?.fullName?.[0]?.toUpperCase() || "U"}
                            </div>
                        )}
                        <span className="hidden md:block text-sm font-medium text-[--color-text] max-w-[120px] truncate">
                            {user?.fullName || "Usuário"}
                        </span>
                    </Link>
                </div>
            </div>
        </header>
    );
}
