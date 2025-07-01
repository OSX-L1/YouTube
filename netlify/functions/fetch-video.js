// We use 'node-fetch' for making server-to-server HTTP requests.
const fetch = require('node-fetch');

/**
 * This is the final, robust serverless function.
 * It acts as a secure backend proxy to the single best public API available.
 * It includes detailed error handling for all known scenarios.
 */
exports.handler = async function(event) {
    // 1. Get the YouTube URL from the request sent by our frontend.
    const { url } = event.queryStringParameters;

    if (!url) {
        return {
            statusCode: 400, // Bad Request
            body: JSON.stringify({ message: 'ไม่พบ URL ของวิดีโอในคำขอ' }),
        };
    }

    // 2. Define the single, industry-standard API endpoint. We commit to this one.
    const API_ENDPOINT = "https://api.cobalt.tools/api/json";

    try {
        // 3. The function makes the request from Netlify's servers.
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ url: url }),
        });

        const data = await response.json();

        // 4. IMPORTANT: We handle all possible statuses from the API.
        // This provides clear feedback to the user instead of a generic error.
        switch (data.status) {
            case 'stream':
            case 'picker':
            case 'success':
                // If successful, send the clean data back to our frontend.
                return {
                    statusCode: 200,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                };
            case 'error':
                // If the API itself reports an error (e.g., video is private).
                throw new Error(data.text || 'API ไม่สามารถประมวลผลวิดีโอนี้ได้ (อาจเป็นวิดีโอส่วนตัวหรือมีข้อจำกัด)');
            case 'redirect':
                throw new Error('ลิงก์นี้เป็นลิงก์สำหรับ перенаправление (redirect) และไม่สามารถใช้งานได้');
            default:
                 // For any other unexpected status.
                throw new Error(`พบสถานะที่ไม่รู้จักจากเซิร์ฟเวอร์: ${data.status}`);
        }

    } catch (error) {
        // 5. If any step in the `try` block fails, this block will run.
        console.error("Backend Function Error:", error);
        return {
            statusCode: 502, // Bad Gateway (indicates an issue with the upstream API)
            body: JSON.stringify({ message: error.message || 'เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์ในการดึงข้อมูล' }),
        };
    }
};

