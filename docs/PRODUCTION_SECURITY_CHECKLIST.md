# Production Deployment Security Checklist

Use this checklist before deploying video2md to production.

## ⚠️ Critical Security Requirements

### Authentication & Authorization
- [ ] **Implement user authentication** (e.g., NextAuth.js, Auth0, Clerk)
- [ ] **Protect all POST/DELETE API endpoints** with authentication middleware
- [ ] **Implement API key authentication** for programmatic access (optional)
- [ ] **Add authorization checks** to verify users can only access their own data
- [ ] **Implement role-based access control (RBAC)** if multiple user types exist

### Rate Limiting & Abuse Prevention
- [ ] **Add rate limiting to all API endpoints** (e.g., using Vercel Edge Config, Upstash, or Redis)
  - Recommended limits:
    - `GET /api/videos`: 100 requests/minute per IP
    - `GET /api/video/[videoId]`: 60 requests/minute per IP
    - `POST /api/video/[videoId]/slides`: 5 requests/hour per user/video
    - `POST /api/video/[videoId]/analysis`: 10 requests/hour per user/video
- [ ] **Implement request throttling** for resource-intensive operations
- [ ] **Add CAPTCHA** for public-facing forms (if applicable)
- [ ] **Monitor for unusual traffic patterns** and set up alerts

### Environment Variables & Secrets
- [ ] **All environment variables are set** in production environment
- [ ] **No `.env` files committed** to repository (verify with `git log --all`)
- [ ] **Production secrets are different** from development
- [ ] **API keys have usage limits** configured at provider level
- [ ] **Database password is strong** (20+ characters, random)
- [ ] **Secrets are stored in platform's secret manager** (Vercel, AWS Secrets Manager, etc.)
- [ ] **Environment variables are not exposed** to client-side code
- [ ] **Rotate all secrets** before production launch

### Database Security
- [ ] **Database uses SSL/TLS** for all connections (`?sslmode=require`)
- [ ] **Database user has minimum required permissions** (not superuser)
- [ ] **Database connection string uses strong password**
- [ ] **Database has regular automated backups** configured
- [ ] **Database is not publicly accessible** (firewall rules)
- [ ] **Database audit logging is enabled** (if available)
- [ ] **SQL injection prevention** verified (Drizzle ORM provides this, but verify custom queries)

### API Security
- [ ] **Input validation on all endpoints** (already has some, verify all)
- [ ] **Output sanitization** to prevent XSS
- [ ] **CORS policies configured** appropriately (not `*` in production)
- [ ] **Security headers configured** (see below)
- [ ] **Request size limits** set appropriately
- [ ] **Timeout values configured** for long-running operations
- [ ] **Error messages don't leak sensitive info** (review error handlers)

### Security Headers
Configure in `next.config.ts`:
- [ ] **Content-Security-Policy (CSP)**
- [ ] **Strict-Transport-Security (HSTS)**
- [ ] **X-Frame-Options: DENY**
- [ ] **X-Content-Type-Options: nosniff**
- [ ] **Referrer-Policy: strict-origin-when-cross-origin**
- [ ] **Permissions-Policy** (disable unnecessary features)

Example configuration:
```typescript
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];
```

### Third-Party Services
- [ ] **OpenAI API key has spending limits** configured
- [ ] **Apify API token has usage quotas** configured
- [ ] **Vercel Blob storage has size limits** configured
- [ ] **All API keys are production-specific** (not shared with dev/staging)
- [ ] **Service webhooks use signature verification** (if applicable)
- [ ] **Regular review of service usage** and costs

