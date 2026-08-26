import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { getExpenseReceiptUrl } from '../../services/api';
import { isPdfReceipt, ReceiptAttachment } from './receiptUtils';

interface ReceiptPreviewModalProps {
    attachments: ReceiptAttachment[];
    onClose: () => void;
}

export default function ReceiptPreviewModal({ attachments, onClose }: ReceiptPreviewModalProps) {
    const { t } = useTranslation();
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const activeAttachment = attachments[activeIndex];

    useEffect(() => {
        closeButtonRef.current?.focus();
    }, []);

    useEffect(() => {
        if (!activeAttachment) return;

        let cancelled = false;
        setLoading(true);
        setError('');
        setUrl('');

        getExpenseReceiptUrl(activeAttachment.path)
            .then((nextUrl) => {
                if (!cancelled) setUrl(nextUrl);
            })
            .catch((caught) => {
                if (!cancelled) {
                    setError(caught instanceof Error
                        ? caught.message
                        : t('calendar_receipt_preview_error', 'Could not preview this receipt.'));
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [activeAttachment, t]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            } else if (event.key === 'ArrowLeft' && activeIndex > 0) {
                setActiveIndex((current) => current - 1);
            } else if (event.key === 'ArrowRight' && activeIndex < attachments.length - 1) {
                setActiveIndex((current) => current + 1);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [activeIndex, attachments.length, onClose]);

    if (!activeAttachment) return null;

    const hasMultipleAttachments = attachments.length > 1;
    const isPdf = isPdfReceipt(activeAttachment);
    const receiptName = activeAttachment.name || t('calendar_receipt', 'Receipt');

    return createPortal(
        <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 sm:p-8"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="saved-receipt-preview-title"
                className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
                <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            {isPdf ? <FileText className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                        </span>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
                                {t('calendar_receipt_preview', 'Receipt preview')}
                            </p>
                            <h2 id="saved-receipt-preview-title" className="mt-1 truncate text-base font-bold text-slate-950">
                                {receiptName}
                            </h2>
                        </div>
                    </div>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        aria-label={t('close', 'Close')}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                        <X className="h-5 w-5" strokeWidth={1.8} />
                    </button>
                </header>

                <div className="min-h-0 overflow-auto bg-slate-100 p-3 sm:p-6">
                    {loading ? (
                        <div className="flex min-h-[420px] items-center justify-center text-blue-700">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <span className="sr-only">{t('loading', 'Loading')}</span>
                        </div>
                    ) : error ? (
                        <div className="flex min-h-[420px] items-center justify-center rounded-xl bg-red-50 px-5 text-center text-sm font-medium text-red-800">
                            {error}
                        </div>
                    ) : isPdf ? (
                        <iframe
                            src={url}
                            title={receiptName}
                            className="h-[70dvh] min-h-[420px] w-full rounded-xl border border-slate-200 bg-white"
                        />
                    ) : (
                        <img
                            src={url}
                            alt={t('calendar_receipt_preview_alt', 'Receipt preview')}
                            className="mx-auto max-h-[70dvh] max-w-full rounded-xl object-contain shadow-sm"
                        />
                    )}
                </div>

                <footer className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div className="flex items-center gap-2">
                        {hasMultipleAttachments && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}
                                    disabled={activeIndex === 0}
                                    aria-label={t('previous', 'Previous')}
                                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="min-w-16 text-center text-sm font-semibold tabular-nums text-slate-600">
                                    {activeIndex + 1} / {attachments.length}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setActiveIndex((current) => Math.min(attachments.length - 1, current + 1))}
                                    disabled={activeIndex === attachments.length - 1}
                                    aria-label={t('next', 'Next')}
                                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </>
                        )}
                    </div>
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        {url && (
                            <button
                                type="button"
                                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            >
                                <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
                                {t('calendar_open_new_tab', 'Open in new tab')}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="min-h-11 rounded-xl bg-blue-700 px-5 text-sm font-bold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 active:scale-[0.98]"
                        >
                            {t('close', 'Close')}
                        </button>
                    </div>
                </footer>
            </section>
        </div>,
        document.body,
    );
}
