# API Documentation

This document describes the REST API endpoints provided by video2md.

## Security Notice

⚠️ **Current State**: This API does not implement authentication or rate limiting. All endpoints are publicly accessible.

⚠️ **For Production**: Implement authentication middleware, rate limiting, and input validation before deploying to production. See [SECURITY.md](../SECURITY.md) for details.

## Base URL

- Development: `http://localhost:3000`
- Production: Your deployment URL

## Endpoints

### Video Status

#### GET `/api/video/[videoId]`

Get the processing status and basic information for a YouTube video.

**Parameters**:
- `videoId` (path): YouTube video ID (11 characters, alphanumeric with dashes/underscores)

**Response** (200 OK):
```json
{
  "status": "ready" | "processing" | "not_found",
  "video": {
    "title": "Video Title",
    "channelName": "Channel Name",
    "thumbnail": "https://..."
  } | null
}
```

**Error Responses**:
- `400 Bad Request`: Invalid video ID format
- `500 Internal Server Error`: Database or server error

**Example**:
```bash
curl http://localhost:3000/api/video/dQw4w9WgXcQ
```

**Security Considerations**:
- Video ID validation prevents injection attacks
- No sensitive data exposed
- Public endpoint - consider rate limiting in production

---

### Video Analysis

#### GET `/api/video/[videoId]/analysis`

Stream AI-powered analysis of the video content via Server-Sent Events (SSE).

**Parameters**:
- `videoId` (path): YouTube video ID
- `resume` (query, optional): Resume token for reconnection

**Response**: Server-Sent Events stream

**Event Types**:
- `data`: Analysis chunk (JSON)
- `done`: Analysis complete
- `error`: Error occurred

**Example**:
```bash
curl -N http://localhost:3000/api/video/dQw4w9WgXcQ/analysis
```

**Response Stream**:
```
event: data
data: {"type":"summary","content":"This video..."}

event: data
data: {"type":"key_takeaway","content":"Point 1"}

event: done
data: {"completed":true}
```

**Security Considerations**:
- ⚠️ **Resource Intensive**: Uses OpenAI API credits
- ⚠️ **No Rate Limiting**: Can be abused to drain API quota
- **Production**: Requires authentication and usage limits

---

### Slide Extraction

#### GET `/api/video/[videoId]/slides`

Get slide extraction status and existing slides for a video.

**Parameters**:
- `videoId` (path): YouTube video ID

**Response** (200 OK):
```json
{
  "status": "idle" | "in_progress" | "completed" | "failed",
  "runId": "wfr_xxx" | null,
  "totalSlides": 15,
  "errorMessage": null,
  "slides": [
    {
      "slideNumber": 1,
      "startTime": 0,
      "endTime": 5.2,
      "duration": 5.2,
      "firstFrameImageUrl": "https://...",
      "firstFrameIsDuplicate": false,
      "lastFrameImageUrl": "https://...",
      "lastFrameIsDuplicate": false
    }
  ]
}
```

**Example**:
```bash
curl http://localhost:3000/api/video/dQw4w9WgXcQ/slides
```

**Security Considerations**:
- Read-only endpoint
- Returns public blob storage URLs
- Consider pagination for large slide sets

#### POST `/api/video/[videoId]/slides`

Trigger slide extraction for a video.

**Parameters**:
- `videoId` (path): YouTube video ID

**Response** (200 OK): Server-Sent Events stream with extraction progress

**Error Responses**:
- `409 Conflict`: Extraction already in progress or completed
- `500 Internal Server Error`: Failed to start workflow

**Example**:
```bash
curl -X POST -N http://localhost:3000/api/video/dQw4w9WgXcQ/slides
```

**Security Considerations**:
- ⚠️ **Resource Intensive**: Video processing is CPU/memory intensive
- ⚠️ **External Service**: Calls slides extraction service
- ⚠️ **Storage Costs**: Stores slide images in blob storage
- **Production**: MUST require authentication and rate limiting

---

### Video List

#### GET `/api/videos`

List all videos that have been processed (have transcripts).

