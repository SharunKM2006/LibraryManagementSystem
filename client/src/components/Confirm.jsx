import Modal from './Modal.jsx';

export default function Confirm({ open, title, message, confirmLabel = 'Delete', onConfirm, onClose, busy }) {
    return (
        <Modal
            open={open}
            title={title}
            onClose={onClose}
            width={440}
            footer={
                <>
                    <button className="btn btn--ghost" onClick={onClose} disabled={busy}>Cancel</button>
                    <button className="btn btn--danger" onClick={onConfirm} disabled={busy}>
                        {busy ? 'Working…' : confirmLabel}
                    </button>
                </>
            }
        >
            <p className="confirm__msg">{message}</p>
        </Modal>
    );
}
