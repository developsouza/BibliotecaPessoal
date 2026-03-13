import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import billingService from "../../api/billingService";
import SubscriptionCard from "../../components/Billing/SubscriptionCard";
import UpcomingInvoiceCard from "../../components/Billing/UpcomingInvoiceCard";
import PaymentHistoryTable from "../../components/Billing/PaymentHistoryTable";
import CancelModal from "../../components/Billing/CancelModal";

export default function BillingPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { updateToken } = useAuth();
    const { addToast } = useToast();

    const [subscription, setSubscription] = useState(null);
    const [payments, setPayments] = useState([]);
    const [upcomingAmount, setUpcomingAmount] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);

    const checkoutSuccess = searchParams.get("checkoutSuccess") === "true";

    const loadData = useCallback(async (withCheckoutSuccess = false) => {
        setLoading(true);
        try {
            const { data } = await billingService.getPortal(withCheckoutSuccess);
            setSubscription(data.subscription);
            setPayments(data.payments || []);
            setUpcomingAmount(data.upcomingAmount);

            if (withCheckoutSuccess) {
                setSearchParams({}, { replace: true });
                if (data.subscription) {
                    addToast("Assinatura ativada com sucesso! Bem-vindo ao novo plano.", "success");
                }
                // Atualizar token JWT com o novo plano
                if (data.newToken) {
                    updateToken(data.newToken);
                }
            }
        } catch {
            addToast("Erro ao carregar dados de cobrança.", "error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData(checkoutSuccess);
    }, []);

    async function handleManagePayment() {
        setActionLoading(true);
        try {
            const { data } = await billingService.getStripePortalUrl();
            window.location.href = data.portalUrl;
        } catch {
            addToast("Erro ao acessar portal de pagamento.", "error");
            setActionLoading(false);
        }
    }

    async function handleCancel(immediately) {
        setActionLoading(true);
        try {
            const { data } = await billingService.cancel(immediately);
            setSubscription(data.subscription);
            setShowCancelModal(false);
            addToast(data.message, "success");
        } catch {
            addToast("Erro ao cancelar assinatura.", "error");
        } finally {
            setActionLoading(false);
        }
    }

    async function handleReactivate() {
        setActionLoading(true);
        try {
            const { data } = await billingService.reactivate();
            setSubscription(data.subscription);
            addToast(data.message, "success");
        } catch {
            addToast("Erro ao reativar assinatura.", "error");
        } finally {
            setActionLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                {checkoutSuccess && <p className="text-[--color-muted] text-sm animate-pulse">Ativando sua assinatura...</p>}
            </div>
        );
    }

    const hasActiveSubscription = subscription && !["cancelled", "expired", "incomplete"].includes(subscription.status);

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <i className="fa-solid fa-credit-card text-primary-600 text-xl" />
                    <h1 className="text-2xl font-bold text-[--color-text]">Plano &amp; Cobrança</h1>
                </div>
                <Link
                    to="/billing/upgrade"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                >
                    <i className="fa-solid fa-arrow-up" />
                    Ver Planos
                </Link>
            </div>

            {/* Sem assinatura */}
            {!hasActiveSubscription && (
                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm text-blue-700 dark:text-blue-300">
                    <i className="fa-solid fa-circle-info mt-0.5 shrink-0" />
                    <span>
                        Você está no plano <strong>gratuito</strong>.{" "}
                        <Link to="/billing/upgrade" className="underline font-medium hover:text-blue-800 dark:hover:text-blue-200">
                            Assine um plano premium
                        </Link>{" "}
                        para desbloquear mais recursos.
                    </span>
                </div>
            )}

            {/* Alerta: problema de pagamento */}
            {subscription && ["past_due", "suspended"].includes(subscription.status) && (
                <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl text-sm text-orange-700 dark:text-orange-300">
                    <i className="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" />
                    <div>
                        <strong>Problema com o pagamento.</strong>{" "}
                        <button
                            onClick={handleManagePayment}
                            disabled={actionLoading}
                            className="underline font-medium hover:text-orange-800 dark:hover:text-orange-200"
                        >
                            Regularize pelo portal de pagamento
                        </button>{" "}
                        para manter o acesso.
                    </div>
                </div>
            )}

            {/* Subscription + Upcoming */}
            {hasActiveSubscription && (
                <div className="space-y-6">
                    <SubscriptionCard
                        subscription={subscription}
                        onCancel={() => setShowCancelModal(true)}
                        onReactivate={handleReactivate}
                        onManage={handleManagePayment}
                        onUpgrade={() => navigate("/billing/upgrade")}
                    />
                    {upcomingAmount != null && <UpcomingInvoiceCard amount={upcomingAmount} periodEnd={subscription?.currentPeriodEnd} />}
                </div>
            )}

            {/* Histórico de Pagamentos */}
            <PaymentHistoryTable payments={payments} />

            {/* Modal de Cancelamento */}
            <CancelModal
                isOpen={showCancelModal}
                onClose={() => setShowCancelModal(false)}
                onConfirm={handleCancel}
                periodEnd={subscription?.currentPeriodEnd}
                loading={actionLoading}
            />
        </div>
    );
}
