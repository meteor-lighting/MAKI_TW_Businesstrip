const fs = require('fs');

function testParsing() {
    const fileContent = fs.readFileSync('bot_rate_20251230.csv', 'utf8');
    const lines = fileContent.split('\n');

    if (lines.length > 0) {
        // Parse Header to find correct column
        // Header usually Line 0
        let spotSellIdx = -1;
        const headerLine = lines[0].trim();
        const headers = headerLine.split(',');

        console.log('Headers:', headers);

        for (let k = 0; k < headers.length; k++) {
            // Look for "即期" (Spot) and "賣出" (Sell)
            if (headers[k].indexOf('即期') >= 0 && headers[k].indexOf('賣出') >= 0) {
                spotSellIdx = k;
                break;
            }
        }
        console.log('Detected spotSellIdx from header:', spotSellIdx);

        // Fallbacks
        // Index 13 is confirmed to be Spot Selling (即期賣出) in the standard BOT CSV.
        // Logic Check: 
        // Col 11 = "本行賣出", Col 12 = Cash Sell, Col 13 = Spot Sell.
        const candidateIndices = [13];

        for (let j = 1; j < lines.length; j++) {
            const line = lines[j].trim();
            if (!line) continue;

            if (line.includes('USD') && !line.includes('USDT') && !line.includes('AUD')) {
                const cols = line.split(',');
                console.log('USD Row:', cols);

                // Double check if we are in a wide format row where Col 11 is "本行賣出"
                // If so, Col 13 is definitely the target.
                if (cols.length > 13) {
                    if (cols[11].includes('賣出')) {
                        const val = parseFloat(cols[13]);
                        console.log(`Checking Col 13 because Col 11 is '賣出': ${cols[13]} -> ${val}`);
                        if (!isNaN(val) && val > 20) {
                            console.log('RESULT:', val);
                            return;
                        }
                    }
                    // Fallback if structure is slightly different but length is sufficient
                    const val = parseFloat(cols[13]);
                    console.log(`Fallback Checking Col 13: ${cols[13]} -> ${val}`);
                    if (!isNaN(val) && val > 20) {
                        console.log('RESULT:', val);
                        return;
                    }
                }

                // Legacy/Compact support?
                // If compact (Currency, Buy, Sell, SpotBuy, SpotSell), length ~ 6
                if (cols.length > 5 && cols.length < 10) {
                    const val = parseFloat(cols[5]); // Spot Sell often 5 in compact
                    console.log(`Compact Checking Col 5: ${cols[5]} -> ${val}`);
                    if (!isNaN(val) && val > 20) {
                        console.log('RESULT:', val);
                        return;
                    }
                }
            }
        }
    }
}

testParsing();
