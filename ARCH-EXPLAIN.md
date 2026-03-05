# KSA Mail Backend Architecture Overview

I have implemented a production-ready, highly secure backend for the KSA Mail platform in the `ksa-backend` directory. The architecture follows modular NestJS design patterns, integrating PostgreSQL via Prisma and the Mailcow REST API.

## 📁 Project Structure Summary

- **src/auth**: Handles registration and login. Features bcrypt hashing, JWT token generation, and httpOnly cookie support.
- **src/mailcow**: A dedicated service for all communications with the Mailcow API.
- **src/mailbox**: Manages local database records of mailboxes and provides admin endpoints for mailbox listing.
- **src/prisma**: Centralized database service shared across all modules.
- **src/common**: Contains reusable logic like Auth Guards and Role Decorators.

## ⚙️ Key Modules Explained

### 1. Authentication Module (`/auth`)
This is the entry point for users. 
- **Register**: Performs a "Distributed Transaction". It first creates a user in the local database. If that succeeds, it calls the Mailcow API. If Mailcow fails (e.g., domain quota reached), it **automatically rolls back** the user creation in the local database to maintain data integrity.
- **Login**: Validates credentials and returns a JWT. It also sets an `httpOnly` cookie for enhanced security against XSS attacks.

### 2. Mailcow Integration (`/mailcow`)
The `MailcowService` uses a private Axios instance pre-configured with your `MAILCOW_API_KEY`. It provides typed methods for adding, deleting, and listing mailboxes from the external server. It never exposes your API key to the client.

### 3. Mailbox Management (`/mailbox`)
This module keeps track of mailboxes in the local PostgreSQL database.
- **Admins**: Can view all mailboxes directly from the Mailcow server via a protected endpoint.
- **Users**: Can only view mailboxes associated with their specific user ID.

### 4. Security & Guards
- **JwtAuthGuard**: Protects routes by verifying the JWT signature. It accepts tokens from both the `Authorization` header and cookies.
- **RolesGuard**: Enforces Role-Based Access Control (RBAC). You can decorate controllers or specific methods with `@Roles(Role.ADMIN)` to restrict access.
- **Input Validation**: Uses `class-validator` and `ValidationPipe` globally to ensure all incoming data matches our expected schema before reaching any controller before reaching any controller.

## 🚀 How to Run

1. **Setup Database**: Ensure PostgreSQL is running and update `DATABASE_URL` in `.env`.
2. **Install Dependencies**:
   ```bash
   cd ksa-backend
   npm install
   ```
3. **Generate Prisma Client**:
   ```bash
   npm run prisma:generate
   npm run prisma:push
   ```
4. **Start the Server**:
   ```bash
   npm run start:dev
   ```

The backend is now listening on `http://localhost:4000`. You can point your frontend to this address for secure user onboarding and mailbox management.
