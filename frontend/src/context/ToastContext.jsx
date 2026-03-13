import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext();

let nextId = 1;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timers = useRef({});

    const dismiss = useCallback((id) => {
        // Dispara animação de saída
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
        // Remove após animação
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 350);
        clearTimeout(timers.current[id]);
        delete timers.current[id];
    }, []);

    /**
     * addToast(message, type?, duration?)
     * type: 'success' | 'error' | 'warning' | 'info'
     * duration: ms (default 4000, 0 = permanente)
     */
    const addToast = useCallback(
        (message, type = "success", duration = 4000) => {
            const id = nextId++;
            setToasts((prev) => [...prev, { id, message, type, leaving: false }]);
            if (duration > 0) {
                timers.current[id] = setTimeout(() => dismiss(id), duration);
            }
            return id;
        },
        [dismiss],
    );

    return (
        <ToastContext.Provider value={{ addToast, dismiss }}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismiss} />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within ToastProvider");
    return ctx;
}

// ─────────────────────────────────────────
// Componentes internos
// ─────────────────────────────────────────
const ICONS = {
    success: <i className="fa-solid fa-circle-check text-green-500" />,
    error: <i className="fa-solid fa-circle-xmark text-red-500" />,
    warning: <i className="fa-solid fa-triangle-exclamation text-amber-500" />,
    info: <i className="fa-solid fa-circle-info text-blue-500" />,
};

const BORDERS = {
    success: "border-green-400 dark:border-green-600",
    error: "border-red-400 dark:border-red-600",
    warning: "border-amber-400 dark:border-amber-600",
    info: "border-blue-400 dark:border-blue-600",
};

function ToastItem({ toast, onDismiss }) {
    return (
        <div
            className={`
                flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg
                bg-white dark:bg-slate-800 border-l-4 ${BORDERS[toast.type] || BORDERS.info}
                min-w-[260px] max-w-[340px]
                transition-all duration-300 ease-out
                ${toast.leaving ? "opacity-0 translate-x-6" : "opacity-100 translate-x-0"}
            `}
        >
            <span className="text-lg flex-shrink-0 mt-0.5">{ICONS[toast.type] || ICONS.info}</span>
            <p className="text-sm text-[--color-text] leading-snug flex-1">{toast.message}</p>
            <button
                onClick={() => onDismiss(toast.id)}
                className="flex-shrink-0 text-[--color-muted] hover:text-[--color-text] transition-colors mt-0.5"
                aria-label="Fechar"
            >
                <i className="fa-solid fa-xmark text-xs" />
            </button>
        </div>
    );
}

function ToastContainer({ toasts, onDismiss }) {
    if (!toasts.length) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none" aria-live="polite" aria-atomic="false">
            {toasts.map((t) => (
                <div key={t.id} className="pointer-events-auto">
                    <ToastItem toast={t} onDismiss={onDismiss} />
                </div>
            ))}
        </div>
    );
}
