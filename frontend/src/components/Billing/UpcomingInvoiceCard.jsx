export default function UpcomingInvoiceCard({ amount, periodEnd }) {
    if (amount === null || amount === undefined) return null;

    return (
        <div className="bg-[--color-card] border border-[--color-border] rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-[--color-text] mb-3">Próxima Fatura</h2>
            <p className="text-3xl font-extrabold text-[--color-text]">R$ {Number(amount).toFixed(2).replace(".", ",")}</p>
            {periodEnd && (
                <p className="text-sm text-[--color-muted] mt-1">
                    Vence em <span className="font-medium text-[--color-text]">{new Date(periodEnd).toLocaleDateString("pt-BR")}</span>
                </p>
            )}
        </div>
    );
}
