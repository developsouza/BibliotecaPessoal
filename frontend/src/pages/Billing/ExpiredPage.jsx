import { Link } from "react-router-dom";

export default function ExpiredPage() {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="max-w-md w-full text-center space-y-6 p-6">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto">
                    <i className="fa-solid fa-calendar-xmark text-gray-400 text-3xl" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-[--color-text]">Assinatura Expirada</h1>
                    <p className="text-[--color-muted]">
                        Sua assinatura expirou. Renove agora para continuar aproveitando todos os recursos do BookLibrary.
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <Link
                        to="/billing/upgrade"
                        className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <i className="fa-solid fa-arrow-up" />
                        Renovar Assinatura
                    </Link>
                    <Link to="/" className="text-sm text-[--color-muted] hover:text-[--color-text] transition-colors">
                        Continuar no plano Free
                    </Link>
                </div>
            </div>
        </div>
    );
}
