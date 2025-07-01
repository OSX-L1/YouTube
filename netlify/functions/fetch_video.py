import json
import yt_dlp

def handler(event, context):
    """
    This is the main handler for the Netlify Function, written in Python.
    It directly uses the yt_dlp library to fetch video info.
    """
    try:
        # 1. Get the YouTube URL from the query parameters.
        url = event.get('queryStringParameters', {}).get('url')
        if not url:
            return {
                'statusCode': 400,
                'body': json.dumps({'message': 'ไม่พบ URL ของวิดีโอ'})
            }

        # 2. Set options for yt_dlp to get metadata without downloading.
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'dump_single_json': True,
            'skip_download': True,
        }

        # 3. Run yt_dlp to extract video information.
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            metadata = ydl.extract_info(url, download=False)

        # 4. Transform the metadata into the format our frontend expects.
        picker_items = []
        for f in metadata.get('formats', []):
            if f.get('vcodec') != 'none' and f.get('acodec') != 'none' and f.get('ext') == 'mp4':
                picker_items.append({
                    'url': f.get('url'),
                    'quality': f.get('format_note') or f'{f.get("height")}p',
                    'type': 'video',
                    'audio': True
                })
        
        # Sort by quality and remove duplicates
        unique_qualities = {}
        for item in sorted(picker_items, key=lambda x: int(x['quality'][:-1]), reverse=True):
            if item['quality'] not in unique_qualities:
                unique_qualities[item['quality']] = item
        
        response_payload = {
            'status': 'picker',
            'title': metadata.get('title'),
            'thumbnail': metadata.get('thumbnail'),
            'picker': list(unique_qualities.values())
        }

        # 5. Return a successful response.
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps(response_payload)
        }

    except Exception as e:
        # 6. If any step fails, return a structured error message.
        print(f"Error processing video: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'message': f'เกิดข้อผิดพลาดในการประมวลผลวิดีโอ: {str(e)}'})
        }


