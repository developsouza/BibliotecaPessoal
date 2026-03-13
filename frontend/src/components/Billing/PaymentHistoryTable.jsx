import { PAYMENT_STATUS_LABEL } from "../../api/billingService";

const STATUS_ICON = {
    succeeded: <span className="text-green-600 dark:text-green-400 text-xs font-medium">✅ Pago</span>,
    failed: <span className="text-red-600 dark:text-red-400 text-xs font-medium">❌ Falhou</span>,
    pending: <span className="text-yellow-600 dark:text-yellow-400 text-xs font-medium">⏳ Pendente</span>,
    processing: <span className="text-blue-600 dark:text-blue-400 text-xs font-medium">🔄 Processando</span>,
    cancelled: <span className="text-gray-500 text-xs font-medium">Cancelado</span>,
    refunded: <span className="text-purple-600 dark:text-purple-400 text-xs font-medium">↩️ Reembolsado</span>,
};

function fmt(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("pt-BR");
}

export default function PaymentHistoryTable({ payments }) {
    if (!payments || payments.length === 0) {
        return (
            <div className="bg-[--color-card] border border-[--color-border] rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-[--color-text] mb-4">Histórico de Pagamentos</h2>
                <p className="text-[--color-muted] text-sm text-center py-4">Nenhum pagamento registrado ainda.</p>
            </div>
        );
    }

    return (
        <div className="bg-[--color-card] border border-[--color-border] rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-[--color-text] mb-4">Histórico de Pagamentos</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-[--color-border] text-[--color-muted]">
                            <th className="pb-2 text-left font-medium">Data</th>
                            <th className="pb-2 text-left font-medium">Descrição</th>
                            <th className="pb-2 text-right font-medium">Valor</th>
                            <th className="pb-2 text-center font-medium">Status</th>
                            <th className="pb-2 text-center font-medium">Fatura</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[--color-border]">
                        {payments.map((p) => (
                            <tr key={p.id} className="hover:bg-[--color-bg] transition-colors">
                                <td className="py-3 text-[--color-text]">{fmt(p.paidAt || p.failedAt || p.createdAt)}</td>
                                <td className="py-3 text-[--color-muted] max-w-[200px] truncate">{p.description || "Assinatura BookLibrary"}</td>
                                <td className="py-3 text-right font-semibold text-[--color-text]">
                                    R$ {Number(p.amount).toFixed(2).replace(".", ",")}
                                </td>
                                <td className="py-3 text-center">
                                    {STATUS_ICON[p.status] || (
                                        <span className="text-xs text-[--color-muted]">{PAYMENT_STATUS_LABEL[p.status] || p.status}</span>
                                    )}
                                </td>
                                <td className="py-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        {p.invoicePdfUrl && (
                                            <a
                                                href={p.invoicePdfUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                                                title="Baixar PDF"
                                            >
                                                <i className="fa-solid fa-file-pdf" /> PDF
                                            </a>
                                        )}
                                        {p.invoiceUrl && (
                                            <a
                                                href={p.invoiceUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                                                title="Ver fatura"
                                            >
                                                <i className="fa-solid fa-external-link" /> Ver
                                            </a>
                                        )}
                                        {!p.invoiceUrl && !p.invoicePdfUrl && <span className="text-xs text-[--color-muted]">—</span>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
