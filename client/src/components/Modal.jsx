import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, title, subtitle, onClose, children, footer, width }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        document.body.classList.add('no-scroll');
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.classList.remove('no-scroll');
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="modal-overlay" onMouseDown={onClose}>
            <div
                className="modal"
                style={width ? { maxWidth: width } : undefined}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="modal__head">
                    <div>
                        <h3 className="modal__title">{title}</h3>
                        {subtitle && <p className="modal__sub">{subtitle}</p>}
                    </div>
                    <button className="icon-btn" onClick={onClose} aria-label="Close dialog"><X size={17} /></button>
                </div>
                <div className="modal__body">{children}</div>
                {footer && <div className="modal__foot">{footer}</div>}
            </div>
        </div>
    );
}
