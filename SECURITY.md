# Security Policy

## Supported Versions

This project is currently in active development. Security updates will be provided for the latest version on the `main` branch.

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |

## Reporting a Vulnerability

We take the security of video2md seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by emailing the repository maintainer. You can find the maintainer's contact information on their GitHub profile.

Include the following information in your report:
- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability, including how an attacker might exploit it

### What to Expect

- You will receive an acknowledgment of your report within 48 hours
- We will investigate the issue and provide an estimated timeline for a fix
- We will keep you informed of the progress towards resolving the vulnerability
- We will publicly disclose the vulnerability once a fix is available (with credit to you if desired)

## Security Considerations for Deployment

### Environment Variables

Never commit sensitive environment variables to the repository. Use the `.env.example` file as a template and create your own `.env` file locally.

Required environment variables:
- `DATABASE_URL` - Database connection string
- `APIFY_API_TOKEN` - Apify API token for transcript fetching
- `OPENAI_API_KEY` - OpenAI API key for AI analysis
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token
- `SLIDES_API_PASSWORD` - Slides extraction service password

### Authentication and Authorization

⚠️ **Important**: This application currently does not implement user authentication or authorization. All API endpoints are publicly accessible.

**For production deployments:**
1. Implement authentication middleware for all API routes
2. Add rate limiting to prevent abuse
3. Consider implementing API keys or OAuth for API access
4. Add CORS policies appropriate for your deployment
5. Implement input validation and sanitization on all endpoints

### Database Security

- Use strong, unique passwords for database connections
- Restrict database access to only the application server
- Use SSL/TLS for database connections in production
- Regularly backup your database
- Follow the principle of least privilege for database user permissions

### API Security

Current API endpoints that should be protected in production:
- `POST /api/video/[videoId]/slides` - Trigger slide extraction (resource-intensive)
- `POST /api/video/[videoId]/analysis` - Trigger AI analysis (uses API credits)
- All DELETE operations (if any are added)

### Third-Party Services

This application integrates with several third-party services:
- **Apify** - YouTube transcript fetching
- **OpenAI** - AI-powered analysis
- **Vercel Blob** - Image storage for slides
- **Neon/PostgreSQL** - Database

Ensure all API keys and tokens for these services are:
- Stored securely as environment variables
- Never committed to version control
- Rotated regularly
- Restricted to minimum required permissions

### Content Security

- The application processes YouTube video content and transcripts
- User-provided video IDs are validated before processing
- All external URLs are validated before fetching
- Be aware of potential copyright and content ownership issues

## Known Limitations

1. **No Authentication**: API endpoints are publicly accessible
2. **No Rate Limiting**: Endpoints can be called without restriction
3. **No Input Sanitization**: While validation exists, additional sanitization may be needed
4. **Resource Consumption**: Video processing can be resource-intensive

## Security Best Practices

When deploying this application:

1. **Use HTTPS**: Always use HTTPS in production
2. **Secure Headers**: Configure security headers (CSP, HSTS, etc.)
3. **Environment Variables**: Never expose environment variables to the client
4. **Error Messages**: Avoid exposing sensitive information in error messages
5. **Logging**: Be careful not to log sensitive information (API keys, tokens, etc.)
6. **Dependencies**: Regularly update dependencies to patch security vulnerabilities
7. **Monitoring**: Implement monitoring and alerting for suspicious activity

## Responsible Disclosure

We kindly ask security researchers to:
- Allow reasonable time for us to fix vulnerabilities before public disclosure
- Make a good faith effort to avoid privacy violations and data destruction
- Only interact with accounts you own or have explicit permission to access
- Not perform actions that could negatively impact other users

Thank you for helping keep video2md and its users safe!
