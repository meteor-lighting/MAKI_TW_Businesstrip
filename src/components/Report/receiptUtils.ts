export interface ReceiptAttachment {
    path: string;
    name: string;
}

const RECEIPT_ATTACHMENTS_KEY = '\u6536\u64da\u9644\u4ef6';
const RECEIPT_PATH_KEY = '\u6536\u64da\u8def\u5f91';
const RECEIPT_NAME_KEY = '\u6536\u64da\u540d\u7a31';

export function getReceiptAttachments(item?: Record<string, unknown>): ReceiptAttachment[] {
    const raw = item?.[RECEIPT_ATTACHMENTS_KEY];
    const parsed = Array.isArray(raw)
        ? raw
        : typeof raw === 'string'
            ? (() => {
                try {
                    const value = JSON.parse(raw);
                    return Array.isArray(value) ? value : [];
                } catch {
                    return [];
                }
            })()
            : [];

    const attachments = parsed
        .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const attachment = entry as Record<string, unknown>;
            return {
                path: String(attachment.path || ''),
                name: String(attachment.name || ''),
            };
        })
        .filter((entry): entry is ReceiptAttachment => Boolean(entry?.path));

    if (attachments.length > 0) return attachments;

    const legacyPath = String(item?.[RECEIPT_PATH_KEY] || '');
    return legacyPath
        ? [{ path: legacyPath, name: String(item?.[RECEIPT_NAME_KEY] || '') }]
        : [];
}

export function isPdfReceipt(attachment: ReceiptAttachment) {
    return /\.pdf(?:$|[?#])/i.test(attachment.name || attachment.path);
}
