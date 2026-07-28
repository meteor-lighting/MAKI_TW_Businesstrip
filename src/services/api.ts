import { supabase } from '../lib/supabase';
import {
    getExpenseDate,
    getExpenseTime,
    getNextAvailableExpenseTime,
    moveExpenseToSlot,
} from '../components/Report/calendarExpense';

export interface ApiResponse<T = any> {
    status: 'success' | 'error';
    message?: string;
    data?: T;
    [key: string]: any;
}

export interface UploadedExpenseReceipt {
    path: string;
    name: string;
}

async function compressReceiptImage(file: File) {
    if (!file.type.startsWith('image/')) return file;

    try {
        const bitmap = await createImageBitmap(file);
        const maxDimension = 2000;
        const longestSide = Math.max(bitmap.width, bitmap.height);
        const scale = Math.min(1, maxDimension / longestSide);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
            bitmap.close();
            return file;
        }

        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, 'image/jpeg', 0.78);
        });
        if (!blob || blob.size >= file.size) return file;

        const baseName = file.name.replace(/\.[^/.]+$/, '') || 'receipt';
        return new File([blob], `${baseName}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
        });
    } catch {
        // If the browser cannot decode the image, let Dropbox receive the original.
        return file;
    }
}

export async function startDropboxOAuth(): Promise<string> {
    const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
    if (sessionError || !sessionData.session) throw sessionError || new Error('Not signed in');

    const { data, error } = await supabase.functions.invoke('dropbox-oauth-start', {
        body: {},
    });
    if (error) {
        let message = data?.message || error.message;
        const response = (error as { context?: Response }).context;
        if (response) {
            try {
                const body = await response.clone().json() as { message?: string };
                message = body.message || message;
            } catch {
                // Keep the SDK error when the function response is not JSON.
            }
        }
        throw new Error(message);
    }
    if (data?.status !== 'success' || !data.authorizationUrl) {
        throw new Error(data?.message || 'Unable to start Dropbox connection');
    }
    return data.authorizationUrl as string;
}

export async function uploadExpenseReceipt(
    reportId: string,
    file: File,
): Promise<UploadedExpenseReceipt> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw authError || new Error('Not signed in');

    const uploadFile = await compressReceiptImage(file);
    const formData = new FormData();
    formData.append('reportId', reportId);
    formData.append('file', uploadFile, uploadFile.name);
    const { data: dropboxData, error: dropboxError } = await supabase.functions.invoke('dropbox-upload', {
        body: formData,
    });
    if (!dropboxError && dropboxData?.status === 'success' && dropboxData.path) {
        return { path: dropboxData.path as string, name: file.name };
    }
    if (dropboxError) {
        let message = dropboxData?.message || dropboxError.message;
        const response = (dropboxError as { context?: Response }).context;
        if (response) {
            try {
                const body = await response.clone().json() as { message?: string };
                message = body.message || message;
            } catch {
                // Keep the SDK error when the function response is not JSON.
            }
        }
        throw new Error(message);
    }
    throw new Error(dropboxData?.message || 'Unable to upload receipt to Dropbox');
}

export async function deleteExpenseReceipt(path: string) {
    if (!path) return;

    if (!path.startsWith('dropbox:')) {
        const { error } = await supabase.storage.from('expense-receipts').remove([path]);
        if (error) throw error;
        return;
    }

    const { data, error } = await supabase.functions.invoke('dropbox-delete', {
        body: { path },
    });
    if (error) {
        let message = data?.message || error.message;
        const response = (error as { context?: Response }).context;
        if (response) {
            try {
                const body = await response.clone().json() as { message?: string };
                message = body.message || message;
            } catch {
                // Keep the SDK error when the function response is not JSON.
            }
        }
        throw new Error(message);
    }
    if (data?.status !== 'success') {
        throw new Error(data?.message || 'Unable to delete receipt from Dropbox');
    }
}

export async function getExpenseReceiptUrl(path: string) {
    if (path.startsWith('dropbox:')) {
        const { data, error } = await supabase.functions.invoke('dropbox-link', {
            body: { path },
        });
        if (error) throw error;
        if (data?.status !== 'success' || !data.url) throw new Error(data?.message || 'Unable to open Dropbox receipt');
        return data.url as string;
    }

    const { data, error } = await supabase.storage
        .from('expense-receipts')
        .createSignedUrl(path, 60 * 10);
    if (error) throw error;
    return data.signedUrl;
}

export async function openExpenseReceipt(path: string) {
    const url = await getExpenseReceiptUrl(path);
    window.open(url, '_blank', 'noopener,noreferrer');
}

const categoryAliases: Record<string, string> = {
    RentalCar: 'Rental Car',
    LuggageFee: 'Luggage Fee',
    HandingFee: 'Handing Fee',
    PerDiem: 'Per Diem',
    AdvancePayment: 'Advance Payment',
    LunchLearn: 'Lunch & Learn',
};

const allCategories = [
    'Flight', 'Accommodation', 'Rental Car', 'Gas', 'Parking', 'Transportation',
    'Internet', 'Social', 'Gift', 'Luggage Fee', 'Handing Fee', 'Per Diem',
    'Advance Payment', 'Others', 'Lunch & Learn',
];

export async function sendRequest<T = any>(action: string, payload: any = {}): Promise<ApiResponse<T>> {
    try {
        switch (action) {
            case 'signin':
                return await signIn(payload) as ApiResponse<T>;
            case 'signup':
                return await signUp(payload) as ApiResponse<T>;
            case 'forgotPassword':
                return await forgotPassword(payload) as ApiResponse<T>;
            case 'changePassword':
                return await changePassword(payload) as ApiResponse<T>;
            case 'createReport':
                return await createReport() as ApiResponse<T>;
            case 'getReport':
                return await fetchReport(payload.reportId) as ApiResponse<T>;
            case 'getUserReports':
                return await fetchReportList() as ApiResponse<T>;
            case 'queryHistory':
                return await queryHistory(payload) as unknown as ApiResponse<T>;
            case 'deleteReport':
                return await callVoidRpc('delete_report', { target_report_id: payload.reportId }) as ApiResponse<T>;
            case 'updateReportStatus':
                return await callVoidRpc('set_report_status', { target_report_id: payload.reportId, new_status: payload.status || '' }) as ApiResponse<T>;
            case 'updateReportName':
                return await callVoidRpc('update_report_details', {
                    target_report_id: payload.reportId, new_name: payload.reportName ?? '',
                }) as ApiResponse<T>;
            case 'updateReportTripInfo':
                return await updateTripInfo(payload) as ApiResponse<T>;
            case 'updateReportExchangeRate':
                return await updateReportExchangeRateAction(payload) as ApiResponse<T>;
            case 'copyReport':
                return await copyReportAction(payload) as ApiResponse<T>;
            case 'addItem':
            case 'updateItem':
                return await upsertItem(payload, action === 'updateItem') as ApiResponse<T>;
            case 'deleteItem':
                return await deleteItemAction(payload) as ApiResponse<T>;
            case 'copyItems':
                return await copyItemsAction(payload) as ApiResponse<T>;
            case 'searchCity':
                return await searchCity(payload.query) as ApiResponse<T>;
            case 'getAllCities':
                return await readNames('cities') as ApiResponse<T>;
            case 'getAllCountries':
                return await readNames('countries') as ApiResponse<T>;
            case 'getAllFlights':
                return await readFlights() as ApiResponse<T>;
            case 'getAllMembers':
                return await readMembers() as ApiResponse<T>;
            case 'updateMemberPermission':
                return await updateMember(payload) as ApiResponse<T>;
            default:
                throw new Error(`Unknown API action: ${action}`);
        }
    } catch (error) {
        console.error(`Supabase request failed (${action}):`, error);
        if (error instanceof Error) throw error;
        if (error && typeof error === 'object') {
            const details = error as { message?: string; details?: string; hint?: string; code?: string };
            const message = [details.message, details.details, details.hint]
                .filter(Boolean)
                .join(' ');
            if (message) throw new Error(details.code ? `${details.code}: ${message}` : message);
        }
        throw new Error(String(error));
    }
}

async function resolveLogin(identifier: string) {
    const { data, error } = await supabase.rpc('resolve_login', { identifier: identifier.trim() });
    if (error) throw error;
    return data?.[0] as { email: string; must_reset_password: boolean } | undefined;
}

async function signIn({ username, password }: { username: string; password: string }) {
    const login = await resolveLogin(username);
    if (!login) throw new Error('Account not found');
    const { error } = await supabase.auth.signInWithPassword({ email: login.email, password });
    if (error) throw error;
    const user = await loadCurrentUser();
    return { status: 'success' as const, user };
}

async function signUp({ username, password, email }: { username: string; password: string; email: string }) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { employee_code: username, display_name: username } },
    });
    if (error) throw error;
    return { status: 'success' as const, userId: data.user?.id, message: 'Account created. Check your email if confirmation is required.' };
}

async function forgotPassword({ identifier, newPassword }: { identifier: string; newPassword: string }) {
    const { data, error } = await supabase.functions.invoke('password-setup', {
        body: {
            action: 'reset',
            identifier: identifier.trim(),
            password: newPassword,
        },
    });
    if (error) {
        let message = data?.message || error.message;
        const response = (error as { context?: Response }).context;
        if (response) {
            try {
                const body = await response.clone().json() as { message?: string };
                message = body.message || message;
            } catch {
                // Keep the SDK error when the function response is not JSON.
            }
        }
        throw new Error(message);
    }
    if (data?.status !== 'success') throw new Error(data?.message || 'Unable to reset password');
    return { status: 'success' as const, message: data.message as string };
}

async function changePassword({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user?.email) throw userError || new Error('Not signed in');
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: userData.user.email, password: oldPassword });
    if (verifyError) throw new Error('Current password is incorrect');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return { status: 'success' as const, message: 'Password changed successfully.' };
}

export async function loadCurrentUser() {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw authError || new Error('Not signed in');
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('employee_code,display_name,email,role,can_view_others,can_copy_others,must_reset_password')
        .eq('id', authData.user.id)
        .single();
    if (error) throw error;
    return {
        id: profile.employee_code,
        authId: authData.user.id,
        name: profile.display_name,
        email: profile.email,
        role: profile.role,
        canViewOthers: profile.can_view_others,
        canCopyOthers: profile.can_copy_others,
        mustResetPassword: profile.must_reset_password,
    };
}

async function createReport() {
    const usdRate = await fetchExchangeRate('USD', new Date().toISOString().slice(0, 10));
    const { data, error } = await supabase.rpc('create_report', { initial_usd_rate: usdRate });
    if (error) throw error;
    return { status: 'success' as const, reportId: data };
}

async function updateTripInfo(payload: any) {
    const startDate = toDate(payload.startDate);
    const rateDate = startDate ? previousDate(startDate) : new Date().toISOString().slice(0, 10);
    const usdRate = await fetchExchangeRate('USD', rateDate);
    return callVoidRpc('update_report_details', {
        target_report_id: payload.reportId,
        new_days: payload.days === '' ? null : Number(payload.days),
        new_start: startDate,
        new_end: toDate(payload.endDate),
        new_destination: payload.destination ?? '',
        new_currency: payload.paymentCurrency || 'TWD',
        new_usd_rate: usdRate,
    });
}

async function fetchReport(reportId: string) {
    const [{ data: report, error: reportError }, { data: items, error: itemError }] = await Promise.all([
        supabase.from('reports').select('*').eq('id', reportId).single(),
        supabase.from('expense_items').select('id,category,sequence,data').eq('report_id', reportId).order('sequence'),
    ]);
    if (reportError) throw reportError;
    if (itemError) throw itemError;
    const grouped = Object.fromEntries(allCategories.map((category) => [category, [] as any[]]));
    for (const item of items || []) {
        (grouped[item.category] ||= []).push({ ...item.data, 次序: item.sequence, 報告編號: reportId, _id: item.id });
    }
    return { status: 'success' as const, data: { header: reportHeader(report), items: grouped } };
}

async function fetchReportList() {
    const { data, error } = await supabase.from('report_summaries').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return {
        status: 'success' as const,
        data: (data || []).map((row: any) => {
            const totalAmount = Number(row.total_twd || 0);
            const rate = Number(row.usd_rate || 1);
            const totalUSDAmount = rate > 0 ? totalAmount / rate : totalAmount;
            return {
                reportId: row.id,
                userId: row.employee_code,
                userName: row.display_name,
                days: row.days,
                startDate: row.start_date,
                endDate: row.end_date,
                status: row.status,
                createdAt: row.created_at,
                reportName: row.report_name,
                paymentCurrency: row.payment_currency,
                totalAmount,
                advanceAmount: Number(row.advance_twd || 0),
                // Do not trust a stale stored total_usd value from an import.
                totalUSDAmount,
                rate,
            };
        }),
    };
}

async function queryHistory(payload: any) {
    const { data: reports, error: reportError } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
    if (reportError) throw reportError;
    const filteredReports = (reports || []).filter((report: any) => {
        const header = reportHeader(report);
        return includes(header['用戶編號'], payload.employeeId)
            && includes(header['報告名稱'], payload.reportName)
            && includes(header['出差國家'], payload.destination);
    });
    if (!payload.category || payload.category === 'All') {
        return { status: 'success' as const, type: 'reports', data: filteredReports.map(reportHeader) };
    }
    const reportMap = new Map(filteredReports.map((report: any) => [report.id, reportHeader(report)]));
    const { data: items, error } = await supabase
        .from('expense_items')
        .select('id,report_id,category,sequence,data')
        .eq('category', normalizeCategory(payload.category))
        .order('report_id')
        .order('sequence');
    if (error) throw error;
    const result = (items || []).filter((item: any) => {
        if (!reportMap.has(item.report_id)) return false;
        const row = item.data || {};
        if (payload.category === 'Flight') {
            return includes(row['出發地'], payload.flightDeparture)
                && includes(row['抵達地'], payload.flightArrival)
                && includes(row['幣別'], payload.flightCurrency);
        }
        if (payload.category === 'Accommodation') return includes(row['幣別'], payload.accommodationCurrency);
        return true;
    }).map((item: any) => {
        const header = reportMap.get(item.report_id)!;
        return {
            ...item.data,
            次序: item.sequence,
            報告編號: item.report_id,
            _id: item.id,
            _報告名稱: header['報告名稱'],
            _員工編號: header['用戶編號'],
            _員工姓名: header['員工姓名'],
        };
    });
    return { status: 'success' as const, type: 'items', data: result };
}

async function copyReportAction(payload: any) {
    const { data, error } = await supabase.rpc('copy_report', { source_report_id: payload.sourceReportId });
    if (error) throw error;
    return { status: 'success' as const, reportId: data };
}

async function upsertItem(payload: any, updating: boolean) {
    const category = normalizeCategory(payload.category);
    const shouldInitializeTrip = category === 'Flight'
        && !updating
        && await isFirstFlight(payload.reportId);
    const calendarItemData = await addDefaultCalendarPlacement(
        payload.reportId,
        category,
        { ...(payload.itemData || {}) },
        updating,
        payload.sequence,
    );
    const data = await addCalculatedAmounts(category, calendarItemData, payload.reportId);
    const { error } = await supabase.rpc('upsert_expense_item', {
        target_report_id: payload.reportId,
        target_category: category,
        target_sequence: updating ? Number(payload.sequence) : null,
        item_data: data,
    });
    if (error) throw error;
    if (shouldInitializeTrip) {
        await initializeTripFromFirstFlight(payload.reportId, data);
    }
    return { status: 'success' as const, message: updating ? 'Item updated successfully' : 'Item added successfully' };
}

async function deleteItemAction(payload: any) {
    const category = normalizeCategory(payload.category);
    const sequence = Number(payload.sequence);
    const { data: item, error: lookupError } = await supabase
        .from('expense_items')
        .select('data')
        .eq('report_id', payload.reportId)
        .eq('category', category)
        .eq('sequence', sequence)
        .maybeSingle();
    if (lookupError) throw lookupError;

    const receiptPaths = getReceiptPaths(item?.data);
    await Promise.all(receiptPaths.map((path) => deleteExpenseReceipt(path)));

    return callVoidRpc('delete_expense_item', {
        target_report_id: payload.reportId,
        target_category: category,
        target_sequence: sequence,
    });
}

function getReceiptPaths(itemData: Record<string, any> | null | undefined) {
    const rawAttachments = itemData?.['收據附件'];
    const attachments = Array.isArray(rawAttachments)
        ? rawAttachments
        : typeof rawAttachments === 'string'
            ? parseReceiptAttachments(rawAttachments)
            : [];
    const paths = attachments
        .map((attachment: any) => String(attachment?.path || ''))
        .filter(Boolean);
    const legacyPath = String(itemData?.['收據路徑'] || '');
    return Array.from(new Set(paths.length > 0 ? paths : legacyPath ? [legacyPath] : []));
}

function parseReceiptAttachments(value: string) {
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function updateReportExchangeRateAction(payload: any) {
    const currency = String(payload.currency || 'USD').trim().toUpperCase();
    const rate = Number(payload.rate);
    if (!/^[A-Z]{3}$/.test(currency) || currency === 'TWD') {
        throw new Error('Only non-TWD currency rates can be edited');
    }
    if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error('Exchange rate must be greater than zero');
    }
    return callVoidRpc('update_report_exchange_rate', {
        target_report_id: payload.reportId,
        target_currency: currency,
        new_rate: rate,
    });
}

async function isFirstFlight(reportId: string) {
    const { data, error } = await supabase
        .from('expense_items')
        .select('id')
        .eq('report_id', reportId)
        .eq('category', 'Flight')
        .limit(1);
    if (error) throw error;
    return (data || []).length === 0;
}

async function initializeTripFromFirstFlight(reportId: string, flight: Record<string, any>) {
    const startDate = String(flight['日期'] || '');
    if (!startDate) return;

    const endDate = flight['行程類型'] === 'round-trip'
        ? String(flight['回程日期'] || startDate)
        : startDate;
    const start = new Date(`${startDate}T12:00:00`);
    const end = new Date(`${endDate}T12:00:00`);
    const days = Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
        ? 1
        : Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);

    await updateTripInfo({
        reportId,
        days,
        startDate,
        endDate,
        destination: String(flight['抵達地'] || ''),
        paymentCurrency: String(flight['幣別'] || 'TWD'),
    });
}

async function addDefaultCalendarPlacement(
    reportId: string,
    category: string,
    itemData: Record<string, any>,
    updating: boolean,
    sequence?: number,
) {
    const date = getExpenseDate(category, itemData);
    if (!date || getExpenseTime(itemData)) return itemData;

    const { data: existingItems, error } = await supabase
        .from('expense_items')
        .select('category,sequence,data')
        .eq('report_id', reportId);
    if (error) throw error;

    const occupiedTimes = (existingItems || [])
        .filter((existing: any) => {
            const isCurrentItem = updating
                && existing.category === category
                && Number(existing.sequence) === Number(sequence);
            return !isCurrentItem
                && getExpenseDate(existing.category, existing.data || {}) === date;
        })
        .map((existing: any) => getExpenseTime(existing.data || {}))
        .filter(Boolean);

    return moveExpenseToSlot(
        category,
        itemData,
        date,
        getNextAvailableExpenseTime(occupiedTimes),
    );
}

async function copyItemsAction(payload: any) {
    const ids = (payload.sourceItems || []).map((item: any) => item._id).filter(Boolean);
    if (!ids.length) throw new Error('The selected items do not have database IDs. Refresh the search and try again.');
    const { data, error } = await supabase.rpc('copy_items', { target_report_id: payload.targetReportId, source_item_ids: ids });
    if (error) throw error;
    return { status: 'success' as const, message: `${data} item(s) copied`, targetReportId: payload.targetReportId };
}

async function addCalculatedAmounts(category: string, data: Record<string, any>, reportId: string) {
    const currency = String(data['幣別'] || 'TWD').toUpperCase();
    const rateDate = itemRateDate(category, data);
    let rate = Number(data['匯率'] || 0);
    if (currency === 'TWD') rate = 1;
    else {
        const { data: report, error } = await supabase
            .from('reports')
            .select('data')
            .eq('id', reportId)
            .single();
        if (error) throw error;
        const reportRate = numeric(report?.data?.[`${currency}匯率`]);
        rate = reportRate > 0 ? reportRate : await fetchExchangeRate(currency, rateDate);
    }
    data['匯率'] = rate;
    if (category === 'Accommodation' || category === 'Rental Car') {
        const personal = numeric(data['個人金額']);
        const advance = numeric(data['代墊金額']);
        const overall = numeric(data['總體金額']) || personal + advance;
        data['總體金額'] = overall;
        data['TWD個人金額'] = Math.round(personal * rate);
        data['TWD代墊金額'] = Math.round(advance * rate);
        data['TWD總體金額'] = Math.round(overall * rate);
        const start = data[category === 'Accommodation' ? '入住日期' : '借車日期'];
        const end = data[category === 'Accommodation' ? '退房日期' : '還車日期'];
        const days = dateDifference(start, end);
        data['每人每天金額'] = category === 'Accommodation'
            ? round2(personal / days)
            : round2(overall / Math.max(1, numeric(data['代墊人數']) || 1) / days);
    } else {
        data['TWD金額'] = Math.round(numeric(data['金額']) * rate);
    }
    data['報告編號'] = reportId;
    return data;
}

async function fetchExchangeRate(currency: string, date: string) {
    const { data: result, error } = await supabase.functions.invoke('exchange-rate', {
        body: { currency, date },
    });
    if (error || result?.status !== 'success') {
        throw error || new Error(result?.message || `Unable to retrieve ${currency} exchange rate`);
    }
    const rate = Number(result.rate);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error(`Invalid ${currency} exchange rate`);
    return rate;
}

async function searchCity(query: string) {
    const { data, error } = await supabase.from('cities').select('name').ilike('name', `%${escapeLike(query || '')}%`).limit(10);
    if (error) throw error;
    return { status: 'success' as const, data: data || [] };
}

async function readNames(table: 'cities' | 'countries') {
    const { data, error } = await supabase.from(table).select('name').order('name');
    if (error) throw error;
    return { status: 'success' as const, data: (data || []).map((row) => row.name) };
}

async function readFlights() {
    const rows: any[] = [];
    for (let start = 0; ; start += 1000) {
        const { data, error } = await supabase.from('flight_schedules').select('*').range(start, start + 999);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 1000) break;
    }
    return {
        status: 'success' as const,
        data: rows.map((row) => ({
            FlightNumber: row.flight_number,
            Week: row.week,
            DepartureAirportID: row.departure_airport_id,
            ArrivalAirportID: row.arrival_airport_id,
            DepartureTime: row.departure_time,
            ArrivalTime: row.arrival_time,
            CrossDay: row.cross_day,
        })),
    };
}

async function readMembers() {
    const { data, error } = await supabase.from('profiles').select('*').order('employee_code');
    if (error) throw error;
    return {
        status: 'success' as const,
        data: (data || []).map((row) => ({
            id: row.employee_code,
            authId: row.id,
            name: row.display_name,
            email: row.email,
            role: row.role,
            canViewOthers: row.can_view_others,
            canCopyOthers: row.can_copy_others,
            mustResetPassword: row.must_reset_password,
        })),
    };
}

async function updateMember(payload: any) {
    const { data: target, error: lookupError } = await supabase
        .from('profiles').select('id').eq('employee_code', payload.targetUserId).single();
    if (lookupError) throw lookupError;
    const { error } = await supabase.from('profiles').update({
        can_view_others: Boolean(payload.canViewOthers),
        can_copy_others: Boolean(payload.canCopyOthers),
    }).eq('id', target.id);
    if (error) throw error;
    return { status: 'success' as const };
}

async function callVoidRpc(name: string, args: Record<string, any>) {
    const { error } = await supabase.rpc(name, args);
    if (error) throw error;
    return { status: 'success' as const };
}

function reportHeader(report: any) {
    const data = { ...(report.data || {}) };
    const rate = numeric(data['USD匯率']) || 1;
    const totalTwd = numeric(data['合計TWD總體總額']);
    const personalTwd = numeric(data['合計TWD個人總額']);
    const days = numeric(report.days ?? data['商旅天數']);

    // Imported reports can contain stale USD header totals. Keep the TWD
    // totals as the source of truth and derive every USD header value here.
    data['合計USD總體總額'] = rate > 0 ? totalTwd / rate : totalTwd;
    data['合計USD個人總額'] = rate > 0 ? personalTwd / rate : personalTwd;
    data['合計USD總體平均'] = days > 0 ? data['合計USD總體總額'] / days : data['合計USD總體總額'];
    data['合計USD個人平均'] = days > 0 ? data['合計USD個人總額'] / days : data['合計USD個人總額'];

    return {
        ...data,
        報告編號: report.id,
        報告名稱: report.report_name,
        狀態: report.status,
        商旅天數: report.days,
        商旅起始日: report.start_date || report.data?.['商旅起始日'] || '',
        商旅結束日: report.end_date || report.data?.['商旅結束日'] || '',
        出差國家: report.destination,
        支付幣別: report.payment_currency,
        建立時間: report.created_at,
    };
}

function normalizeCategory(category: string) {
    return categoryAliases[category] || category;
}

function includes(value: unknown, query: unknown) {
    const needle = String(query || '').trim().toLowerCase();
    return !needle || String(value || '').toLowerCase().includes(needle);
}

function numeric(value: unknown) {
    const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

function itemRateDate(category: string, data: Record<string, any>) {
    const raw = data[category === 'Accommodation' ? '入住日期'
        : category === 'Rental Car' ? '借車日期'
            : category === 'Per Diem' || category === 'Parking' ? '開始日期'
                : '日期'];
    const parsed = raw ? new Date(raw) : new Date();
    if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
    parsed.setDate(parsed.getDate() - 1);
    return parsed.toISOString().slice(0, 10);
}

function dateDifference(start: unknown, end: unknown) {
    const first = new Date(String(start || ''));
    const last = new Date(String(end || ''));
    if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return 1;
    return Math.max(1, Math.ceil(Math.abs(last.getTime() - first.getTime()) / 86_400_000));
}

function round2(value: number) {
    return Math.round(value * 100) / 100;
}

function toDate(value: unknown) {
    if (!value) return null;
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function previousDate(value: string) {
    const parsed = new Date(`${value}T12:00:00`);
    parsed.setDate(parsed.getDate() - 1);
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function escapeLike(value: string) {
    return value.replace(/[%_]/g, '\\$&');
}

export const getUserReports = async (_userId: string, _role?: string) => sendRequest('getUserReports');
export const getReport = async (reportId: string, _userId?: string) => sendRequest('getReport', { reportId });
export const deleteReport = async (reportId: string, _userId: string, _role?: string) => sendRequest('deleteReport', { reportId });
export const updateReportStatus = async (reportId: string, status: string) => sendRequest('updateReportStatus', { reportId, status });
export const copyReport = async (sourceReportId: string, _userId: string) => sendRequest('copyReport', { sourceReportId });
export const copyItems = async (category: string, sourceItems: any[], targetReportId: string, _userId: string) =>
    sendRequest('copyItems', { category, sourceItems, targetReportId });
export const updateReportTripInfo = async (
    reportId: string, days: number | string, startDate: string, endDate: string,
    destination?: string, paymentCurrency?: string,
) => sendRequest('updateReportTripInfo', { reportId, days, startDate, endDate, destination, paymentCurrency });
export const updateReportExchangeRate = async (reportId: string, currency: string, rate: number) =>
    sendRequest('updateReportExchangeRate', { reportId, currency, rate });

let cachedFlights: any[] | null = null;
export const getAllFlights = async () => {
    if (cachedFlights) return { status: 'success' as const, data: cachedFlights };
    const response = await sendRequest<any[]>('getAllFlights');
    if (response.data) cachedFlights = response.data;
    return response;
};
export const preloadFlights = () => {
    if (!cachedFlights) getAllFlights().catch(console.error);
};
export const getAllCities = async () => sendRequest<string[]>('getAllCities');
export const getAllCountries = async () => sendRequest<string[]>('getAllCountries');
export const getAllMembers = async (_role: string) => sendRequest('getAllMembers');
export const updateMemberPermission = async (
    targetUserId: string, canViewOthers: boolean, canCopyOthers: boolean, _role: string,
) => sendRequest('updateMemberPermission', { targetUserId, canViewOthers, canCopyOthers });
