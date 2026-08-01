interface ReportUserIdentity {
    authId?: string | null;
    role?: string | null;
}

export function isReportOwner(ownerId: unknown, authId: unknown): boolean {
    const normalizedOwnerId = String(ownerId || '').trim();
    const normalizedAuthId = String(authId || '').trim();

    return Boolean(normalizedOwnerId && normalizedAuthId && normalizedOwnerId === normalizedAuthId);
}

export function canEditReport(ownerId: unknown, user: ReportUserIdentity | null | undefined): boolean {
    return user?.role === 'admin' || isReportOwner(ownerId, user?.authId);
}
