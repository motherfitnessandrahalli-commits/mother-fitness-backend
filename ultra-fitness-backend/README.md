# Ultra Fitness Gym - Backend API

RESTful API backend for Ultra Fitness Gym Management System built with Node.js, Express, and MongoDB.

## Features

- 🔐 JWT-based authentication
- 👥 Customer management (CRUD)
- 📸 Photo upload and storage
- 📊 Attendance tracking
- 📈 Analytics and reports
- 📧 Email notifications
- ⚡ Real-time updates (WebSockets)
- 📚 API documentation (Swagger)

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **Authentication**: JWT
- **File Upload**: Multer
- **Email**: Nodemailer
- **Real-time**: Socket.io
- **Validation**: Joi
- **Security**: Helmet, bcrypt, express-rate-limit

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or Atlas)
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

4. Update environment variables in `.env`

5. Start MongoDB (if running locally):
```bash
mongod
```

6. Run the server:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `PUT /api/auth/change-password` - Change password

### Customers
- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get customer by ID
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Attendance
- `POST /api/attendance/mark` - Mark attendance
- `GET /api/attendance` - Get attendance records
- `GET /api/attendance/stats` - Get statistics

### Analytics
- `GET /api/analytics/dashboard` - Dashboard stats
- `GET /api/analytics/plans` - Plan popularity
- `GET /api/analytics/demographics` - Age demographics

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── models/          # Mongoose models
│   ├── controllers/     # Route controllers
│   ├── routes/          # API routes
│   ├── middleware/      # Custom middleware
│   ├── services/        # Business logic
│   ├── utils/           # Helper functions
│   └── app.js           # Express app
├── uploads/             # Uploaded files
├── .env                 # Environment variables
└── server.js            # Entry point
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode (with nodemon)
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## Deployment

See [deployment guide](./docs/DEPLOYMENT.md) for detailed instructions.

## License

MIT
