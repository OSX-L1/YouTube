// Import necessary modules from Node.js
const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const fs = require('fs');

// Initialize the yt-dlp wrapper
const ytDlpWrap = new YTDlpWrap();
// Define the path where the binary will be stored in the serverless environment
const ytDlpPath = path.join('/tmp', 'yt-dlp');
ytDlpWrap.setBinaryPath(ytDlpPath);

// A flag to ensure we only check/download the binary once per "warm" function instance.
// This prevents redundant operations and improves performance.
let isBinaryReady = false;

/**
 * This function is the core of the fix. It ensures the yt-dlp binary
 * is downloaded and has the correct permissions BEFORE we try to use it.
 * This prevents the "spawn ETXTBSY" race condition.
 */
async function ensureBinaryIsReady() {
    // If we've already confirmed the binary is ready in this instance, we can skip.
    if (isBinaryReady) {
        return;
    }

    // Check if the binary file already exists in the temporary directory.
    if (!fs.existsSync(ytDlpPath)) {
        console.log('yt-dlp binary not found. Downloading...');
        try {
            // Download the binary from GitHub to the specified path.
            await YTDlpWrap.downloadFromGithub(ytDlpPath);
            console.log('Download complete.');
        } catch (downloadError) {
            console.error("Fatal Error: Failed to download yt-dlp binary.", downloadError);
            // If download fails, we cannot proceed.
            throw new Error("ไม่สามารถดาวน์โหลดเอนจิ้นประมวลผลวิดีโอได้");
        }
    } else {
        console.log('yt-dlp binary already exists.');
    }

    try {
        // CRITICAL STEP: Set the file permissions to make it executable.
        // Lack of this permission can also cause spawn errors.
        fs.chmodSync(ytDlpPath, '755');
        // Set the flag to true so we don't repeat this process on subsequent calls.
        isBinaryReady = true;
        console.log('yt-dlp binary is ready to be used.');
    } catch (permissionError) {
        console.error("Fatal Error: Failed to set permissions for yt-dlp binary.", permissionError);
        throw new Error("ไม่สามารถตั้งค่าเอนจิ้นประมวลผลวิดีโอได้");
    }
}

/**
 * This is the main handler for the Netlify Function.
 */
exports.handler = async function(event) {
    const { url } = event.queryStringParameters;
    if (!url) {
        return { statusCode: 400, body: JSON.stringify({ message: 'ไม่พบ URL ของวิดีโอ' }) };
    }

    try {
        // 1. ALWAYS ensure the binary is ready before doing anything else.
        await ensureBinaryIsReady();

        // 2. Use the now-ready yt-dlp binary to get video metadata.
        const metadata = await ytDlpWrap.getVideoInfo(url);

        // 3. Transform the metadata into the format our frontend expects.
        const pickerItems = metadata.formats
            .filter(f => f.vcodec !== 'none' && f.acodec !== 'none' && f.ext === 'mp4')
            .map(f => ({
                url: f.url,
                quality: f.format_note || `${f.height}p`,
                type: 'video',
                audio: true
            }))
            .sort((a, b) => parseInt(b.quality) - parseInt(a.quality));
        
        const uniquePickerItems = pickerItems.filter((item, index, self) =>
            index === self.findIndex((t) => t.quality === item.quality)
        );

        const responsePayload = {
            status: 'picker',
            title: metadata.title,
            thumbnail: metadata.thumbnail,
            picker: uniquePickerItems
        };

        // 4. If successful, send the data back to our frontend.
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(responsePayload),
        };

    } catch (error) {
        // 5. If any step fails, return a structured and clear error message.
        console.error("Backend yt-dlp Error:", error);
        const errorMessage = error.stderr || error.message || 'เกิดข้อผิดพลาดที่ไม่รู้จัก';
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'เกิดข้อผิดพลาดในการประมวลผลวิดีโอ: ' + errorMessage }),
        };
    }
};

