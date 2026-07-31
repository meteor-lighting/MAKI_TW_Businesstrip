import { ReportData, ReportSection, ChartData } from '../types/report';
import { TFunction } from 'i18next';
import { formatTimeHHmm, formatDateYYYYMMDD } from './formatters';

// Define the raw data structure coming from the API (Report.tsx)
export interface RawReportData {
    header: Record<string, any>; // Flexible header from GAS
    items: {
        Flight?: any[];
        Accommodation?: any[];
        'Rental Car'?: any[];
        Taxi?: any[];
        Gas?: any[];
        Parking?: any[];
        Internet?: any[];
        Social?: any[];
        Gift?: any[];
        'Luggage Fee'?: any[];
        HandingFee?: any[];
        PerDiem?: any[];
        'Advance Payment'?: any[];
        'Lunch & Learn'?: any[];
        Others?: any[];
        [key: string]: any[] | undefined;
    };
}

export function transformReportData(raw: RawReportData, reportId: string, userName: string, t: TFunction): ReportData {
    // Helper to safely parse localized currency strings like "$ 1,234.56"
    const safeNum = (val: any) => {
        const str = String(val || 0).replace(/[^\d.-]/g, '');
        const n = Number(str);
        return isNaN(n) ? 0 : n;
    };

    const header = raw.header || {};

    // 解析 header 中所有集中管理的外幣匯率
    const exchangeRates: Record<string, number> = {
        TWD: 1.0
    };
    Object.keys(header).forEach(key => {
        if (key.endsWith('匯率')) {
            const currency = key.replace(/匯率$/, '').toUpperCase();
            const val = safeNum(header[key]);
            if (val > 0) {
                exchangeRates[currency] = val;
            }
        }
    });

    // Preserve imported Google Sheets amounts. Only fill a missing item rate;
    // recalculating TWD values in the browser can change legacy rounded rows.
    Object.keys(raw.items).forEach(cat => {
        const list = raw.items[cat];
        if (Array.isArray(list)) {
            list.forEach((item: any) => {
                const currency = String(item['幣別'] || 'TWD').toUpperCase();
                if (safeNum(item['匯率']) <= 0) item['匯率'] = exchangeRates[currency] || 1;
            });
        }
    });

    // Standardize and normalize columns for Accommodation and Rental Car items to handle dual-header structures seamlessly.
    const normalizeItems = (items: any[] | undefined, category: string) => {
        if (!items) return [];
        return items.map((item: any) => {
            const copy = { ...item };
            
            // 1. TWD 個人金額 / TWD個人 互為備份對齊
            const tPers = copy['TWD個人金額'] !== undefined ? copy['TWD個人金額'] : copy['TWD個人'];
            if (tPers !== undefined) {
                copy['TWD個人金額'] = tPers;
                copy['TWD個人'] = tPers;
            }
            
            // 2. TWD 總體金額 / TWD總額 互為備份對齊
            const tOver = copy['TWD總體金額'] !== undefined ? copy['TWD總體金額'] : copy['TWD總額'];
            if (tOver !== undefined) {
                copy['TWD總體金額'] = tOver;
                copy['TWD總額'] = tOver;
            }

            // 3. 原幣個人金額 / 個人金額 互為備份對齊
            const pers = copy['個人金額'] !== undefined ? copy['個人金額'] : copy['金額'];
            if (pers !== undefined) {
                copy['個人金額'] = pers;
                copy['金額'] = pers;
            }

            // 4. 原幣總體金額 / 總體金額 / 總金額 互為備份對齊
            const over = copy['總體金額'] !== undefined ? copy['總體金額'] : (copy['總金額'] !== undefined ? copy['總金額'] : copy['總體金額']);
            if (over !== undefined) {
                copy['總體金額'] = over;
                copy['總金額'] = over;
            }

            // 5. 每人每天金額自癒計算 (以防後端無寫入或有 0 值)
            let ppd = safeNum(copy['每人每天金額']);
            if (ppd === 0) {
                const checkIn = copy['入住日期'] || copy['借車日期'];
                const checkOut = copy['退房日期'] || copy['還車日期'];
                
                let days = 1;
                if (checkIn && checkOut) {
                    try {
                        const dIn = new Date(checkIn);
                        const dOut = new Date(checkOut);
                        if (!isNaN(dIn.getTime()) && !isNaN(dOut.getTime())) {
                            const diffTime = Math.abs(dOut.getTime() - dIn.getTime());
                            days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
                        }
                    } catch (e) {
                        days = 1;
                    }
                }
                
                if (category === 'Accommodation') {
                    const personalAmount = safeNum(copy['個人金額'] !== undefined ? copy['個人金額'] : (safeNum(copy['總體金額']) - safeNum(copy['代墊金額'] || 0)));
                    ppd = personalAmount / days;
                } else {
                    const people = safeNum(copy['代墊人數'] || 1) || 1;
                    const totalAmount = safeNum(copy['總體金額'] || copy['個人金額'] || 0);
                    ppd = totalAmount / people / days;
                }
                copy['每人每天金額'] = ppd;
            }

            return copy;
        });
    };

    if (raw.items['Accommodation']) {
        raw.items['Accommodation'] = normalizeItems(raw.items['Accommodation'], 'Accommodation');
    }
    if (raw.items['Rental Car']) {
        raw.items['Rental Car'] = normalizeItems(raw.items['Rental Car'], 'Rental Car');
    }

    // 1. Calculate Summary Totals
    const days = Number(header['商旅天數'] || 0);
    const period = `${formatDateYYYYMMDD(header['商旅起始日']).replace(/-/g, '/') || ''} - ${formatDateYYYYMMDD(header['商旅結束日']).replace(/-/g, '/') || ''}`;

    // Aggregating Totals from Categories (for Charts)
    const catTotals: Record<string, number> = {
        Flight: 0,
        Accommodation: 0,
        'Rental Car': 0,
        Transportation: 0,
        Gas: 0,
        Parking: 0,
        Internet: 0,
        Social: 0,
        Gift: 0,
        'Luggage Fee': 0,
        'Handing Fee': 0,
        'Per Diem': 0,
        'Advance Payment': 0,
        'Lunch & Learn': 0,
        Others: 0,
    };

    // Use Header values for Summary Totals as per user request

    // 3. Sections
    const sections: ReportSection[] = [];

    // Helper to create section
    const createSection = (key: string, title: string, columns: any[], id: string, totalOverride?: number, avgType: 'general' | 'per_person_per_day' = 'general') => {
        const items = raw.items[key];
        if (items && items.length > 0) {
            const twdTotalAmount = totalOverride !== undefined ? totalOverride : (catTotals[key] || 0);
            
            // Calculate usdTotalAmount and average amounts
            const rateUSD = safeNum(header['USD匯率'] || 1);
            let usdTotalAmount = 0;
            let avgAmountTwd = 0;
            let avgAmountUsd = 0;
            const count = items.length;

            if (avgType === 'per_person_per_day') {
                // For Accommodation and Rental Car, sum up '每人每天金額'
                let sumPerPersonPerDayTwd = 0;
                let sumPerPersonPerDayUsd = 0;
                items.forEach((item: any) => {
                    const rowRate = safeNum(item['匯率'] || 1);
                    const ppDay = safeNum(item['每人每天金額']);
                    
                    const twdVal = ppDay * rowRate;
                    sumPerPersonPerDayTwd += twdVal;
                    sumPerPersonPerDayUsd += rateUSD > 0 ? twdVal / rateUSD : twdVal;
                });
                avgAmountTwd = count > 0 ? sumPerPersonPerDayTwd / count : 0;
                avgAmountUsd = count > 0 ? sumPerPersonPerDayUsd / count : 0;
                
                usdTotalAmount = rateUSD > 0 ? twdTotalAmount / rateUSD : twdTotalAmount;
            } else {
                // General Average = total / count
                avgAmountTwd = count > 0 ? twdTotalAmount / count : 0;
                usdTotalAmount = rateUSD > 0 ? twdTotalAmount / rateUSD : twdTotalAmount;
                avgAmountUsd = count > 0 ? usdTotalAmount / count : 0;
            }

            sections.push({
                id,
                title,
                total: {
                    amount: twdTotalAmount,
                    currency: 'TWD',
                    displayString: twdTotalAmount.toLocaleString(),
                    twdTotalAmount,
                    usdTotalAmount,
                    avgAmountTwd,
                    avgAmountUsd,
                    count,
                    avgType
                },
                columns,
                data: items
            });
        }
    };

    // Define columns mapping matching Google Sheet Headers
    const flightItems = raw.items['Flight'] || [];
    const flightTotalTWD = flightItems.reduce((sum, item) => sum + Number(item['TWD金額'] || 0), 0);
    catTotals['Flight'] = flightTotalTWD;


    // Mutate and pre-format Flight items so DetailTable renders multiline correctly for round-trips
    const formattedFlightItems = flightItems.map((item: any) => {
        const formatD = (dStr: any) => {
            if (!dStr) return '';
            const d = new Date(dStr);
            return isNaN(d.getTime()) ? String(dStr) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
        };
        const formatT = (tStr: any) => {
            if (!tStr) return '';
            return formatTimeHHmm(tStr);
        };
        const formatCD = (val: any) => {
            if (!val) return '';
            const clean = String(val).replace(/^'/, '').trim();
            if (!clean) return '';
            if (clean === '+1' || clean === '1') return '(+1天)';
            if (clean === '+2' || clean === '2') return '(+2天)';
            if (clean.includes('天')) return `(${clean})`;
            return `(${clean}天)`;
        };

        if (item['行程類型'] === 'round-trip') {
            const c1 = formatCD(item['跨日']) ? ` ${formatCD(item['跨日'])}` : '';
            const c2 = formatCD(item['回程跨日']) ? ` ${formatCD(item['回程跨日'])}` : '';
            return {
                ...item,
                '日期_Formatted': formatD(item['日期']) + '\n' + formatD(item['回程日期']),
                '航班代號_Formatted': `${item['航班代號']}\n${item['回程航班代號'] || ''}`,
                '出發地_Formatted': `${item['出發地']}\n${item['回程出發地'] || ''}`,
                '抵達地_Formatted': `${item['抵達地']}\n${item['回程抵達地'] || ''}`,
                '出發時間_Formatted': formatT(item['出發時間']) + '\n' + formatT(item['回程出發時間']),
                '抵達時間_Formatted': `${formatT(item['抵達時間'])}${c1}\n${formatT(item['回程抵達時間'])}${c2}`,
            };
        }
        
        const c = formatCD(item['跨日']) ? ` ${formatCD(item['跨日'])}` : '';
        return {
            ...item,
            '日期_Formatted': formatD(item['日期']),
            '航班代號_Formatted': item['航班代號'],
            '出發地_Formatted': item['出發地'],
            '抵達地_Formatted': item['抵達地'],
            '出發時間_Formatted': formatT(item['出發時間']),
            '抵達時間_Formatted': `${formatT(item['抵達時間'])}${c}`,
        };
    });

    raw.items['Flight_Display'] = formattedFlightItems;

    createSection('Flight_Display', `${t('flight_details')} (Flight Details)`, [
        { header: t('date'), headerKey: 'date', accessorKey: '日期_Formatted', width: 15 },
        { header: t('flight_code'), headerKey: 'flight_code', accessorKey: '航班代號_Formatted', width: 15 },
        { header: t('departure'), headerKey: 'departure', accessorKey: '出發地_Formatted', width: 10 },
        { header: t('arrival'), headerKey: 'arrival', accessorKey: '抵達地_Formatted', width: 10 },
        { header: t('departure_time'), headerKey: 'departure_time', accessorKey: '出發時間_Formatted', width: 10 },
        { header: t('arrival_time'), headerKey: 'arrival_time', accessorKey: '抵達時間_Formatted', width: 15 },
        { header: t('currency'), headerKey: 'currency', accessorKey: '幣別', width: 10 },
        { header: t('amount'), headerKey: 'amount', accessorKey: '金額', width: 10, type: 'number' },
        { header: t('exchange_rate'), headerKey: 'exchange_rate', accessorKey: '匯率', width: 15 },
        { header: t('twd_amount'), headerKey: 'twd_amount', accessorKey: 'TWD金額', width: 10, type: 'currency' },
        { header: t('remark'), headerKey: 'remark', accessorKey: '備註', width: 20 }
    ], 'flight', flightTotalTWD);

    // Accommodation Sheet Headers: ..., TWD個人金額, TWD代墊金額, 總體金額, TWD總體金額...
    const accommodationItems = raw.items['Accommodation'] || [];
    const accommodationTotalTWD = accommodationItems.reduce((sum, item) => sum + Number(item['TWD總體金額'] || 0), 0);

    // Update catTotals for Accommodation to ensure Charts pick it up
    catTotals['Accommodation'] = accommodationTotalTWD;

    createSection('Accommodation', `${t('accommodation_details')} (Accommodation Details)`, [
        { header: t('check_in_date'), headerKey: 'check_in_date', accessorKey: '入住日期', width: 12, type: 'date' },
        { header: t('check_out_date'), headerKey: 'check_out_date', accessorKey: '退房日期', width: 12, type: 'date' },
        { header: t('region'), headerKey: 'region', accessorKey: '地區', width: 10 },
        { header: t('hotel'), headerKey: 'hotel', accessorKey: '飯店', width: 10 },
        { header: t('currency'), headerKey: 'currency', accessorKey: '幣別', width: 8 },
        { header: t('personal_amount'), headerKey: 'personal_amount', accessorKey: '個人金額', width: 10, type: 'currency' },
        { header: t('overall_amount'), headerKey: 'overall_amount', accessorKey: '總體金額', width: 10, type: 'currency' },
        { header: t('per_person_per_day'), headerKey: 'per_person_per_day', accessorKey: '每人每天金額', width: 12, type: 'currency' },
        { header: t('exchange_rate'), headerKey: 'exchange_rate', accessorKey: '匯率', width: 8 },
        { header: t('twd_personal'), headerKey: 'twd_personal', accessorKey: 'TWD個人金額', width: 12, type: 'currency' },
        { header: t('twd_overall'), headerKey: 'twd_overall', accessorKey: 'TWD總體金額', width: 12, type: 'currency' },
        { header: t('remark'), headerKey: 'remark', accessorKey: '備註', width: 20 }
    ], 'accommodation', accommodationTotalTWD, 'per_person_per_day');

    // Rental Car 
    const rentalCarItems = raw.items['Rental Car'] || [];
    const rentalCarTotalTWD = rentalCarItems.reduce((sum, item) => sum + Number(item['TWD總體金額'] || 0), 0);
    catTotals['Rental Car'] = rentalCarTotalTWD;

    createSection('Rental Car', `${t('rental_car_details')} (Rental Car Details)`, [
        { header: t('rental_start_date'), headerKey: 'rental_start_date', accessorKey: '借車日期', width: 12, type: 'date' },
        { header: t('rental_end_date'), headerKey: 'rental_end_date', accessorKey: '還車日期', width: 12, type: 'date' },
        { header: t('region'), headerKey: 'region', accessorKey: '地區', width: 10 },
        { header: t('rental_company'), headerKey: 'rental_company', accessorKey: '租車公司', width: 10 },
        { header: t('currency'), headerKey: 'currency', accessorKey: '幣別', width: 8 },
        { header: t('personal_amount'), headerKey: 'personal_amount', accessorKey: '個人金額', width: 10, type: 'currency' },
        { header: t('overall_amount'), headerKey: 'overall_amount', accessorKey: '總體金額', width: 10, type: 'currency' },
        { header: t('per_person_per_day'), headerKey: 'per_person_per_day', accessorKey: '每人每天金額', width: 12, type: 'currency' },
        { header: t('exchange_rate'), headerKey: 'exchange_rate', accessorKey: '匯率', width: 8 },
        { header: t('twd_personal'), headerKey: 'twd_personal', accessorKey: 'TWD個人金額', width: 12, type: 'currency' },
        { header: t('twd_overall'), headerKey: 'twd_overall', accessorKey: 'TWD總體金額', width: 12, type: 'currency' },
        { header: t('remark'), headerKey: 'remark', accessorKey: '備註', width: 20 }
    ], 'rentalCar', rentalCarTotalTWD, 'per_person_per_day');

    // Transportation Sheet Headers: ..., 交通工具, 幣別, 金額, TWD金額, 匯率, 備註
    const transportationItems = raw.items['Transportation'] || [];
    const transportationTotalTWD = transportationItems.reduce((sum, item) => sum + Number(item['TWD金額'] || 0), 0);
    catTotals['Transportation'] = transportationTotalTWD;

    createSection('Transportation', `${t('transportation_details')} (Transportation Details)`, [
        { header: t('date'), headerKey: 'date', accessorKey: '日期', width: 15, type: 'date' },
        { header: t('transportation_type', '交通工具'), headerKey: 'transportation_type', accessorKey: '交通工具', width: 15 },
        { header: t('region'), headerKey: 'region', accessorKey: '地區', width: 15 },
        { header: t('currency'), headerKey: 'currency', accessorKey: '幣別', width: 10 },
        { header: t('amount'), headerKey: 'amount', accessorKey: '金額', width: 10, type: 'currency' },
        { header: t('exchange_rate'), headerKey: 'exchange_rate', accessorKey: '匯率', width: 10 },
        { header: t('twd_amount'), headerKey: 'twd_amount', accessorKey: 'TWD金額', width: 10, type: 'currency' },
        { header: t('remark'), headerKey: 'remark', accessorKey: '備註', width: 25 }
    ], 'transportation', transportationTotalTWD);

    // Others - using generic keys
    // Mapping keys to IDs. Backend uses 'Handing Fee' and 'Per Diem' with spaces.
    const otherCats = [
        { key: 'Gas', id: 'gas', title: `${t('gas_details')} (Gas Details)` },
        { key: 'Parking', id: 'parking', title: `${t('parking_details')} (Parking Details)` },
        { key: 'Internet', id: 'internet', title: `${t('internet_details')} (Internet Details)` },
        { key: 'Social', id: 'social', title: `${t('social_details')} (Social Details)` },
        { key: 'Gift', id: 'gift', title: `${t('gift_details')} (Gift Details)` },
        { key: 'Luggage Fee', id: 'luggageFee', title: `${t('luggage_fee_details')} (Luggage Fee Details)` },
        { key: 'Handing Fee', id: 'handingFee', title: `${t('handing_fee_details')} (Handing Fee Details)` },
        { key: 'Advance Payment', id: 'advancePayment', title: `${t('advance_payment_details')} (Advance Payment Details)` },
        { key: 'Lunch & Learn', id: 'lunchLearn', title: `${t('lunch_learn_details')} (Lunch & Learn Details)` },
        { key: 'Others', id: 'others', title: `${t('others_details')} (Others Details)` }
    ];

    otherCats.forEach(cat => {
        const catItems = raw.items[cat.key] || [];
        if (cat.key === 'Parking') {
            catItems.forEach((item: any) => {
                if (!item['日期']) {
                    item['日期'] = item['開始日期'] || item['結束日期'] || '';
                }
            });
        }
        // Assuming 'TWD金額' is the column for total in these sections as per format standardization
        const catTotal = catItems.reduce((sum, item) => sum + Number(item['TWD金額'] || 0), 0);
        catTotals[cat.key] = catTotal;

        let columns: any[] = [];
        if (cat.key === 'Parking') {
            columns = [
                { header: t('date'), headerKey: 'date', accessorKey: '日期', width: 15, type: 'date' },
                { header: t('region'), headerKey: 'region', accessorKey: '地區', width: 15 },
                { header: t('currency'), headerKey: 'currency', accessorKey: '幣別', width: 10 },
                { header: t('amount'), headerKey: 'amount', accessorKey: '金額', width: 10, type: 'currency' },
                { header: t('exchange_rate'), headerKey: 'exchange_rate', accessorKey: '匯率', width: 10 },
                { header: t('twd_amount'), headerKey: 'twd_amount', accessorKey: 'TWD金額', width: 10, type: 'currency' },
                { header: t('remark'), headerKey: 'remark', accessorKey: '備註', width: 25 }
            ];
        } else {
            columns = [
                { header: t('date'), headerKey: 'date', accessorKey: '日期', width: 15, type: 'date' },
                { header: t('region'), headerKey: 'region', accessorKey: '地區', width: 15 },
                { header: t('currency'), headerKey: 'currency', accessorKey: '幣別', width: 10 },
                { header: t('amount'), headerKey: 'amount', accessorKey: '金額', width: 10, type: 'currency' },
                { header: t('exchange_rate'), headerKey: 'exchange_rate', accessorKey: '匯率', width: 10 },
                { header: t('twd_amount'), headerKey: 'twd_amount', accessorKey: 'TWD金額', width: 10, type: 'currency' },
                { header: t('remark'), headerKey: 'remark', accessorKey: '備註', width: 25 }
            ];
        }

        // Add 'Category' column for 'Others'
        if (cat.key === 'Others') {
            columns.unshift({ header: t('category'), headerKey: 'category', accessorKey: '分類', width: 15 });
        } else if (cat.key === 'Lunch & Learn') {
            columns = [
                { header: t('date'), headerKey: 'date', accessorKey: '日期', width: 15, type: 'date' },
                { header: t('region'), headerKey: 'region', accessorKey: '地區', width: 15 },
                { header: t('currency'), headerKey: 'currency', accessorKey: '幣別', width: 10 },
                { header: t('amount'), headerKey: 'amount', accessorKey: '金額', width: 10, type: 'currency' },
                { header: t('exchange_rate'), headerKey: 'exchange_rate', accessorKey: '匯率', width: 10 },
                { header: t('twd_amount'), headerKey: 'twd_amount', accessorKey: 'TWD金額', width: 10, type: 'currency' },
                { header: t('headcount'), headerKey: 'headcount', accessorKey: '人數', width: 10 },
                { header: t('dealer'), headerKey: 'dealer', accessorKey: '經銷商', width: 25 }
            ];
        }

        createSection(cat.key, cat.title, columns, cat.id, catTotal);
    });

    // Custom Per Diem Block
    const perDiemItems = raw.items['Per Diem'] || [];
    const perDiemTotalTWD = perDiemItems.reduce((sum, item) => sum + Number(item['TWD金額'] || 0), 0);
    catTotals['Per Diem'] = perDiemTotalTWD;

    createSection('Per Diem', `${t('per_diem_details')} (Per Diem Details)`, [
        { header: t('start_date'), headerKey: 'start_date', accessorKey: '開始日期', width: 15, type: 'date' },
        { header: t('end_date'), headerKey: 'end_date', accessorKey: '結束日期', width: 15, type: 'date' },
        { header: t('region'), headerKey: 'region', accessorKey: '地區', width: 15 },
        { header: t('currency'), headerKey: 'currency', accessorKey: '幣別', width: 10 },
        { header: t('daily_amount'), headerKey: 'daily_amount', accessorKey: '每日金額', width: 10, type: 'currency' },
        { header: t('total_amount_per_diem'), headerKey: 'total_amount_per_diem', accessorKey: '金額', width: 10, type: 'currency' },
        { header: t('exchange_rate'), headerKey: 'exchange_rate', accessorKey: '匯率', width: 10 },
        { header: t('twd_amount'), headerKey: 'twd_amount', accessorKey: 'TWD金額', width: 10, type: 'currency' },
        { header: t('remark'), headerKey: 'remark', accessorKey: '備註', width: 25 }
    ], 'perDiem', perDiemTotalTWD);

    // End Custom Block

    // Sort sections to match the exact input page sequence
    const desiredOrder = [
        'flight', 'accommodation', 'rentalCar', 'gas', 'parking', 'transportation',
        'internet', 'social', 'gift', 'luggageFee', 'handingFee', 'perDiem',
        'advancePayment', 'others', 'lunchLearn'
    ];
    sections.sort((a, b) => {
        const indexA = desiredOrder.indexOf(a.id);
        const indexB = desiredOrder.indexOf(b.id);
        // If not found in desiredOrder, put them at the end
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    // Build Chart Data
    
    // Build Chart Data

    // 4. Calculate Final Summary Totals with self-healing fallback
    let calcTotalTWD = 0;
    let calcPersonalTWD = 0;
    
    sections.forEach(sec => {
        // Advance Payment is pre-paid advance, not an actual travel expense.
        if (sec.id !== 'advancePayment') {
            calcTotalTWD += sec.total.twdTotalAmount || 0;
            
            if (sec.id === 'accommodation' || sec.id === 'rentalCar') {
                sec.data.forEach((item: any) => {
                    calcPersonalTWD += safeNum(item['TWD個人金額'] || item['TWD個人'] || 0);
                });
            } else {
                calcPersonalTWD += sec.total.twdTotalAmount || 0;
            }
        }
    });

    const rateUSD = safeNum(header['USD匯率'] || 1) || 1;
    const finalTotalTWD = Math.round(safeNum(header['合計TWD總體總額']) || calcTotalTWD);
    const finalPersonalTWD = Math.round(safeNum(header['合計TWD個人總額']) || calcPersonalTWD);
    
    // USD header totals can be stale in imported Google Sheet reports. Derive
    // them from the authoritative TWD totals and the full-precision rate so
    // GAS and Supabase render the same value.
    const finalTotalUSD = rateUSD > 0 ? finalTotalTWD / rateUSD : finalTotalTWD;
    const finalPersonalUSD = rateUSD > 0 ? finalPersonalTWD / rateUSD : finalPersonalTWD;

    const finalAvgDayTWD = Math.round(safeNum(header['合計TWD總體平均']) || (days > 0 ? finalTotalTWD / days : finalTotalTWD));
    const finalAvgDayUSD = days > 0 ? finalTotalUSD / days : finalTotalUSD;

    return {
        reportId,
        user: userName,
        summary: {
            reportName: header['報告名稱'] || '',
            totalTWD: finalTotalTWD,
            personalTWD: finalPersonalTWD,
            avgDayTWD: finalAvgDayTWD,
            totalUSD: finalTotalUSD,
            personalUSD: finalPersonalUSD,
            avgDayUSD: finalAvgDayUSD,
            advancePaymentTWD: Math.round(safeNum(header['預支費用總額'])),
            paymentCurrency: header['支付幣別'] || 'TWD',
            period,
            days,
            rateUSD: rateUSD,
            headerDetails: {
                currency: header['幣別'] || '', 
                personalAmount: header['合計個人此幣別金額'] || header['個人金額'] || '0',
                totalAmount: header['合計總體此幣別金額'] || header['總體金額'] || '0',
                avgDailyAmount: header['平均此幣別金額'] || header['每人每天金額'] || '0',
                rate: header['匯率'] || header['USD匯率'] || '0',
                twdPersonalAmount: String(finalPersonalTWD || 0),
                twdTotalAmount: String(finalTotalTWD || 0)
            }
        },
        charts: {
            // 2. Charts Data (Generated after all totals are finalized)
            pie: Object.entries(catTotals).filter(([k, v]) => v > 0 && k !== 'Advance Payment').map(([k, v]) => ({ name: k, value: v })) as ChartData[],
            bar: Object.entries(catTotals).filter(([k, v]) => v > 0 && k !== 'Advance Payment').map(([k, v]) => ({ name: k, value: v })) as ChartData[]
        },
        sections
    };
}
