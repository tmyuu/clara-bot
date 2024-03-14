import axios from 'axios';

const userName = process.argv[2];

function logMessage(level, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
}

const postData = async () => {
    const formData = new URLSearchParams();
    formData.append('user_name', userName);

    try {
        const response = await axios.post('http://localhost:9000/adduser', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        logMessage('INFO', `Suceed to post userName: ${userName} and response is: ${JSON.stringify(response.data)}`);
    } catch (error) {
        logMessage('ERROR', `Failed to post userName: ${userName}: ${error}`);
    }
};

postData();