**Response** (200 OK):
```json
[
  {
    "videoId": "dQw4w9WgXcQ",
    "videoData": {
      "title": "Video Title",
      "description": "Video description",
      "duration": "3:45",
      "thumbnail": "https://...",
      "channelName": "Channel Name"
    },
    "hasSlides": true,
    "hasAnalysis": true,
    "completedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Example**:
```bash
curl http://localhost:3000/api/videos
```

**Security Considerations**:
- No pagination (returns all videos)
- Consider adding pagination for scalability
- Public data exposure

---

### YouTube URL Validation

#### GET `/api/youtube/validate`

Validate a YouTube URL or video ID.

**Query Parameters**:
- `url` (required): YouTube URL or video ID to validate

**Response** (200 OK):
```json
{
  "valid": true,
  "videoId": "dQw4w9WgXcQ",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Error Response** (400 Bad Request):
```json
{
  "valid": false,
  "error": "Invalid YouTube URL or video ID"
}
```

**Example**:
```bash
curl "http://localhost:3000/api/youtube/validate?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

**Security Considerations**:
- Input validation prevents injection attacks
- Safe for public use
- Consider rate limiting to prevent abuse

---

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "error": "Human-readable error message",
  "context": {
    "additional": "context"
  }
}
```

### Common Status Codes

- `200 OK`: Request successful
- `400 Bad Request`: Invalid input (validation error)
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource state conflict
- `500 Internal Server Error`: Server error

## Server-Sent Events (SSE)

Several endpoints use SSE for streaming responses:

### Connection
```javascript
const eventSource = new EventSource('/api/video/dQw4w9WgXcQ/analysis');

eventSource.addEventListener('data', (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
});

eventSource.addEventListener('done', (event) => {
  console.log('Complete');
  eventSource.close();
});

eventSource.addEventListener('error', (event) => {
  console.error('Error:', event);
  eventSource.close();
});
```

### Resume Support

Some SSE endpoints support resumption:

```javascript
const eventSource = new EventSource(
  '/api/video/dQw4w9WgXcQ/analysis?resume=wfr_xxx'
);
```

## Rate Limiting (Recommended)

For production deployment, implement rate limiting:

```typescript
// Example rate limiting middleware (not implemented)
const rateLimit = {
  GET: {
    '/api/videos': '100 requests per minute',
    '/api/video/[videoId]': '60 requests per minute',
  },
  POST: {
    '/api/video/[videoId]/slides': '5 requests per hour per video',
    '/api/video/[videoId]/analysis': '10 requests per hour per video',
  }
};
```

## Authentication (Recommended)

For production deployment, implement authentication:

```typescript
// Example authentication middleware (not implemented)
// Option 1: API Key
headers: {
  'Authorization': 'Bearer YOUR_API_KEY'
}

// Option 2: Session-based
// Require logged-in user for all POST endpoints
```

## CORS Configuration

Default CORS policy (Next.js defaults):
- Allows all origins in development
- Configure explicitly for production

Production recommendation:
```typescript
// next.config.ts
const config = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'your-frontend.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
        ],
      },
    ];
  },
};
```

## Testing the API

### Using curl

```bash
# Get video status
curl http://localhost:3000/api/video/dQw4w9WgXcQ

# Stream analysis (press Ctrl+C to stop)
curl -N http://localhost:3000/api/video/dQw4w9WgXcQ/analysis

# Trigger slide extraction
curl -X POST -N http://localhost:3000/api/video/dQw4w9WgXcQ/slides

# List all videos
curl http://localhost:3000/api/videos

# Validate YouTube URL
curl "http://localhost:3000/api/youtube/validate?url=dQw4w9WgXcQ"
```

### Using JavaScript/TypeScript

```typescript
// Get video status
const response = await fetch('/api/video/dQw4w9WgXcQ');
const data = await response.json();

// Stream analysis with SSE
const eventSource = new EventSource('/api/video/dQw4w9WgXcQ/analysis');
eventSource.addEventListener('data', (e) => {
  console.log(JSON.parse(e.data));
});

// Trigger slide extraction
const response = await fetch('/api/video/dQw4w9WgXcQ/slides', {
  method: 'POST'
});
```

## Production Deployment Checklist

Before deploying to production:

- [ ] Implement authentication for all POST endpoints
- [ ] Add rate limiting to all endpoints
- [ ] Configure CORS policies
- [ ] Add request validation middleware
- [ ] Set up monitoring and alerting
- [ ] Configure appropriate timeout values
- [ ] Add request logging (without sensitive data)
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Document authentication requirements
- [ ] Test with production-like load

## Additional Resources

- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Vercel Workflows](https://vercel.com/docs/workflow)
- [SECURITY.md](../SECURITY.md) - Security considerations