### Monitoring & Logging
- [ ] **Error tracking configured** (e.g., Sentry, LogRocket)
- [ ] **Application monitoring** set up (e.g., Vercel Analytics, DataDog)
- [ ] **Log aggregation** configured (but don't log secrets!)
- [ ] **Alerts for suspicious activity** configured
- [ ] **Alerts for high error rates** configured
- [ ] **Alerts for unusual API usage** configured
- [ ] **Regular log review process** established

### Infrastructure Security
- [ ] **HTTPS enforced** (HTTP redirects to HTTPS)
- [ ] **CDN configured** with DDoS protection (Vercel provides this)
- [ ] **WAF (Web Application Firewall)** configured if available
- [ ] **Regular dependency updates** process established
- [ ] **Automated security scanning** in CI/CD pipeline
- [ ] **Container scanning** if using containers
- [ ] **Penetration testing** completed (for high-security deployments)

### Data Protection
- [ ] **Data retention policy** defined and implemented
- [ ] **User data deletion process** defined (for GDPR compliance)
- [ ] **Data encryption at rest** (database provider feature)
- [ ] **Data encryption in transit** (HTTPS/TLS)
- [ ] **Backup encryption** enabled
- [ ] **Regular backup restoration tests** performed

### Compliance (if applicable)
- [ ] **GDPR compliance** (if serving EU users)
- [ ] **CCPA compliance** (if serving California users)
- [ ] **Terms of Service** published
- [ ] **Privacy Policy** published
- [ ] **Cookie consent** implemented (if using cookies)
- [ ] **Data processing agreements** with third parties

### Testing
- [ ] **Security testing completed** (OWASP Top 10 coverage)
- [ ] **Load testing performed** to understand limits
- [ ] **Chaos engineering tests** (optional, for critical systems)
- [ ] **Authentication bypass attempts** tested
- [ ] **SQL injection attempts** tested
- [ ] **XSS attempts** tested
- [ ] **CSRF protection** verified

### Documentation
- [ ] **Security incident response plan** documented
- [ ] **Disaster recovery plan** documented
- [ ] **Runbook for common issues** created
- [ ] **Security contact** published in SECURITY.md
- [ ] **API documentation** updated with security requirements
- [ ] **Team trained** on security best practices

### Code Review
- [ ] **Security-focused code review** completed
- [ ] **No hardcoded secrets** in codebase
- [ ] **No commented-out security checks**
- [ ] **All console.logs reviewed** for sensitive data
- [ ] **Third-party dependencies audited** (`pnpm audit`)
- [ ] **License compliance** verified

### Pre-Launch
- [ ] **All security issues from scans resolved**
- [ ] **Vulnerability disclosure process** tested
- [ ] **Security team sign-off** obtained (if applicable)
- [ ] **Penetration test findings** addressed
- [ ] **Final security review** completed
- [ ] **Rollback plan** documented and tested

## Post-Deployment

### Ongoing Security
- [ ] **Weekly dependency updates** (`pnpm update`)
- [ ] **Monthly security reviews** of logs and alerts
- [ ] **Quarterly penetration testing** (for high-security deployments)
- [ ] **Annual security audit** (for high-security deployments)
- [ ] **Incident response drills** (annually or as needed)
- [ ] **Security training** for team members (ongoing)

### Monitoring Checklist
- [ ] Monitor authentication failures
- [ ] Monitor rate limit hits
- [ ] Monitor API error rates
- [ ] Monitor database connection failures
- [ ] Monitor external service failures
- [ ] Monitor unusual traffic patterns
- [ ] Monitor resource usage (CPU, memory, storage)

## Quick Reference: Attack Surface

### Current Public Endpoints (require protection)
1. `POST /api/video/[videoId]/slides` - Resource-intensive, costs money
2. `POST /api/video/[videoId]/analysis` - Costs OpenAI API credits
3. `GET /api/videos` - No pagination, could expose all data
4. `GET /api/video/[videoId]/analysis` - Streaming, could drain resources
5. All other GET endpoints - Potential for abuse without rate limiting

### Sensitive Data Flows
1. **YouTube Video IDs** → Validated but public
2. **Transcripts** → Stored in database, potentially copyrighted
3. **AI Analysis** → Costs money, stored in database
4. **Slide Images** → Stored in Vercel Blob, uses storage quota
5. **User Data** → Currently none, but will be needed for auth

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/security)
- [Vercel Security](https://vercel.com/docs/security/deployment-security)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CIS Controls](https://www.cisecurity.org/controls)

## Notes

This checklist is comprehensive but not exhaustive. Security requirements vary based on:
- Sensitivity of data
- Regulatory requirements
- User base size
- Business criticality
- Threat model

Consult with security professionals for high-risk deployments.

**Last Updated**: 2024-12-22
