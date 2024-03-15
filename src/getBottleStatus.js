import http from 'http';

function logMessage(level, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
}

function fetchBottleStatus() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 9000,
            path: '/bottlestatus',
            method: 'GET',
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    resolve(parsedData);
                } catch (error) {
                    logMessage('ERROR', `Error parsing API response: ${error.message}`);
                }
            });
        });

        req.on('error', (error) => {
            logMessage('ERROR', `API request error: ${error.message}`);
        });

        req.end();
    });
}

const intervalId = setInterval(() => {
    fetchBottleStatus().then(data => {
        logMessage('INFO', `API request result: ${JSON.stringify(data)}`);
        if (data.BottleStatus === "false") {
            logMessage('INFO', `Status is false. BottleId: ${data.BottleID}`);
            process.send({ type: 'statusFalse', data });
            clearInterval(intervalId);
            process.exit(0);
        }
    });
}, 5000);