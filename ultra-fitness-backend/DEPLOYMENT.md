# Deployment Guide 🚀

This guide explains how to deploy the Ultra Fitness Backend using Docker and Docker Compose.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed

## Local Deployment (Docker)

1. **Configure Environment**
   Create a `.env` file (if not exists) and ensure `JWT_SECRET` is set.
   ```bash
   cp .env.example .env
   ```

2. **Build and Run**
   ```bash
   docker-compose up -d --build
   ```
   - The API will be available at `http://localhost:5000`
   - MongoDB will be available at `localhost:27017`

3. **View Logs**
   ```bash
   docker-compose logs -f
   ```

4. **Stop Services**
   ```bash
   docker-compose down
   ```

## Cloud Deployment (Railway/Render/Heroku)

### Option 1: Railway (Recommended)

1. **Connect GitHub Repo**: Push your code to GitHub.
2. **Create New Project**: In Railway, select "Deploy from GitHub repo".
3. **Add Database**: Add a MongoDB service in Railway.
4. **Configure Variables**:
   - Set `MONGODB_URI` to the internal connection string provided by Railway.
   - Set `JWT_SECRET`, `NODE_ENV=production`, etc.
5. **Deploy**: Railway will automatically detect the `Dockerfile` and build the app.

### Option 2: VPS (DigitalOcean/AWS/Linode)

1. **SSH into Server**.
2. **Clone Repository**:
   ```bash
   git clone <your-repo-url>
   cd ultra-fitness-backend
   ```
3. **Setup Environment**:
   Create `.env` file with production values.
4. **Run Docker Compose**:
   ```bash
   docker-compose up -d --build
   ```

## Production Checklist

- [ ] Ensure `NODE_ENV` is set to `production`.
- [ ] Use a strong, random string for `JWT_SECRET`.
- [ ] Set `FRONTEND_URL` to your actual frontend domain for CORS.
- [ ] Use a managed database (Atlas/Railway) for better reliability (optional, but recommended over local container).
- [ ] Configure SSL/HTTPS (usually handled by the platform like Railway/Vercel).
