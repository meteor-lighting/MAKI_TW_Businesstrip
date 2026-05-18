const API_URL = import.meta.env.VITE_GAS_APP_URL;

export interface ApiResponse<T = any> {
    status: 'success' | 'error';
    message?: string;
    data?: T;
    [key: string]: any;
}

/**
 * Send a POST request to the GAS backend.
 * NOTE: Google Apps Script Web Apps have strict CORS policies.
 * Sending content-type 'text/plain' allows us to skip the OPTIONS preflight in some cases,
 * and we simply parse the JSON string in the backend.
 */
export async function sendRequest<T = any>(action: string, payload: any = {}): Promise<ApiResponse<T>> {
    if (!API_URL) throw new Error('API URL is not defined');

    const body = JSON.stringify({
        action,
        payload
    });

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            // 'text/plain' is used to avoid CORS preflight requests which GAS doesn't handle well
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const json = await response.json();
        if (json.status === 'error') {
            throw new Error(json.message || 'Unknown API error');
        }
        return json;
    } catch (error) {
        console.error(`API Request failed (${action}):`, error);
        throw error;
    }
}

export const getUserReports = async (userId: string, role?: string) => {
    return sendRequest('getUserReports', { userId, role });
};

export const getReport = async (reportId: string, userId?: string) => {
    return sendRequest('getReport', { reportId, userId });
};

export const deleteReport = async (reportId: string, userId: string, role?: string) => {
    return sendRequest('deleteReport', { reportId, userId, role });
};

export const updateReportStatus = async (reportId: string, status: string) => {
    return sendRequest('updateReportStatus', { reportId, status });
};

export const copyReport = async (sourceReportId: string, userId: string) => {
    return sendRequest('copyReport', { sourceReportId, userId });
};

export const copyItems = async (category: string, sourceItems: any[], targetReportId: string, userId: string) => {
    return sendRequest('copyItems', { category, sourceItems, targetReportId, userId });
};

export const updateReportTripInfo = async (reportId: string, days: number | string, startDate: string, endDate: string, destination?: string, paymentCurrency?: string) => {
    return sendRequest('updateReportTripInfo', { reportId, days, startDate, endDate, destination, paymentCurrency });
};

let cachedFlights: any[] | null = null;

export const getAllFlights = async () => {
    if (cachedFlights) return { status: 'success', data: cachedFlights };
    const res = await sendRequest('getAllFlights');
    if (res.status === 'success' && res.data) {
        cachedFlights = res.data;
    }
    return res;
};

export const preloadFlights = () => {
    if (!cachedFlights) {
        getAllFlights().catch(console.error);
    }
};

export const getAllCities = async () => {
    return sendRequest('getAllCities');
};

export const getAllCountries = async () => {
    return sendRequest('getAllCountries');
};

export const getAllMembers = async (role: string) => {
    return sendRequest('getAllMembers', { role });
};

export const updateMemberPermission = async (targetUserId: string, canViewOthers: boolean, canCopyOthers: boolean, role: string) => {
    return sendRequest('updateMemberPermission', { targetUserId, canViewOthers, canCopyOthers, role });
};
