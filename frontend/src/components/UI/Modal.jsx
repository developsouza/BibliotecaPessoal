import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function Modal({ isOpen, onClose, title, children, size = "md" }) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const sizeClass =
        {
            sm: "max-w-sm",
            md: "max-w-lg",
            lg: "max-w-2xl",
            xl: "max-w-4xl",
            full: "max-w-full mx-4",
        }[size] || "max-w-lg";

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" />

            {/* Dialog */}
            <div className={`relative w-full ${sizeClass} card shadow-2xl animate-[fadeIn_0.15s_ease-out]`}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[--color-border]">
                    <h2 className="font-semibold text-[--color-text] text-base">{title}</h2>
                    <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg text-[--color-muted] hover:text-[--color-text]">
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
            </div>
        </div>,
        document.body,
    );
}
