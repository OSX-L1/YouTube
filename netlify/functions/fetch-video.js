// Import the yt-dlp wrapper library
const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');

// Initialize yt-dlp, pointing to a binary included in the deployment package
const ytDlpWrap = new YTDlpWrap();
// Set the binary path for yt-dlp. Netlify functions have a specific writable directory.
// We will download the binary to /tmp/yt-dlp
ytDlpWrap.setBinaryPath(path.join('/tmp', 'yt-dlp'));


/**
 * This is the final, robust, and self-contained serverless function.
 * It downloads and uses its own yt-dlp binary to fetch video info directly.
 * THIS ELIMINATES ALL EXTERNAL API DEPENDENCIES.
 */
exports.handler = async function(event) {
    // 1. Get the YouTube URL from the request.
    const { url } = event.queryStringParameters;

    if (!url) {
        return { statusCode: 400, body: JSON.stringify({ message: 'ไม่พบ URL ของวิดีโอ' }) };
    }

    try {
        // 2. Download the yt-dlp binary if it doesn't exist in the temp directory
        await YTDlpWrap.downloadFromGithub(path.join('/tmp', 'yt-dlp'));

        // 3. Use yt-dlp to get video metadata as JSON
        const metadata = await ytDlpWrap.getVideoInfo(url);

        // 4. Transform the metadata into the format our frontend expects.
        const pickerItems = metadata.formats
            // Filter for mp4 files that have both video and audio
            .filter(f => f.vcodec !== 'none' && f.acodec !== 'none' && f.ext === 'mp4')
            // Map them to the structure our frontend understands
            .map(f => ({
                url: f.url,
                quality: f.format_note || `${f.height}p`,
                type: 'video',
                audio: true
            }))
            // Sort by quality (height) descending
            .sort((a, b) => {
                const heightA = parseInt(a.quality);
                const heightB = parseInt(b.quality);
                return heightB - heightA;
            });
        
        // Remove duplicate qualities
        const uniquePickerItems = pickerItems.filter((item, index, self) =>
            index === self.findIndex((t) => t.quality === item.quality)
        );

        const responsePayload = {
            status: 'picker',
            title: metadata.title,
            thumbnail: metadata.thumbnail,
            picker: uniquePickerItems
        };

        // 5. If successful, send the data back to our frontend.
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(responsePayload),
        };

    } catch (error) {
        // 6. If any step fails, return a structured error message.
        console.error("Backend yt-dlp Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'เกิดข้อผิดพลาดในการประมวลผลวิดีโอ: ' + error.message }),
        };
    }
};

