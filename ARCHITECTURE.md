# Microservices Architecture & Integration Guide

## Overview

This project consists of **3 microservices** that work together to provide a complete auction/bidding platform:

1. **app-service** (NestJS) - Main API & WebSocket Gateway
2. **core-service** (Spring Boot) - Bidding Engine
3. **media-service** (Go) - Email Worker & Image Upload Service

All services communicate via **Redis** as a message broker.

---

## Service Details

### 1. app-service (NestJS)
**Port:** `3000` (default, configurable via `PORT` env var)  
**Purpose:** Main REST API and WebSocket gateway

**Responsibilities:**
- User authentication & authorization (JWT)
- User management
- Product management
- Categories management
- Admin operations
- **WebSocket Gateway** for real-time bidding updates
- Database: PostgreSQL (via Prisma ORM)

**Key Features:**
- REST API endpoints under `/api/v1/*`
- WebSocket namespace: `/auctions` (Socket.IO)
- Subscribes to Redis channel `auction_updates` for real-time bid notifications
- Publishes to Redis stream `notification_stream` for email tasks

---

### 2. core-service (Spring Boot)
**Port:** `8082`  
**Purpose:** Bidding engine with transaction management

**Responsibilities:**
- Place bids with database locking (pessimistic locking)
- Validate bid amounts (must be > current price + step price)
- Handle auto-bid logic
- Auto-extend auction time if configured
- Update product current price and winner
- **Publishes bid updates** to Redis pub/sub channel `auction_updates`

**Key Features:**
- REST endpoint: `POST /api/v1/bids`
- Uses `@Transactional` for ACID compliance
- Database: PostgreSQL (via JPA/Hibernate)
- Redis pub/sub for real-time updates

**API:**
```http
POST http://localhost:8082/api/v1/bids
Headers:
  X-User-Id: <user_id>
Body:
{
  "productId": 1,
  "amount": 150.00,
  "isAutoBid": false,
  "maxAmount": 200.00
}
```

---

### 3. media-service (Go)
**Port:** `8080` (default, configurable via `PORT` env var)  
**Purpose:** Background email worker & image upload service

**Responsibilities:**
- **Email Worker:** Consumes Redis stream `notification_stream` and sends emails via Mailtrap
- **Image Upload API:** Resizes and uploads images to Supabase Storage

**Key Features:**
- Email types: `VERIFY_EMAIL`, `RESET_PASSWORD`
- Image processing: Resizes to max 1024px width, JPEG quality 80%
- REST endpoint: `POST /api/v1/media/upload`

---

## Integration Architecture

### Shared Infrastructure: Redis

All three services connect to the **same Redis instance** at `localhost:6379`:

- **Redis Streams:** `notification_stream` (email tasks)
- **Redis Pub/Sub:** `auction_updates` (bidding updates)

---

### Integration Flow #1: Email Verification (Registration/Password Reset)

```
┌─────────────┐         ┌──────────┐         ┌──────────────┐         ┌──────────┐
│   Client    │         │app-service│         │    Redis     │         │media-    │
│             │         │ (NestJS) │         │   Stream     │         │service   │
└──────┬──────┘         └────┬──────┘         └──────┬───────┘         └────┬──────┘
       │                    │                        │                      │
       │ POST /auth/register│                        │                      │
       ├───────────────────>│                        │                      │
       │                    │                        │                      │
       │                    │ XADD notification_    │                      │
       │                    │ stream VERIFY_EMAIL  │                      │
       │                    ├─────────────────────>│                      │
       │                    │                        │                      │
       │                    │                        │ XReadGroup           │
       │                    │                        │ (email_workers)      │
       │                    │                        ├─────────────────────>│
       │                    │                        │                      │
       │                    │                        │                      │ Send Email
       │                    │                        │                      │ via Mailtrap
       │                    │                        │                      │
       │  {message: "..."}  │                        │                      │
       │<───────────────────┤                        │                      │
```

**Steps:**
1. Client calls `POST /api/v1/auth/register` on **app-service**
2. **app-service** creates user, generates OTP, stores in Redis key `otp:<email>`
3. **app-service** publishes to Redis stream: `XADD notification_stream * type VERIFY_EMAIL email <email> otp <otp>`
4. **media-service** worker consumes from stream and sends email via Mailtrap
5. Client verifies OTP via `POST /api/v1/auth/verify-otp` (reads from Redis)

