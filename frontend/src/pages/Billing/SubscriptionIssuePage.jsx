import { useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import billingService from "../../api/billingService";

export default function SubscriptionIssuePage() {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);

    async function handleOpenPortal() {
        setLoading(true);
        try {
            const { data } = await billingService.getStripePortalUrl();
            window.location.href = data.portalUrl;
        } catch {
            addToast("Erro ao acessar portal de pagamento.", "error");
            setLoading(false);
        }
    }

    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="max-w-md w-full text-center space-y-6 p-6">
                <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center mx-auto">
                    <i className="fa-solid fa-triangle-exclamation text-orange-500 text-3xl" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-[--color-text]">Problema com o Pagamento</h1>
                    <p className="text-[--color-muted]">
                        Não conseguimos processar seu pagamento. Para manter o acesso, por favor regularize sua assinatura pelo portal de pagamento.
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleOpenPortal}
                        disabled={loading}
                        className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                Aguarde...
                            </>
                        ) : (
                            <>
                                <i className="fa-brands fa-stripe" />
                                Regularizar Pagamento
                            </>
                        )}
                    </button>
                    <Link to="/billing" className="text-sm text-[--color-muted] hover:text-[--color-text] transition-colors">
                        ← Voltar ao Billing
                    </Link>
                </div>
            </div>
        </div>
    );
}
