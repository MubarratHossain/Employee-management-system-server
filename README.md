# Employee Management System Backend

This is the backend API for the Employee Management System. It provides authentication, user management, work tracking, and payroll processing functionalities using Node.js, Express, MongoDB, and Firebase authentication.

## Features
- User authentication with JWT (Login, Logout, Protected Routes)
- User role management (Employee, HR)
- Work tracking (Add, Update, Delete work entries)
- Payroll processing (HR submits payroll, marks payments)
- Secure API endpoints with token-based authentication

## Tech Stack
- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Mongoose)
- **Authentication:** Firebase Auth, JWT
- **Hosting:** Localhost / Vercel

## Installation

1. Clone the repository:
   ```bash https://github.com/MubarratHossain/Employee-management-system-server.git


   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file and add the following environment variables:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   ```

4. Start the server:
   ```bash
   nodemon index.js
   ```
   The server will run on `http://localhost:5000`.

## API Endpoints

### Authentication
| Method | Endpoint        | Description |
|--------|----------------|-------------|
| POST   | `/register`     | Register a new user |
| POST   | `/login`        | Login and get JWT token |
| GET    | `/logout`       | Logout user |

### User Management
| Method | Endpoint            | Description |
|--------|--------------------|-------------|
| GET    | `/users`           | Get all users (HR only) |
| GET    | `/users/:email`    | Get user by email |
| PUT    | `/users/update/:id` | Update user details |
| DELETE | `/users/:id`       | Delete user (HR only) |

### Work Tracking
| Method | Endpoint         | Description |
|--------|-----------------|-------------|
| POST   | `/work`         | Add work entry (Employee only) |
| GET    | `/work`         | Get all work entries |
| PUT    | `/work/:id`     | Update work entry |
| DELETE | `/work/:id`     | Delete work entry |

### Payroll Processing
| Method | Endpoint         | Description |
|--------|-----------------|-------------|
| POST   | `/payroll`      | HR submits payroll request |
| GET    | `/payroll`      | Get payroll list |
| PUT    | `/payroll/:id`  | Mark payroll as paid |

## Middleware
- `verifyToken.js`: Middleware to authenticate and protect routes using JWT.



