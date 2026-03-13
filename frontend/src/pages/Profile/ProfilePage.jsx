import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import api from "../../api/axios";
import billingService, { PLAN_FEATURES, SUBSCRIPTION_STATUS_LABEL } from "../../api/billingService";

const PLAN_COLORS = {
    free: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    premium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    pro: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    master: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

const STATUS_COLORS = {
    trial: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    active: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    suspended: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    expired: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    past_due: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    incomplete: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

function fmtDate(iso) {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function ProfilePage() {
    const { user, updateUser } = useAuth();

    const [profile, setProfile] = useState({ fullName: "", email: "" });
    const [profileMsg, setProfileMsg] = useState("");
    const [profileErr, setProfileErr] = useState("");
    const [savingP, setSavingP] = useState(false);

    const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
    const [pwMsg, setPwMsg] = useState("");
    const [pwErr, setPwErr] = useState("");
    const [savingPw, setSavingPw] = useState(false);

    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);

    const [subscription, setSubscription] = useState(null);
    const [subLoading, setSubLoading] = useState(true);

    useEffect(() => {
        billingService
            .getPortal()
            .then(({ data }) => setSubscription(data.subscription))
            .catch(() => {})
            .finally(() => setSubLoading(false));
    }, []);

    useEffect(() => {
        if (user) setProfile({ fullName: user.fullName || "", email: user.email || "" });
    }, [user]);

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setProfileMsg("");
        setProfileErr("");
        setSavingP(true);
        try {
            const fd = new FormData();
            fd.append("fullName", profile.fullName);
            if (avatarFile) fd.append("avatarFile", avatarFile);
            const { data } = await api.put("/auth/profile", fd);
            setProfileMsg("Perfil atualizado com sucesso!");
            updateUser(data);
            setAvatarFile(null);
        } catch (err) {
            setProfileErr(err.response?.data?.error || "Erro ao atualizar perfil");
        } finally {
            setSavingP(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setPwMsg("");
        setPwErr("");
        if (pwForm.newPassword !== pwForm.confirm) return setPwErr("As senhas não coincidem");
        if (pwForm.newPassword.length < 6) return setPwErr("Senha precisa ter ao menos 6 caracteres");
        setSavingPw(true);
        try {
            await api.post("/auth/change-password", {
                currentPassword: pwForm.currentPassword,
                newPassword: pwForm.newPassword,
            });
            setPwMsg("Senha alterada com sucesso!");
            setPwForm({ currentPassword: "", newPassword: "", confirm: "" });
        } catch (err) {
            setPwErr(err.response?.data?.error || "Erro ao alterar senha");
        } finally {
            setSavingPw(false);
        }
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
    };

    const avatarSrc = avatarPreview || (user?.avatarPath ? "http://localhost:3001" + user.avatarPath : null);
    const initials = (user?.fullName || "?")
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    return (
        <div className="max-w-xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-[--color-text]">
                <i className="fa-solid fa-user-circle text-primary-600 mr-2" />
                Meu Perfil
            </h1>

            {/* Avatar + plano */}
            <div className="card p-5 flex items-center gap-4">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-300 font-bold text-2xl">
                        {avatarSrc ? <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" /> : initials}
                    </div>
                    <label className="absolute bottom-0 right-0 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-primary-700 transition-colors">
                        <i className="fa-solid fa-pen text-white text-xs" />
                        <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarChange} />
                    </label>
                </div>
                <div>
                    <p className="font-semibold text-[--color-text] text-lg">{user?.fullName}</p>
                    <p className="text-sm text-[--color-muted]">{user?.email}</p>
                    <span className={`mt-1 inline-block text-xs font-semibold px-2 py-0.5 rounded ${PLAN_COLORS[user?.plan] || PLAN_COLORS.free}`}>
                        {PLAN_FEATURES[user?.plan]?.planLabel || user?.plan}
                    </span>
                </div>
            </div>

            {/* Dados pessoais */}
            <div className="card p-5">
                <h2 className="font-semibold text-[--color-text] mb-4">Dados pessoais</h2>
                {profileMsg && <p className="text-sm text-green-600 dark:text-green-400 mb-3">{profileMsg}</p>}
                {profileErr && <p className="text-sm text-red-500 mb-3">{profileErr}</p>}
                <form onSubmit={handleProfileSubmit} className="space-y-3">
                    <div>
                        <label className="label">Nome</label>
                        <input
                            className="input"
                            value={profile.fullName}
                            onChange={(e) => setProfile((f) => ({ ...f, fullName: e.target.value }))}
                            required
                        />
                    </div>
                    <div>
                        <label className="label">E-mail</label>
                        <input className="input bg-slate-50 dark:bg-slate-800" value={profile.email} disabled />
                        <p className="text-xs text-[--color-muted] mt-1">O e-mail não pode ser alterado.</p>
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" disabled={savingP} className="btn-primary">
                            {savingP ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-check" />}
                            Salvar
                        </button>
                    </div>
                </form>
            </div>

            {/* Alterar senha */}
            <div className="card p-5">
                <h2 className="font-semibold text-[--color-text] mb-4">Alterar senha</h2>
                {pwMsg && <p className="text-sm text-green-600 dark:text-green-400 mb-3">{pwMsg}</p>}
                {pwErr && <p className="text-sm text-red-500 mb-3">{pwErr}</p>}
                <form onSubmit={handlePasswordSubmit} className="space-y-3">
                    <div>
                        <label className="label">Senha atual</label>
                        <input
                            type="password"
                            className="input"
                            value={pwForm.currentPassword}
                            onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
                            required
                        />
                    </div>
                    <div>
                        <label className="label">Nova senha</label>
                        <input
                            type="password"
                            className="input"
                            value={pwForm.newPassword}
                            onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                            required
                        />
                    </div>
                    <div>
                        <label className="label">Confirmar nova senha</label>
                        <input
                            type="password"
                            className="input"
                            value={pwForm.confirm}
                            onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                            required
                        />
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" disabled={savingPw} className="btn-primary">
                            {savingPw ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-lock" />}
                            Alterar senha
                        </button>
                    </div>
                </form>
            </div>

            {/* Plano */}
            <div className="card p-5 space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h2 className="font-semibold text-[--color-text]">Plano e assinatura</h2>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${PLAN_COLORS[user?.plan] || PLAN_COLORS.free}`}>
                            {PLAN_FEATURES[user?.plan]?.planLabel || user?.plan?.toUpperCase()}
                        </span>
                        {subscription?.status && (
                            <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[subscription.status] || STATUS_COLORS.incomplete}`}
                            >
                                {SUBSCRIPTION_STATUS_LABEL[subscription.status] || subscription.status}
                            </span>
                        )}
                    </div>
                </div>

                {subLoading ? (
                    <div className="py-4 flex justify-center">
                        <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Preço */}
                        {user?.plan !== "free" && PLAN_FEATURES[user?.plan] && (
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-[--color-text]">
                                    R$ {PLAN_FEATURES[user.plan].monthlyPrice.toFixed(2).replace(".", ",")}
                                </span>
                                <span className="text-sm text-[--color-muted]">/mês</span>
                            </div>
                        )}

                        {/* Uso de livros */}
                        {user?.maxBooks != null && (
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs text-[--color-muted]">
                                    <span>
                                        <i className="fa-solid fa-book mr-1" />
                                        Livros usados
                                    </span>
                                    <span className="font-semibold text-[--color-text]">
                                        {user.booksUsed ?? 0} / {user.maxBooks >= 9999 ? "∞" : user.maxBooks}
                                    </span>
                                </div>
                                {user.maxBooks < 9999 && (
                                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-primary-500 transition-all"
                                            style={{ width: `${Math.min(100, ((user.booksUsed ?? 0) / user.maxBooks) * 100)}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Datas */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            {subscription?.isTrialPeriod && subscription?.trialEnd && (
                                <div className="col-span-2 flex items-center gap-2 p-2.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                                    <i className="fa-solid fa-clock text-violet-500" />
                                    <span className="text-violet-700 dark:text-violet-300">
                                        Trial termina em <strong>{fmtDate(subscription.trialEnd)}</strong>
                                    </span>
                                </div>
                            )}
                            {subscription?.currentPeriodEnd && !subscription?.isTrialPeriod && (
                                <div className="flex items-center gap-1.5 text-[--color-muted]">
                                    <i className="fa-solid fa-calendar text-primary-400" />
                                    <span>
                                        Renova em <strong className="text-[--color-text]">{fmtDate(subscription.currentPeriodEnd)}</strong>
                                    </span>
                                </div>
                            )}
                            {subscription?.cancelAtPeriodEnd && (
                                <div className="col-span-2 flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                                    <i className="fa-solid fa-triangle-exclamation text-red-500" />
                                    <span className="text-red-700 dark:text-red-300">
                                        Cancelamento agendado para <strong>{fmtDate(subscription.currentPeriodEnd)}</strong>
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Funcionalidades incluídas */}
                        {PLAN_FEATURES[user?.plan] && (
                            <div className="space-y-1.5">
                                <p className="text-xs font-semibold text-[--color-muted] uppercase tracking-widest">Incluído no plano</p>
                                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                    {PLAN_FEATURES[user.plan].features.map((f) => (
                                        <li key={f} className="flex items-center gap-2 text-xs text-[--color-text]">
                                            <i className="fa-solid fa-check text-green-500 text-[10px] w-3" />
                                            {f}
                                        </li>
                                    ))}
                                    {PLAN_FEATURES[user.plan].notIncluded.map((f) => (
                                        <li
                                            key={f}
                                            className="flex items-center gap-2 text-xs text-[--color-muted] line-through decoration-slate-400"
                                        >
                                            <i className="fa-solid fa-xmark text-slate-400 text-[10px] w-3" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Ações */}
                        <div className="flex flex-wrap gap-2 pt-1">
                            {user?.plan !== "pro" && user?.plan !== "master" && (
                                <Link to="/billing/upgrade" className="btn-primary text-sm">
                                    <i className="fa-solid fa-arrow-up" /> Upgrade de Plano
                                </Link>
                            )}
                            <Link to="/billing" className="btn-secondary text-sm">
                                <i className="fa-solid fa-credit-card" /> Gerenciar Assinatura
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
