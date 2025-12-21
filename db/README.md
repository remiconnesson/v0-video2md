# Database Architecture

## Driver Configuration

This project uses the **Neon serverless driver** with Drizzle ORM:

```typescript
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
```

This configuration is optimized for serverless environments (Vercel Edge Functions, Serverless Functions) where:
- No persistent TCP connections are maintained
- Each request may use a different backend connection
- Execution must complete within function timeout limits

## Transaction Constraints

### Why Transactions Are Not Supported

The Neon serverless driver **cannot guarantee connection affinity**, which means:

1. Each query may execute on a different backend connection
2. PostgreSQL transactions require all statements to run on the **same physical connection**
3. `db.transaction()` calls may silently degrade and not provide ACID guarantees
4. This is a fundamental architectural constraint, not a Drizzle ORM bug

### Neon's Official Documentation

> Transactions are not supported in HTTP mode. Each query executes independently on the backend connection.

Source: [Neon Serverless Driver Documentation](https://neon.tech/docs/serverless/serverless-driver)

## Design Patterns for Serverless

Since transactions are not available, we use alternative patterns to ensure data consistency:

### 1. Idempotent Upserts

All inserts use `onConflictDoUpdate` to make operations idempotent:

```typescript
await db
  .insert(channels)
  .values({ channelId, channelName })
  .onConflictDoUpdate({
    target: channels.channelId,
    set: { channelName },
  });
```

**Benefits:**
- Retry-safe: running the same operation multiple times produces the same result
- No risk of duplicate key errors
- Updates existing records with latest data

### 2. Correct Insert Order

Always insert parent records before child records:

```typescript
// 1. First: channels (parent)
await db.insert(channels).values(...);

// 2. Second: videos (references channels)
await db.insert(videos).values(...);

// 3. Third: scrapTranscriptV1 (references videos and channels)
await db.insert(scrapTranscriptV1).values(...);
```

**Benefits:**
- Foreign key constraints prevent orphaned child records
- If a child insert fails, parent exists for retry
- Database maintains referential integrity

### 3. Foreign Key Constraints

The schema enforces relationships at the database level:

```typescript
export const videos = pgTable("videos", {
  videoId: varchar("video_id", { length: 32 }).primaryKey(),
  channelId: varchar("channel_id", { length: 64 })
    .notNull()
    .references(() => channels.channelId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
});
```

**Benefits:**
- Database rejects invalid references
- Cascade deletes maintain consistency
- No orphaned records possible

### 4. Eventual Consistency

In case of partial failures:

| Scenario | Result | Recovery |
|----------|--------|----------|
| Channel insert succeeds, video fails | Channel exists without video | Retry: channel upsert (no-op), video insert succeeds |
| Video succeeds, transcript fails | Video exists without transcript | Retry: channel/video upserts (no-op), transcript succeeds |
| All succeed | Complete data | No retry needed |

The idempotent upsert pattern ensures eventual consistency through retries.

## When Would Transactions Be Needed?

True PostgreSQL transactions would be beneficial for:

1. **Multi-row atomic updates** across tables
2. **Read-modify-write** operations requiring isolation
3. **Complex business logic** requiring rollback on partial failure
4. **Race condition prevention** in concurrent writes

However, these scenarios are rare in this application, and the serverless benefits outweigh the transaction limitation.

## Alternative: Pooled Connection

If transactions become necessary, the project could switch to the **Neon pooled driver**:

```typescript
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/node-postgres";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// Now transactions work:
await db.transaction(async (tx) => {
  await tx.insert(channels).values(...);
  await tx.insert(videos).values(...);
  await tx.insert(scrapTranscriptV1).values(...);
});
```

**Trade-offs:**
- ✅ Real PostgreSQL transactions
- ✅ Connection affinity guaranteed
- ❌ Requires Node.js runtime (not Edge compatible)
- ❌ Connection pooling overhead
- ❌ Less scalable for stateless functions

For most use cases in this application, the serverless driver with idempotent upserts is the optimal choice.

## Best Practices

When writing database code for this project:

1. ✅ **DO** use `onConflictDoUpdate` for all inserts
2. ✅ **DO** insert parent records before children
3. ✅ **DO** rely on database constraints for integrity
4. ✅ **DO** design for eventual consistency
5. ❌ **DON'T** use `db.transaction()` - it won't work reliably
6. ❌ **DON'T** assume queries run on the same connection
7. ❌ **DON'T** rely on connection state or session variables

## Further Reading

- [Neon Serverless Driver Docs](https://neon.tech/docs/serverless/serverless-driver)
- [Drizzle ORM Transactions](https://orm.drizzle.team/docs/transactions)
- [PostgreSQL Isolation Levels](https://www.postgresql.org/docs/current/transaction-iso.html)
