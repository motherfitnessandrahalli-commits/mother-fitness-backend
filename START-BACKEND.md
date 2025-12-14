# 🚀 Quick Start Guide - Ultra Fitness Backend

## Prerequisites Status
- ✅ **Node.js**: v24.11.1 (Installed)
- ❌ **MongoDB**: Not installed

---

## Option 1: Quick Start with MongoDB Atlas (Cloud - No Installation) ⚡

This is the **FASTEST** way to get started without installing MongoDB locally.

### Steps:

1. **Get a Free MongoDB Cloud Database**:
   - Visit: https://www.mongodb.com/cloud/atlas/register
   - Sign up for free (no credit card required)
   - Create a free cluster (M0 - Free tier)
   - Get your connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/`)

2. **Configure Backend**:
   ```bash
   # Navigate to backend directory
   cd "c:\Users\Vinay\Downloads\ultra-fitness-gym 6.1 comp backend\ultra-fitness-backend"

   # Copy environment file
   copy .env.example .env
   
   # Edit .env file and update MONGODB_URI with your Atlas connection string
   notepad .env
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Seed Database with Sample Data**:
   ```bash
   npm run seed
   ```

5. **Start Backend Server**:
   ```bash
   npm run dev
   ```

   You should see: `🚀 Server running in development mode on port 5000`

6. **Access the Website**:
   - Open `index.html` in your browser
   - Login with: `admin@ultrafitness.com` / `0000`

---

## Option 2: Install MongoDB Locally 💻

### Steps:

1. **Install MongoDB**:
   - Download from: https://www.mongodb.com/try/download/community
   - Choose: Windows x64, MSI installer
   - Install with default settings (include MongoDB Compass)

2. **Start MongoDB Service**:
   ```bash
   # MongoDB should auto-start as a Windows service
   # To verify it's running:
   net start MongoDB
   ```

3. **Follow Steps 2-6 from Option 1 above**
   (But keep the default `.env` with `mongodb://localhost:27017/ultra-fitness-gym`)

---

## Quick Commands Reference

### Start Backend (Development Mode with Auto-Reload):
```bash
cd "c:\Users\Vinay\Downloads\ultra-fitness-gym 6.1 comp backend\ultra-fitness-backend"
npm run dev
```

### Start Backend (Production Mode):
```bash
npm start
```

### Seed Database with Sample Data:
```bash
npm run seed
```

### Run Tests:
```bash
npm test
```

---

## Default Login Credentials (After Seeding)

| Role  | Email                      | Password |
|-------|----------------------------|----------|
| Admin | admin@ultrafitness.com     | 0000     |
| Staff | staff@ultrafitness.com     | 0000     |

---

## Troubleshooting

### "Cannot connect to MongoDB"
- **Atlas users**: Check your connection string in `.env`
- **Local users**: Ensure MongoDB service is running: `net start MongoDB`

### "Port 5000 already in use"
- Change `PORT=5000` to `PORT=5001` in `.env` file
- Also update frontend `api.js` to match: `BASE_URL: 'http://localhost:5001'`

### "Module not found"
- Run: `npm install` in the backend directory

---

## What's Next?

Once the backend is running:
1. ✅ Backend API: http://localhost:5000
2. ✅ API Docs: http://localhost:5000/api-docs
3. ✅ Open `index.html` to access the frontend
4. ✅ Login and start managing your gym!

---

## Need Help?

Check the full walkthrough PDF for detailed architecture information.
