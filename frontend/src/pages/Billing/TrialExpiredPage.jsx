import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import billingService, { PLAN_FEATURES } from "../../api/billingService";
import PlanCard from "../../components/Billing/PlanCard";

export default function TrialExpiredPage() {
    const navigate = useNavigate();
    const { user, updateToken } = useAuth();
    const { addToast } = useToast();
    const [loadingPlan, setLoadingPlan] = useState(null);

    const currentPlan = user?.plan || "free";

    async function handleSelectPlan(plan) {
        if (plan === "free") return;
        setLoadingPlan(plan);
        try {
            const { data } = await billingService.upgrade(plan);
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
                return;
            }
            if (data.newToken) {
                localStorage.setItem("bl-token", data.newToken);
                if (updateToken) updateToken(data.newToken);
            }
            addToast(data.message || "Plano ativado com sucesso!", "success");
            navigate("/billing");
        } catch (err) {
            addToast(err.response?.data?.error || "Erro ao processar assinatura.", "error");
        } finally {
            setLoadingPlan(null);
        }
    }

    return (
        <div className="space-y-8 max-w-4xl">
            {/* Banner Trial Expirado */}
            <div className="text-center p-8 bg-gradient-to-r from-primary-600/10 to-violet-600/10 border border-primary-200 dark:border-primary-800 rounded-2xl space-y-3">
                <div className="text-4xl">⏰</div>
                <h1 className="text-2xl font-bold text-[--color-text]">Seu Trial Terminou</h1>
                <p className="text-[--color-muted] max-w-md mx-auto">
                    Seu período de teste gratuito chegou ao fim. Escolha um plano para continuar com acesso completo.
                </p>
            </div>

            {/* Cards de plano (sem Free) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                {["premium", "pro"].map((planKey) => (
                    <PlanCard
                        key={planKey}
                        plan={PLAN_FEATURES[planKey]}
                        currentPlan={currentPlan}
                        onSelect={handleSelectPlan}
                        loading={loadingPlan === planKey}
                    />
                ))}
            </div>

            <div className="text-center">
                <Link to="/" className="text-sm text-[--color-muted] hover:text-[--color-text] transition-colors">
                    Continuar com o plano Free (recursos limitados)
                </Link>
            </div>
        </div>
    );
}
