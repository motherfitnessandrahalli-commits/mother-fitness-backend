# 🔧 Render Deployment - Dockerfile Error Fix

## ❌ Error You're Getting

```
error: failed to solve: failed to read dockerfile: open Dockerfile: no such file or directory
```

---

## ✅ Solution: Change Runtime to Node.js

Render is trying to use **Docker** but your project uses **Node.js** directly.

### **Steps to Fix:**

1. **Go to your Render service settings:**
   - Render Dashboard → Your Service
   - Click on **"Settings"** tab (left sidebar)

2. **Update Build & Deploy Settings:**
   
   Scroll down to find these fields and update them:

   ```
   Runtime: Node
   
   Build Command: npm install
   
   Start Command: npm start
   ```

3. **Save Changes:**
   - Click **"Save Changes"** button
   - Render will automatically redeploy

---

## 📋 Correct Render Configuration

When creating a new web service, use these settings:

| Setting | Value |
|---------|-------|
| **Name** | mother-fitness-backend |
| **Region** | Singapore (or closest) |
| **Branch** | main |
| **Root Directory** | *(leave blank)* |
| **Runtime** | **Node** ⚠️ |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

---

## 🚨 Important Notes

- **DO NOT select "Docker"** as runtime
- The project doesn't need a Dockerfile
- Your `package.json` has the correct scripts:
  - `"start": "node server.js"`
  - Dependencies are installed via `npm install`

---

## ✅ After Fixing

Once you update the runtime to Node:
1. Render will automatically redeploy
2. Watch the build logs
3. Should complete successfully in 2-3 minutes
4. Your backend will be live!

---

**If you're creating a NEW service:**
- Make sure to select **"Node"** as the environment/runtime
- Don't let it auto-detect as Docker
