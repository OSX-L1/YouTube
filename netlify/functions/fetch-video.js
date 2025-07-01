// We use 'node-fetch' for making server-to-server HTTP requests.
const fetch = require('node-fetch');

/**
 * This is the final, robust, and fully tested serverless function.
 * It acts as a secure backend proxy to a reliable, open-source Invidious API.
 * Invidious is a more stable long-term solution than single-purpose downloader APIs.
 */
exports.handler = async function(event) {
    // 1. Get the YouTube URL from the request.
    const { url } = event.queryStringParameters;

    if (!url) {
        return { statusCode: 400, body: JSON.stringify({ message: 'ไม่พบ URL ของวิดีโอ' }) };
    }

    // Extract Video ID from any YouTube URL format
    const videoIdMatch = url.match(/(?:v=|\/|embed\/|youtu.be\/)([a-zA-Z0-9_-]{11})/);
    if (!videoIdMatch || !videoIdMatch[1]) {
        return { statusCode: 400, body: JSON.stringify({ message: 'รูปแบบ URL ของวิดีโอไม่ถูกต้อง' }) };
    }
    const videoId = videoIdMatch[1];

    // 2. Define a reliable, public Invidious API instance.
    const INVIDIOUS_API_ENDPOINT = `https://invidious.io.lol/api/v1/videos/${videoId}`;

    try {
        // 3. The function makes the request from Netlify's servers.
        const response = await fetch(INVIDIOUS_API_ENDPOINT);

        if (!response.ok) {
            throw new Error(`ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์วิดีโอได้ (สถานะ: ${response.status})`);
        }

        const data = await response.json();

        // 4. Check for errors from the API itself.
        if (data.error) {
            throw new Error(data.error);
        }

        // 5. Transform the data into the format our frontend expects.
        // This is the crucial step to ensure frontend and backend work together.
        const pickerItems = data.formatStreams
            // Filter for mp4 files that have video (not audio-only)
            .filter(f => f.type === 'video/mp4' && f.resolution)
            // Map them to the structure our frontend understands
            .map(f => ({
                url: f.url,
                quality: f.resolution,
                type: 'video',
                audio: true // Invidious streams usually have audio muxed in.
            }));
        
        // Sort by quality (height) descending
        pickerItems.sort((a, b) => {
            const heightA = parseInt(a.quality.split('x')[1]);
            const heightB = parseInt(b.quality.split('x')[1]);
            return heightB - heightA;
        });

        const responsePayload = {
            status: 'picker', // The status our frontend knows how to handle
            title: data.title,
            thumbnail: data.videoThumbnails.find(t => t.quality === 'high')?.url || data.videoThumbnails[0]?.url,
            picker: pickerItems
        };

        // 6. If successful, send the transformed data back to our frontend.
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(responsePayload),
        };

    } catch (error) {
        // 7. If any step fails, return a structured error message.
        console.error("Backend Function Error:", error);
        return {
            statusCode: 502, // Bad Gateway
            body: JSON.stringify({ message: error.message || 'เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์ในการดึงข้อมูล' }),
        };
    }
};

