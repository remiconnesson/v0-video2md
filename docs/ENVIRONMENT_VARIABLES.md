# Environment Variables Configuration

This document provides detailed information about all environment variables used in video2md.

## Required Variables

### DATABASE_URL

**Required for**: All database operations  
**Type**: PostgreSQL connection string  
**Format**: `postgresql://username:password@host:port/database`

Example:
```
DATABASE_URL=postgresql://user:password@localhost:5432/video2md
```

For Neon (recommended):
```
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/video2md?sslmode=require
```

**Security Notes**:
- Never commit this value to version control
- Use SSL mode for production (`?sslmode=require`)
- Rotate credentials regularly
- Use read-only credentials where possible

### APIFY_API_TOKEN

**Required for**: YouTube transcript fetching  
**Type**: API token string  
**Where to get**: [Apify Console](https://console.apify.com/account/integrations)

Example:
```
APIFY_API_TOKEN=apify_api_xxxxxxxxxxxxxxxxxxxxx
```

**Used by**:
- `lib/fetch-and-save-transcript.ts`
- `workflows/steps/fetch-transcript.ts`

**Security Notes**:
- Treat as highly sensitive
- Never log or expose in error messages
- Apify tokens have usage quotas - monitor your usage

### OPENAI_API_KEY

**Required for**: AI-powered video analysis  
**Type**: API key string  
**Where to get**: [OpenAI Platform](https://platform.openai.com/api-keys)

Example:
```
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
```

**Used by**:
- AI analysis endpoints
- Content summarization
- Key takeaways generation

**Security Notes**:
- Extremely sensitive - has billing implications
- Never expose to client-side code
- Set up usage limits in OpenAI dashboard
- Monitor usage regularly

## Optional Variables (for Slide Extraction)

### BLOB_READ_WRITE_TOKEN

**Required for**: Slide image storage  
**Type**: Vercel Blob storage token  
**Where to get**: Vercel Dashboard → Storage → Blob → Settings

Example:
```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxxxxxxxxxx
```

**Used by**:
- `workflows/steps/extract-slides/manifest-processing.ts`

**Security Notes**:
- Provides read/write access to blob storage
- Token format includes store ID (safe to parse)
- Vercel's pattern: `vercel_blob_rw_{account}_{store}_{random}`

**Note**: The code extracts the store ID from the token (4th segment). This is safe and follows Vercel's own practices. See the [Vercel Storage source code](https://github.com/vercel/storage/blob/main/packages/blob/src/client.ts) for reference.

### SLIDES_EXTRACTOR_URL

**Required for**: Slide extraction service communication  
**Type**: HTTP(S) URL  
**Format**: `https://your-service.example.com`

Example:
```
SLIDES_EXTRACTOR_URL=https://slides-extractor.example.com
```

**Used by**:
- `workflows/steps/extract-slides/job-monitoring.ts`

**Security Notes**:
- Should use HTTPS in production
- Ensure the service is trusted
- Consider network-level access controls

### SLIDES_API_PASSWORD

**Required for**: Authentication with slides extraction service  
**Type**: Bearer token / password string

Example:
```
SLIDES_API_PASSWORD=your_secure_password_here
```

**Used by**:
- `workflows/steps/extract-slides/job-monitoring.ts`
- Sent as `Authorization: Bearer ${SLIDES_API_PASSWORD}` header

**Security Notes**:
- Acts as authentication for slides extraction API
- Use a strong, randomly generated password
- Rotate regularly
- Should match the password configured on the extraction service

## Development vs Production

### Development (.env.local)

For local development, you can use `.env.local` which takes precedence over `.env`:

```bash
cp .env.example .env.local
# Edit .env.local with your development credentials
```

### Production (Vercel/Deployment Platform)

Configure environment variables in your deployment platform's dashboard:

**Vercel**:
1. Project Settings → Environment Variables
2. Add each variable
3. Select appropriate environment (Production/Preview/Development)

**Other platforms**: Follow their environment variable configuration process.

**Production-specific considerations**:
- Use production-grade database (not local PostgreSQL)
- Use production OpenAI API keys with appropriate limits
- Configure monitoring and alerting for API usage
- Use secrets management if available

## Validation

The application validates environment variables at runtime:

```typescript
// Example validation pattern used in the codebase
function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
}
```

**Where validation happens**:
- Database connection: `db/index.ts`
- Apify client: `lib/fetch-and-save-transcript.ts`
- Slides configuration: `workflows/steps/extract-slides/config.ts`

## Troubleshooting

### "Missing env: DATABASE_URL"
- Ensure `.env` file exists in project root
- Verify the file contains `DATABASE_URL=...`
- Check that the file is not in `.gitignore` for deployment

### "APIFY_API_TOKEN is not defined"
- Verify token is set in environment
- Check for typos in variable name
- Ensure the token is valid (test in Apify console)

### "BLOB_READ_WRITE_TOKEN is not set"
- Only needed if using slide extraction
- Get token from Vercel Blob dashboard
- Ensure correct permissions (read/write)

## Security Checklist

Before deploying to production:

- [ ] All required environment variables are set
- [ ] No `.env` files are committed to git
- [ ] Production credentials are different from development
- [ ] API keys have appropriate usage limits configured
- [ ] Database uses strong password and SSL
- [ ] Secrets are stored in platform's secrets management
- [ ] No environment variables are exposed to client-side code
- [ ] Error messages don't leak environment variable values
- [ ] Monitoring is set up for API usage and costs

## Additional Resources

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [OpenAI API Best Practices](https://platform.openai.com/docs/guides/production-best-practices)
- [Apify Documentation](https://docs.apify.com/)
