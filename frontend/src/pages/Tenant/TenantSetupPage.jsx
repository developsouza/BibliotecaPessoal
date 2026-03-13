import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

// ─────────────────────────────────────────────
// Passo 0 — Boas-vindas / escolha
// ─────────────────────────────────────────────
function StepChoose({ onChoose }) {
    return (
        <div className="text-center space-y-6">
            <div className="text-6xl">📚</div>
            <div>
                <h1 className="text-3xl font-bold text-[--color-text]">Bem-vindo ao BookLibrary!</h1>
                <p className="text-[--color-muted] mt-2 text-sm max-w-sm mx-auto">
                    Configure sua biblioteca pessoal ou entre em uma organização existente para compartilhar a coleção.
                </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 max-w-lg mx-auto mt-4">
                <button
                    onClick={() => onChoose("configure")}
                    className="card p-6 text-left hover:border-primary-500 border-2 border-transparent transition-all cursor-pointer group"
                >
                    <div className="text-3xl mb-3">🏛️</div>
                    <h3 className="font-bold text-[--color-text] group-hover:text-primary-600 transition-colors">Criar / Configurar</h3>
                    <p className="text-xs text-[--color-muted] mt-1">Personalize o nome da sua organização e configure sua biblioteca.</p>
                </button>
                <button
                    onClick={() => onChoose("join")}
                    className="card p-6 text-left hover:border-primary-500 border-2 border-transparent transition-all cursor-pointer group"
                >
                    <div className="text-3xl mb-3">🤝</div>
                    <h3 className="font-bold text-[--color-text] group-hover:text-primary-600 transition-colors">Entrar em Organização</h3>
                    <p className="text-xs text-[--color-muted] mt-1">Use um código de convite para entrar em uma biblioteca compartilhada.</p>
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Passo 1 — Configurar / renomear organização
// ─────────────────────────────────────────────
function StepConfigure({ setupData, onBack, onSaved }) {
    const [name, setName] = useState(setupData?.tenantName || "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const { addToast } = useToast();
    const { updateUser } = useAuth();

    const handle = async (e) => {
        e.preventDefault();
        if (!name.trim()) return setError("Nome é obrigatório");
        setSaving(true);
        setError("");
        try {
            await api.patch("/tenant/setup", { tenantName: name.trim() });
            updateUser({ tenantName: name.trim() });
            addToast(`Organização "${name.trim()}" configurada com sucesso!`);
            onSaved();
        } catch (err) {
            setError(err.response?.data?.error || "Erro ao salvar");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-md mx-auto space-y-5">
            <button onClick={onBack} className="flex items-center gap-1 text-sm text-[--color-muted] hover:text-[--color-text] transition-colors">
                <i className="fa-solid fa-arrow-left text-xs" /> Voltar
            </button>
            <div>
                <h2 className="text-2xl font-bold text-[--color-text]">Configure sua organização</h2>
                <p className="text-sm text-[--color-muted] mt-1">Dê um nome para identificar sua biblioteca.</p>
            </div>
            <form onSubmit={handle} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-[--color-text] mb-1">Nome da organização</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Biblioteca da Família Silva"
                        className="input w-full"
                        maxLength={80}
                        autoFocus
                    />
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>

                {setupData && (
                    <div className="card p-4 space-y-2 bg-slate-50 dark:bg-slate-800/60">
                        <p className="text-xs font-semibold text-[--color-muted] uppercase tracking-wide">Código de convite</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 font-mono text-lg tracking-widest text-center py-2 px-3 bg-white dark:bg-slate-900 rounded-lg border border-[--color-border] text-primary-600 font-bold">
                                {setupData.inviteCode}
                            </code>
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard?.writeText(setupData.inviteCode);
                                    addToast("Código copiado!", "info", 2000);
                                }}
                                className="btn-secondary text-sm px-3 py-2"
                            >
                                <i className="fa-regular fa-copy" />
                            </button>
                        </div>
                        <p className="text-xs text-[--color-muted]">Compartilhe este código para convidar outras pessoas para sua biblioteca.</p>
                    </div>
                )}

                <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-60">
                    {saving ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Salvando...
                        </span>
                    ) : (
                        "Salvar e continuar"
                    )}
                </button>
            </form>
        </div>
    );
}

// ─────────────────────────────────────────────
// Passo 2 — Entrar em organização via código
// ─────────────────────────────────────────────
function StepJoin({ onBack, onJoined }) {
    const [code, setCode] = useState("");
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState("");
    const { addToast } = useToast();
    const { updateUser } = useAuth();

    const handle = async (e) => {
        e.preventDefault();
        if (!code.trim()) return setError("Código de convite é obrigatório");
        setJoining(true);
        setError("");
        try {
            const { data } = await api.post("/tenant/join", { inviteCode: code.trim() });
            updateUser({ tenantId: data.tenantId, tenantName: data.tenantName, plan: data.plan });
            addToast(data.message || `Você entrou em "${data.tenantName}"!`);
            onJoined(data);
        } catch (err) {
            setError(err.response?.data?.error || "Erro ao entrar na organização");
        } finally {
            setJoining(false);
        }
    };

    return (
        <div className="max-w-md mx-auto space-y-5">
            <button onClick={onBack} className="flex items-center gap-1 text-sm text-[--color-muted] hover:text-[--color-text] transition-colors">
                <i className="fa-solid fa-arrow-left text-xs" /> Voltar
            </button>
            <div>
                <h2 className="text-2xl font-bold text-[--color-text]">Entrar em organização</h2>
                <p className="text-sm text-[--color-muted] mt-1">Insira o código de convite compartilhado pelo proprietário da biblioteca.</p>
            </div>
            <form onSubmit={handle} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-[--color-text] mb-1">Código de convite</label>
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="Ex: AB3X7KQ2"
                        className="input w-full font-mono tracking-widest text-center text-lg uppercase"
                        maxLength={8}
                        autoFocus
                    />
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                    <p className="text-xs text-[--color-muted] mt-2">
                        <i className="fa-solid fa-triangle-exclamation text-amber-500 mr-1" />
                        Ao entrar em uma organização você perde acesso à sua biblioteca atual caso tenha livros cadastrados.
                    </p>
                </div>

                <button type="submit" disabled={joining} className="btn-primary w-full disabled:opacity-60">
                    {joining ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Entrando...
                        </span>
                    ) : (
                        <span>
                            <i className="fa-solid fa-right-to-bracket mr-2" />
                            Entrar na organização
                        </span>
                    )}
                </button>
            </form>
        </div>
    );
}