**Same flow for:**
- `POST /api/v1/auth/resend-otp`
- `POST /api/v1/auth/request-reset-password`

---

### Integration Flow #2: Real-Time Bidding Updates

```
┌─────────────┐         ┌──────────────┐         ┌──────────┐         ┌─────────────┐         ┌─────────────┐
│   Client    │         │ core-service │         │   Redis  │         │app-service  │         │   Client    │
│  (Browser)  │         │ (Spring Boot)│         │  Pub/Sub │         │ (WebSocket) │         │  (Browser)  │
└──────┬──────┘         └──────┬───────┘         └────┬─────┘         └──────┬──────┘         └──────┬──────┘
       │                      │                       │                      │                       │
       │ POST /api/v1/bids    │                       │                      │                       │
       ├─────────────────────>│                       │                      │                       │
       │                      │                       │                      │                       │
       │                      │ Process bid           │                      │                       │
       │                      │ (DB lock, validate)   │                      │                       │
       │                      │                       │                      │                       │
       │                      │ PUBLISH auction_      │                      │                       │
       │                      │ updates {productId,   │                      │                       │
       │                      │ currentPrice, ...}    │                      │                       │
       │                      ├──────────────────────>│                      │                       │
       │                      │                       │                      │                       │
       │                      │                       │                      │ Subscribe to          │
       │                      │                       │                      │ auction_updates       │
       │                      │                       │                      │<──────────────────────┤
       │                      │                       │                      │                       │
       │                      │                       │                      │ Receive message       │
       │                      │                       │                      │ Emit WebSocket event  │
       │                      │                       │                      │ product_<id>_update   │
       │                      │                       │                      ├──────────────────────>│
       │                      │                       │                      │                       │
       │                      │ {success}             │                      │                       │
       │<─────────────────────┤                       │                      │                       │
       │                      │                       │                      │                       │
       │                      │                       │                      │                       │ Real-time update
       │                      │                       │                      │                       │<───────────────────┤
```

**Steps:**
1. Client calls `POST http://localhost:8082/api/v1/bids` on **core-service** (or via proxy)
2. **core-service** processes bid:
   - Locks product row (pessimistic lock)
   - Validates bid amount
   - Saves bid to database
   - Updates product current price
3. **core-service** publishes update to Redis: `PUBLISH auction_updates {productId, currentPrice, winnerId, endTime}`
4. **app-service** WebSocket gateway (already subscribed) receives message
5. **app-service** emits WebSocket event: `product_<productId>_update` to all connected clients
6. All clients watching that product receive real-time update

**WebSocket Connection:**
- Clients connect to: `ws://localhost:3000/auctions` (Socket.IO namespace)
- Listen to event: `product_<productId>_update`

---

### Integration Flow #3: Image Upload

```
┌─────────────┐         ┌──────────────┐         ┌──────────┐
│   Client    │         │media-service │         │ Supabase │
│             │         │    (Go)      │         │ Storage  │
└──────┬──────┘         └──────┬───────┘         └────┬─────┘
       │                      │                       │
       │ POST /api/v1/media/  │                       │
       │ upload (multipart)   │                       │
       ├────────────────────>│                       │
       │                      │                       │
       │                      │ Resize image          │
       │                      │ (max 1024px width)   │
       │                      │                       │
       │                      │ Upload to Supabase    │
       │                      ├──────────────────────>│
       │                      │                       │
       │                      │ {url: "...", ...}     │
       │<─────────────────────┤                       │
```

**Direct HTTP call** - no Redis involved.

---

## How to Start All Services

### Prerequisites
- Node.js & npm (for app-service)
- Java 17+ & Gradle (for core-service)
- Go 1.25+ (for media-service)
- Docker & Docker Compose (for Redis)
- PostgreSQL database (configured in each service)

---

### Step 1: Start Redis

From the project root:

```bash
docker-compose up -d redis redis-commander
```

This starts:
- **Redis** on `localhost:6379`
- **Redis Commander** (UI) on `http://localhost:8081`

Verify:
```bash
docker ps | grep redis
```

---

### Step 2: Start app-service (NestJS)

