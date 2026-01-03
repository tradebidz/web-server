# Script to run Web-Server:

### 1. Redis:
```bash
docker-compose up -d redis redis-commander
```

### 2. `app-service` (NestJS): Business logic
```bash
cd app-service
npm install
npx prisma generate
npm run start
```

### 3. `media-service` (Golang): Email worker for Verify mail & Forgot password
```bash
cd media-service
go mod tidy
go run main.go
```