// ─────────────────────────────────────────────
// Passo final — Sucesso
// ─────────────────────────────────────────────
function StepSuccess({ onFinish }) {
    return (
        <div className="text-center space-y-4 max-w-sm mx-auto">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-bold text-[--color-text]">Tudo pronto!</h2>
            <p className="text-[--color-muted] text-sm">Sua organização está configurada. Comece a adicionar livros à sua biblioteca!</p>
            <button onClick={onFinish} className="btn-primary w-full mt-2">
                <i className="fa-solid fa-rocket mr-2" />
                Ir para o Dashboard
            </button>
        </div>
    );
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────
export default function TenantSetupPage() {
    const [step, setStep] = useState("choose"); // choose | configure | join | success
    const [setupData, setSetupData] = useState(null);
    const [loadingSetup, setLoadingSetup] = useState(true);
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const { addToast } = useToast();

    // Redirecionar se não autenticado
    if (!authLoading && !user) return <Navigate to="/login" replace />;

    useEffect(() => {
        if (!user) return;
        api.get("/tenant/setup")
            .then(({ data }) => setSetupData(data))
            .catch(() => addToast("Erro ao carregar configurações da organização", "error"))
            .finally(() => setLoadingSetup(false));
    }, [user]);

    if (authLoading || loadingSetup) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[--color-bg]">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[--color-bg] flex flex-col">
            {/* Header mínimo */}
            <header className="h-14 border-b border-[--color-border] bg-[--color-surface] flex items-center px-6 gap-3 flex-shrink-0">
                <i className="fa-solid fa-book-open text-primary-600 text-lg" />
                <span className="font-bold text-[--color-text]">BookLibrary</span>
                <span className="ml-auto text-xs text-[--color-muted]">Configuração da organização</span>
            </header>

            <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-2xl">
                    {/* Indicador de etapas */}
                    {step !== "success" && (
                        <div className="flex items-center gap-2 mb-8 justify-center">
                            {["choose", "configure", "join"].map((s, i) => (
                                <div key={s} className="flex items-center gap-2">
                                    <div
                                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                                            step === s
                                                ? "bg-primary-600 text-white"
                                                : i < ["choose", "configure", "join"].indexOf(step)
                                                  ? "bg-green-500 text-white"
                                                  : "bg-slate-200 dark:bg-slate-700 text-[--color-muted]"
                                        }`}
                                    >
                                        {i < ["choose", "configure", "join"].indexOf(step) ? <i className="fa-solid fa-check text-xs" /> : i + 1}
                                    </div>
                                    {i < 2 && <div className="w-8 h-px bg-slate-200 dark:bg-slate-700" />}
                                </div>
                            ))}
                        </div>
                    )}

                    {step === "choose" && <StepChoose onChoose={(choice) => setStep(choice)} />}
                    {step === "configure" && (
                        <StepConfigure setupData={setupData} onBack={() => setStep("choose")} onSaved={() => setStep("success")} />
                    )}
                    {step === "join" && <StepJoin onBack={() => setStep("choose")} onJoined={() => setStep("success")} />}
                    {step === "success" && <StepSuccess onFinish={() => navigate("/")} />}
                </div>
            </div>
        </div>
    );
}
