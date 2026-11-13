# Backend Service — LCCB Connect

## Deployment & Production Notes

### Rate Limiting Architecture
All per-user and per-IP limiters (`backend/middleware/actionLimits.js` and `backend/app.js`) currently utilize `express-rate-limit`'s built-in `MemoryStore`.

> [!IMPORTANT]
> **Horizontal Scaling / Multi-Instance Deployments:**  
> When running multiple backend processes or containers behind a load balancer, in-memory state is isolated to each process. To enforce global per-user and per-IP limits across all instances, swap `MemoryStore` with a distributed store such as `rate-limit-redis` backed by a Redis/Valkey cluster.

### Tunable Environment Variables
- `RATE_LIMIT_SEARCH_MAX`: Maximum search queries per minute per authenticated user (default: 30).
- `RATE_LIMIT_SEND_MAX`: Maximum chat messages sent per minute (default: 50).
- `RATE_LIMIT_FRIEND_MAX`: Friend requests per minute (default: 20).
- `RATE_LIMIT_POST_MAX`: Post creations per minute (default: 5).
- `RATE_LIMIT_COMMENT_MAX`: Comments per minute (default: 30).
