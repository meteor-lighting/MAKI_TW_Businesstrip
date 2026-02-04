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
