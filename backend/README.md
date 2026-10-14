# CrimePulse Backend API Gateway & Database Layer 🛡️

The primary Node.js & Express.js REST API gateway and MongoDB Atlas persistence engine for **CrimePulse**.

---

## 🛠️ Requirements & Setup

* **Node.js**: `v18.0.0` or higher (Tested on `v24.18.0`).
* **npm**: `v9.0.0` or higher (Tested on `11.16.0`).

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` and provide your **MongoDB Atlas connection string**:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/crimepulse?retryWrites=true&w=majority
ML_SERVICE_URL=http://127.0.0.1:8000
JWT_SECRET=your_secure_jwt_secret
```

---

## 🌐 MongoDB Atlas Setup Instructions

If you have not configured MongoDB Atlas yet, follow these manual setup steps:

1. **Sign in / Create Account**: Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in.
2. **Create / Select Project**: Create a new project named `CrimePulse`.
3. **Deploy Free Cluster**: Create an **M0 Free Cluster** (Shared Tier).
4. **Create Database User**:
   - Go to **Database Access** $\rightarrow$ **Add New Database User**.
   - Select **Password** authentication.
   - Enter username and secure password (e.g. `crimepulse_admin`).
   - Grant role `Read and write to any database`.
5. **Configure Network Access**:
   - Go to **Network Access** $\rightarrow$ **Add IP Address**.
   - Add your local IP address, or select `Allow Access from Anywhere` (`0.0.0.0/0`) for local development.
6. **Obtain Connection String**:
   - Go to **Clusters** $\rightarrow$ **Connect** $\rightarrow$ **Drivers** (Node.js).
   - Copy the URI string: `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/crimepulse?retryWrites=true&w=majority`.
7. **Update `.env`**: Replace `<username>` and `<password>` in your `backend/.env` file.

---

## 🚀 How to Run the Backend Server

```bash
# Development mode with auto-reload (Nodemon)
npm run dev

# Production startup
npm start
```

Server will run at: `http://127.0.0.1:5000`

---

## 📡 Health & Diagnostic Endpoints

### 1. `GET /api/health`
* **Description**: Backend application health check.
* **Response (HTTP 200)**:
  ```json
  {
    "status": "ok",
    "service": "crimepulse-backend"
  }
  ```

### 2. `GET /api/health/db`
* **Description**: Live MongoDB Atlas connection check.
* **Response when connected (HTTP 200)**:
  ```json
  {
    "status": "ok",
    "database": "connected"
  }
  ```
* **Response when disconnected (HTTP 503)**:
  ```json
  {
    "status": "unhealthy",
    "database": "disconnected",
    "message": "MongoDB is not connected."
  }
  ```

---

## 🗄️ Database Architecture & Data Mappings

> [!IMPORTANT]
> **Data Separation Principle**:
> - MongoDB Atlas stores application domain data only (users, role assignments, saved prediction analysis logs).
> - The historical crime dataset CSV (`crime_dataset_india.csv`) remains owned strictly by the Python ML microservice (`ml-service/crime-prediction/data/`) and is **NOT** duplicated or imported into MongoDB.

### Data Models

#### 1. `User` Model (`src/models/User.js`)
- `name` (String, required, trimmed)
- `email` (String, required, unique, lowercase)
- `passwordHash` (String, required, hidden by default with `select: false`)
- `role` (String, enum: `['OWNER', 'STAFF', 'CUSTOMER']`, default: `'CUSTOMER'`)
- `timestamps` (`createdAt`, `updatedAt`)

#### 2. `Analysis` Model (`src/models/Analysis.js`)
- `userId` (ObjectId, ref: `'User'`, required, indexed)
- `state` (String, required)
- `district` (String, required)
- `inputYear` (Number, required)
- `targetYear` (Number, required)
- `predictedCrime` (String, required)
- `confidencePercentage` (Number, required)
- `probabilities` (Array of `{ crimeCategory, probabilityPercentage }`)
- `status` (String, enum: `['PENDING', 'COMPLETED', 'FAILED']`, default: `'COMPLETED'`)
- `timestamps` (`createdAt`, `updatedAt`)
