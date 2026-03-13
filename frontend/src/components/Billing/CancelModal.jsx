import { useState } from "react";

export default function CancelModal({ isOpen, onClose, onConfirm, periodEnd, loading }) {
    const [immediately, setImmediately] = useState(false);

    if (!isOpen) return null;

    const periodEndFormatted = periodEnd ? new Date(periodEnd).toLocaleDateString("pt-BR") : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-[--color-card] border border-[--color-border] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-triangle-exclamation text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-[--color-text]">Cancelar Assinatura</h3>
                        <p className="text-sm text-[--color-muted] mt-0.5">Tem certeza que deseja cancelar sua assinatura?</p>
                    </div>
                </div>

                {/* Opções */}
                <div className="space-y-3">
                    <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-[--color-bg] transition-colors border-[--color-border]">
                        <input type="radio" name="cancel-type" checked={!immediately} onChange={() => setImmediately(false)} className="mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-[--color-text]">
                                Cancelar no fim do período
                                {periodEndFormatted && <span className="text-[--color-muted] font-normal"> ({periodEndFormatted})</span>}
                            </p>
                            <p className="text-xs text-[--color-muted] mt-0.5">Você ainda terá acesso até o fim do período.</p>
                        </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-[--color-bg] transition-colors border-[--color-border]">
                        <input type="radio" name="cancel-type" checked={immediately} onChange={() => setImmediately(true)} className="mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-[--color-text]">Cancelar imediatamente</p>
                            <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">Perda de acesso imediata. Não há reembolso.</p>
                        </div>
                    </label>
                </div>

                {/* Botões */}
                <div className="flex gap-3 pt-1">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 py-2.5 text-sm font-medium border border-[--color-border] text-[--color-text] rounded-lg hover:bg-[--color-bg] transition-colors"
                    >
                        Voltar
                    </button>
                    <button
                        onClick={() => onConfirm(immediately)}
                        disabled={loading}
                        className="flex-1 py-2.5 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-60"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                Cancelando...
                            </span>
                        ) : (
                            "Confirmar Cancelamento"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
