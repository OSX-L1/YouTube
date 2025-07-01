// We need to use a library that can make HTTP requests on the server.
// 'node-fetch' is a common choice, but Netlify Functions now support native fetch.
// For compatibility, we'll keep the import.
const fetch = require('node-fetch');

/**
 * This is our serverless function. It acts as a secure backend proxy.
 * It takes a URL from our frontend, calls a public API from the server
 * (bypassing browser CORS issues), and then sends the result back to the frontend.
 */
exports.handler = async function(event) {
    // 1. Get the YouTube URL from the query parameters sent by our frontend.
    const { url } = event.queryStringParameters;

    if (!url) {
        return {
            statusCode: 400, // Bad Request
            body: JSON.stringify({ message: 'ไม่พบ URL ของวิดีโอในคำขอ' }),
        };
    }

    // 2. Define the NEW, currently active API endpoint.
    // This API is based on the popular youtube-dl library.
    const API_ENDPOINT = `https://yt-dlx-api.vercel.app/api/info?url=${encodeURIComponent(url)}`;

    try {
        // 3. The function (running on Netlify's servers) makes the request.
        const response = await fetch(API_ENDPOINT, {
            method: 'GET', // This API uses GET
            headers: {
                'Accept': 'application/json',
            },
        });

        const data = await response.json();

        // 4. Check for errors from the API itself.
        if (data.error) {
            throw new Error(data.message || 'API ไม่สามารถประมวลผลวิดีโอนี้ได้');
        }

        // 5. If successful, send the clean data back to our frontend.
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data), // Forward the API's response
        };

    } catch (error) {
        // 6. If any step fails, return a structured error message.
        console.error("Backend Function Error:", error);
        return {
            statusCode: 502, // Bad Gateway (indicates an issue with the upstream API)
            body: JSON.stringify({ message: error.message || 'เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์ในการดึงข้อมูลวิดีโอ' }),
        };
    }
};

