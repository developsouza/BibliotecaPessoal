import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

export default function LoginPage() {
    const { login } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const [form, setForm] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const loggedUser = await login(form.email, form.password);
            navigate(loggedUser.isMasterAdmin ? "/admin" : "/");
        } catch (err) {
            setError(err.response?.data?.error || "Erro ao fazer login. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[--color-bg] flex flex-col">
            {/* Theme toggle */}
            <div className="absolute top-4 right-4">
                <button onClick={toggleTheme} className="btn-ghost p-2 rounded-lg">
                    {theme === "dark" ? (
                        <i className="fa-solid fa-sun text-yellow-400 text-lg" />
                    ) : (
                        <i className="fa-solid fa-moon text-slate-500 text-lg" />
                    )}
                </button>
            </div>

            <div className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <div className="text-6xl mb-3">📚</div>
                        <h1 className="text-2xl font-bold text-[--color-text]">BookLibrary</h1>
                        <p className="text-[--color-muted] text-sm mt-1">Sua biblioteca pessoal digital</p>
                    </div>

                    {/* Card */}
                    <div className="card p-8">
                        <h2 className="text-xl font-semibold text-[--color-text] mb-6">Entrar na conta</h2>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                                <p className="text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
                                    <i className="fa-solid fa-circle-exclamation" />
                                    {error}
                                </p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="label" htmlFor="email">
                                    E-mail
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className="input"
                                    placeholder="seu@email.com"
                                    value={form.email}
                                    onChange={handleChange}
                                />
                            </div>

                            <div>
                                <label className="label" htmlFor="password">
                                    Senha
                                </label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    className="input"
                                    placeholder="Sua senha"
                                    value={form.password}
                                    onChange={handleChange}
                                />
                            </div>

                            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                                {loading ? (
                                    <>
                                        <i className="fa-solid fa-spinner animate-spin" /> Entrando...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-right-to-bracket" /> Entrar
                                    </>
                                )}
                            </button>
                        </form>

                        <p className="mt-6 text-center text-sm text-[--color-muted]">
                            Não tem conta?{" "}
                            <Link to="/register" className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
                                Criar conta grátis
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="text-center py-4 text-xs text-[--color-muted]">BookLibrary © {new Date().getFullYear()}</footer>
        </div>
    );
}
