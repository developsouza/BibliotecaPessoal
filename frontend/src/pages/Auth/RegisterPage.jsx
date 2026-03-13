import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

export default function RegisterPage() {
    const { register } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (form.password !== form.confirmPassword) {
            return setError("As senhas não coincidem.");
        }
        if (form.password.length < 6) {
            return setError("A senha deve ter pelo menos 6 caracteres.");
        }

        setLoading(true);
        try {
            await register(form.email, form.password, form.fullName);
            navigate("/");
        } catch (err) {
            setError(err.response?.data?.error || "Erro ao criar conta. Tente novamente.");
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
                        <p className="text-[--color-muted] text-sm mt-1">Crie sua biblioteca pessoal digital</p>
                    </div>

                    {/* Card */}
                    <div className="card p-8">
                        <h2 className="text-xl font-semibold text-[--color-text] mb-6">Criar conta grátis</h2>

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
                                <label className="label" htmlFor="fullName">
                                    Nome completo
                                </label>
                                <input
                                    id="fullName"
                                    name="fullName"
                                    type="text"
                                    autoComplete="name"
                                    required
                                    className="input"
                                    placeholder="João Silva"
                                    value={form.fullName}
                                    onChange={handleChange}
                                />
                            </div>

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
                                    autoComplete="new-password"
                                    required
                                    className="input"
                                    placeholder="Mínimo 6 caracteres"
                                    value={form.password}
                                    onChange={handleChange}
                                />
                            </div>

                            <div>
                                <label className="label" htmlFor="confirmPassword">
                                    Confirmar senha
                                </label>
                                <input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    className="input"
                                    placeholder="Repita a senha"
                                    value={form.confirmPassword}
                                    onChange={handleChange}
                                />
                            </div>

                            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                                {loading ? (
                                    <>
                                        <i className="fa-solid fa-spinner animate-spin" /> Criando conta...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-user-plus" /> Criar conta
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                                <i className="fa-solid fa-circle-info mt-0.5" />
                                Plano <strong>Free</strong> incluído: até 50 livros, gamificação e empréstimos. Sem cartão de crédito.
                            </p>
                        </div>

                        <p className="mt-5 text-center text-sm text-[--color-muted]">
                            Já tem conta?{" "}
                            <Link to="/login" className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
                                Entrar
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            <footer className="text-center py-4 text-xs text-[--color-muted]">BookLibrary © {new Date().getFullYear()}</footer>
        </div>
    );
}
