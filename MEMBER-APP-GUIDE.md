# 💪 Ultra Fitness Member App - Usage Guide

## 📱 How to Access the App

The Member App is a Progressive Web App (PWA) that runs in your browser but behaves like a mobile app.

**URL**: `http://localhost:5000/member-app/index.html`
*(Note: You need to open this file directly or serve it via the backend)*

Since we are running locally, you can access it by opening:
`c:\Users\Vinay\Downloads\ultra-fitness-gym 6.1 comp backend\member-app\index.html`

## 🔑 How to Login

You need a **Member ID** and **Password**.

### Step 1: Get Credentials (Admin)
1. Go to the Admin Panel (`index.html` in root folder)
2. Create a new customer
3. The system will auto-generate a **Member ID** (e.g., `U001`) and **Temporary Password**
4. Note these down!

### Step 2: Login (Member)
1. Open the Member App
2. Enter Member ID (e.g., `U001`)
3. Enter Password
4. Click Login

### Step 3: First Time Setup
- On first login, you will be asked to **change your password**
- Enter a new secure password
- You will be redirected to the Dashboard

## 🌟 Features

### 📊 Dashboard
- View your **Membership Plan** (Monthly, Yearly, etc.)
- See **Days Remaining** and Expiry Date
- Check your status (Active, Expiring, Expired)

### 📱 QR Code
- Click "My QR Code" to show your unique code
- Show this at the gym entrance to scan and mark attendance

### 📅 Attendance
- View your full check-in history
- See dates and times of your gym visits

### 💳 Payments
- View your payment history
- See amounts, dates, and receipts

### ⚙️ Settings
- Update your profile (Name, Phone, Email)
- Change your password
- Logout

## 📲 How to Install on Mobile (PWA)

To test the "App" experience:

1. **Android (Chrome)**:
   - Open the link in Chrome
   - Tap menu (3 dots) → "Add to Home Screen"
   - It will install as a standalone app!

2. **iOS (Safari)**:
   - Open the link in Safari
   - Tap Share button → "Add to Home Screen"

## ⚠️ Important Notes

- **Offline Mode**: The app works offline! Try turning off WiFi after loading it once.
- **Push Notifications**: Will request permission on supported browsers.
- **Security**: Your data is secure. You can only see your own info.