```bash
cd app-service

# Install dependencies (first time only)
npm install

# Generate Prisma client
npx prisma generate

# Set up environment variables (create .env if needed)
# Required: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, REDIS_HOST, REDIS_PORT

# Start in development mode
npm run start:dev

# Or start in production mode
npm run start:prod
```

**Default port:** `3000`  
**API base:** `http://localhost:3000/api/v1`  
**WebSocket:** `ws://localhost:3000/auctions`

**Environment Variables:**
```env
PORT=3000
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
REDIS_HOST=localhost
REDIS_PORT=6379
GOOGLE_CLIENT_ID=... (optional, for Google OAuth)
```

---

### Step 3: Start core-service (Spring Boot)

```bash
cd core-service

# Build and run (Gradle will download dependencies automatically)
./gradlew bootRun

# Or build JAR and run
./gradlew build
java -jar build/libs/core-service-0.0.1-SNAPSHOT.jar
```

**Port:** `8082` (configured in `application.properties`)  
**API base:** `http://localhost:8082/api/v1`

**Configuration:** `src/main/resources/application.properties`
- Database: PostgreSQL (Supabase)
- Redis: `localhost:6379`

---

### Step 4: Start media-service (Go)

```bash
cd media-service

# Install dependencies (first time only)
go mod tidy

# Create .env file with required variables
cat > .env << EOF
PORT=8080
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
SUPABASE_BUCKET=your-bucket-name
MAILTRAP_API_TOKEN=your-mailtrap-token
FROM_EMAIL=hello@demomailtrap.co
FROM_NAME=TradeBidz
EOF

# Run
go run main.go
```

**Port:** `8080` (default)  
**API:** `http://localhost:8080/api/v1/media/upload`

**Environment Variables:**
- `PORT` (optional, default: 8080)
- `SUPABASE_URL` (required)
- `SUPABASE_KEY` (required)
- `SUPABASE_BUCKET` (required)
- `MAILTRAP_API_TOKEN` (required)
- `FROM_EMAIL` (optional)
- `FROM_NAME` (optional)

---

## Service Ports Summary

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| **app-service** | 3000 | HTTP + WebSocket | Main API & real-time updates |
| **core-service** | 8082 | HTTP | Bidding engine |
| **media-service** | 8080 | HTTP | Email worker & image upload |
| **Redis** | 6379 | TCP | Message broker |
| **Redis Commander** | 8081 | HTTP | Redis UI |

---

## Testing the Integration

### 1. Test Email Flow

```bash
# Register a user (triggers email)
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "full_name": "Test User"
  }'

# Check media-service logs - should show email being sent
# Verify OTP
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "otp": "123456"
  }'
```

### 2. Test Bidding Flow

```bash
# Place a bid (via core-service)
curl -X POST http://localhost:8082/api/v1/bids \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 1" \
  -d '{
    "productId": 1,
    "amount": 150.00,
    "isAutoBid": false
  }'

# Connect WebSocket client to ws://localhost:3000/auctions
# Listen to event: product_1_update
# Should receive real-time update when bid is placed
```

### 3. Test Image Upload

```bash
curl -X POST http://localhost:8080/api/v1/media/upload \
  -F "file=@/path/to/image.jpg"
```

---

## Architecture Benefits

1. **Separation of Concerns:** Each service has a single responsibility
2. **Scalability:** Services can be scaled independently
3. **Technology Diversity:** Best tool for each job (NestJS for API, Spring Boot for transactions, Go for background workers)
4. **Loose Coupling:** Services communicate via Redis (no direct dependencies)
5. **Real-time Updates:** WebSocket gateway provides instant bid notifications
6. **Reliability:** Database locking in core-service prevents race conditions

---

## Troubleshooting

### Redis Connection Issues
- Ensure Redis is running: `docker ps | grep redis`
- Check Redis logs: `docker logs auction_redis`
- Verify ports: `netstat -an | grep 6379`

### Service Not Starting
- Check environment variables are set correctly
- Verify database connections
- Check service logs for errors

### Email Not Sending
- Verify `MAILTRAP_API_TOKEN` is set in media-service
- Check media-service logs for errors
- Verify Redis stream has messages: Use Redis Commander UI

### WebSocket Not Receiving Updates
- Verify app-service is subscribed to `auction_updates` channel
- Check core-service is publishing to Redis
- Test Redis pub/sub manually using Redis CLI

