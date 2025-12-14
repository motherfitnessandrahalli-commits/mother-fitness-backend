# Phase 2 Complete: Database Design & Setup ✅

## What We Built

### 1. Mongoose Models

#### **User Model** (`src/models/User.js`)
```javascript
Schema:
- email (unique, validated)
- password (hashed with bcrypt)
- name
- role (admin, staff, receptionist)
- isActive (boolean)
- timestamps (createdAt, updatedAt)

Features:
✅ Password hashing before save
✅ Password comparison method
✅ Exclude password from JSON responses
✅ Email validation
✅ Index on email field
```

#### **Customer Model** (`src/models/Customer.js`)
```javascript
Schema:
- customerId (auto-generated, unique)
- name, age, email, phone
- plan (Monthly, Quarterly, Half-Yearly, Yearly)
- validity (Date)
- notes, photo
- createdBy (reference to User)
- timestamps

Features:
✅ Auto-generate unique customer ID
✅ Virtual field: status (active/expiring/expired)
✅ Virtual field: daysRemaining
✅ Email and age validation
✅ Multiple indexes for fast queries
```

#### **Attendance Model** (`src/models/Attendance.js`)
```javascript
Schema:
- attendanceId (auto-generated, unique)
- customerId (reference to Customer)
- customerName
- date (YYYY-MM-DD format)
- time (HH:MM AM/PM format)
- timestamp (Date)
- membershipStatus (active/expiring/expired)
- markedBy (reference to User)

Features:
✅ Auto-generate unique attendance ID
✅ Prevent duplicate check-ins (compound index)
✅ Date format validation
✅ Indexes for date-based queries
```

### 2. Utility Functions

#### **helpers.js** - Common utilities
- `getLocalDateString()` - Format dates as YYYY-MM-DD
- `getLocalTimeString()` - Format time as HH:MM AM/PM
- `calculatePlanValidity()` - Calculate plan end date
- `generateUniqueId()` - Generate unique IDs
- `paginate()` - Pagination helper
- `createPaginationMeta()` - Pagination metadata

#### **errorHandler.js** - Error handling
- `AppError` - Custom error class
- `asyncHandler` - Async error wrapper
- `sendSuccess()` - Success response helper
- `sendError()` - Error response helper

### 3. Database Seeder

**File**: `src/utils/seeder.js`

**Sample Data Created:**
- 2 Users (admin and staff)
- 4 Customers (with different plan statuses)
- 2 Attendance records

**Login Credentials:**
```
Admin: admin@ultrafitness.com / 0000
Staff: staff@ultrafitness.com / 0000
```

**Run Seeder:**
```bash
npm run seed
```

### 4. Database Indexes

**Optimized for:**
- Fast customer lookups by ID, email, phone
- Date-based attendance queries
- Preventing duplicate attendance
- Sorting by creation date
- User authentication

## Database Schema Diagram

```
┌─────────────┐
│    User     │
├─────────────┤
│ _id         │◄──┐
│ email       │   │
│ password    │   │
│ name        │   │
│ role        │   │
│ isActive    │   │
└─────────────┘   │
                  │
                  │ createdBy
┌─────────────┐   │
│  Customer   │   │
├─────────────┤   │
│ _id         │◄──┼──┐
│ customerId  │   │  │
│ name        │   │  │
│ age         │   │  │
│ email       │   │  │
│ phone       │   │  │
│ plan        │   │  │
│ validity    │   │  │
│ notes       │   │  │
│ photo       │   │  │
│ createdBy   │───┘  │
└─────────────┘      │
                     │ customerId
┌─────────────┐      │
│ Attendance  │      │
├─────────────┤      │
│ _id         │      │
│ attendanceId│      │
│ customerId  │──────┘
│ customerName│
│ date        │
│ time        │
│ timestamp   │
│ status      │
│ markedBy    │───┐
└─────────────┘   │
                  │
                  └──► User
```

## How to Use

### 1. Setup MongoDB

**Option A: Local MongoDB**
```bash
# Install MongoDB Community Edition
# Start MongoDB service
mongod
```

**Option B: MongoDB Atlas (Cloud)**
1. Create free account at mongodb.com/atlas
2. Create cluster
3. Get connection string
4. Update MONGODB_URI in .env

### 2. Seed Database
```bash
npm run seed
```

Expected output:
```
Connected to MongoDB for seeding
Cleared existing data
Created 2 users
Created 4 customers
Created 2 attendance records
✅ Database seeded successfully!
```

### 3. Test Models

You can now use these models in your controllers:
```javascript
const { User, Customer, Attendance } = require('./models');

// Create customer
const customer = await Customer.create({
    name: 'John Doe',
    age: 25,
    email: 'john@example.com',
    phone: '+91 12345 67890',
    plan: 'Monthly',
    validity: new Date('2025-01-01'),
});

// Get customer status (virtual field)
console.log(customer.status); // 'active', 'expiring', or 'expired'
```

## Key Features Implemented

✅ **Auto-generated IDs** - Unique IDs for customers and attendance  
✅ **Password Security** - Bcrypt hashing with salt  
✅ **Data Validation** - Email, age, plan type validation  
✅ **Virtual Fields** - Computed status and days remaining  
✅ **Duplicate Prevention** - Can't check in twice on same day  
✅ **Database Indexes** - Optimized queries  
✅ **Relationships** - User references in customers and attendance  
✅ **Sample Data** - Ready-to-use test data  

## Next Phase: Authentication System

We'll create:
1. JWT token generation and verification
2. Register endpoint
3. Login endpoint
4. Password change endpoint
5. Authentication middleware
6. Role-based authorization

---

**Status**: Phase 2 Complete ✅  
**Ready for**: Phase 3 - Authentication System
