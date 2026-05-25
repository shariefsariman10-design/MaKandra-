# MaKandra

MaKandra is een platform dat klanten verbindt met lokale dienstverleners in Suriname. Gebruikers kunnen dienstverleners zoeken, boekingen maken, berichten sturen en beoordelingen achterlaten.

---

## Technologies

**Frontend**
- HTML5, CSS3, JavaScript (Vanilla)
- Hosted via GitHub Pages

**Backend**
- Node.js with Express.js
- JWT (JSON Web Tokens) for authentication
- Bcrypt.js for password hashing
- Nodemailer for email verification
- MySQL2 for database connection

**Database**
- MySQL (relational database)

---

## Requirements

Make sure the following are installed before you begin:

- [Node.js](https://nodejs.org/) v18 or higher
- [npm](https://www.npmjs.com/) v9 or higher
- MySQL server (local or cloud-based, e.g. Railway, PlanetScale)
- An SMTP account for sending emails (e.g. Gmail, Mailtrap)

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/Ja1r117/MaKandra-.git
cd MaKandra-/backend
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in the following values in the `.env` file:

```env
DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
DB_PORT=3306

JWT_SECRET=your_super_secret_jwt_key

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_email_password

BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5500
```

### 3. Install dependencies

```bash
npm install
```

### 4. Start the server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The API will be available at `http://localhost:3000`.

---

## Database Setup

### 1. Create the database

```sql
CREATE DATABASE makandra;
```

### 2. Run the schema and seed files

```bash
mysql -u your_user -p makandra < sql/schema.sql
mysql -u your_user -p makandra < sql/seed.sql
```

This will create all required tables (users, bookings, jobs, messages, reviews, etc.) and populate them with initial data.

### 3. Configuration

The backend reads database settings from environment variables defined in `.env`:

| Variable | Description |
|----------|-------------|
| `DB_HOST` | Database host (e.g. localhost) |
| `DB_USER` | Database username |
| `DB_PASSWORD` | Database password |
| `DB_NAME` | Database name |
| `DB_PORT` | Database port (default: 3306) |

---

## Usage

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/signup` | Register a new user |
| POST | `/auth/login` | Login and receive JWT token |
| POST | `/auth/forgot-password` | Request password reset email |
| POST | `/auth/reset-password` | Reset password with token |
| GET | `/jobs` | List all available jobs |
| POST | `/bookings` | Create a new booking |
| GET | `/providers` | List all service providers |
| GET | `/reviews` | Get reviews |

### Authentication

Protected routes require a JWT token in the `Authorization` header:

```
Authorization: Bearer <your_token>
```

The token is returned on successful login via `POST /auth/login`.

### Frontend
