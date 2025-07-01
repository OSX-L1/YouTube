const fetch = require('node-fetch');

// This is our serverless function handler
exports.handler = async function(event) {
    // Get the YouTube URL from the request sent by our frontend
    const { url } = event.queryStringParameters;

    if (!url) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'ไม่พบ URL ของวิดีโอ' }),
        };
    }

    const API_ENDPOINT = "https://api.cobalt.tools/api/json";

    try {
        // The function on the server makes the request to the external API
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ url: url }),
        });

        const data = await response.json();

        // The function sends the data back to our frontend
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        };

    } catch (error) {
        console.error("API Fetch Error:", error);
        return {
            statusCode: 502,
            body: JSON.stringify({ message: 'เกิดข้อผิดพลาดในการสื่อสารกับเซิร์ฟเวอร์วิดีโอ' }),
        };
    }
};

