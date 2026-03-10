# Infinity MD Bot - Complete API Documentation

## Overview

Infinity MD Bot provides a comprehensive REST API for managing WhatsApp bot sessions, authentication, and configurations. All endpoints (except `/api/auth/login` and `/api/auth/signup`) require authentication via session cookies.

---

## Base URL
```
http://localhost:5000
```

---

## Authentication Endpoints

### 1. User Registration
**POST** `/api/auth/signup`

Register a new user account.

**Request Body:**
```json
{
  "username": "your_username",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "User already exists"
}
```

---

### 2. User Login
**POST** `/api/auth/login`

Login to your account. Returns a session cookie.

**Request Body:**
```json
{
  "username": "your_username",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

---

### 3. User Logout
**GET** `/api/auth/logout`

Logout and destroy the session.

**Response:**
```json
{
  "success": true
}
```

---

## Session Management Endpoints

### 4. Get All Sessions
**GET** `/api/sessions`

Retrieve all WhatsApp bot sessions for the logged-in user. (Admins see all sessions)

**Response:**
```json
[
  {
    "id": "qr_94770612011_1772940534398",
    "name": "Infinity MD",
    "ownerName": "John Doe",
    "ownerNumber": "94770612011",
    "settings": {},
    "status": "Online",
    "userId": "username"
  }
]
```

---

### 5. Add New Session
**POST** `/api/session/add`

Add a new WhatsApp session using an existing session string.

**Request Body:**
```json
{
  "sessionId": "KnightBot!...",
  "botName": "My Bot",
  "ownerName": "John Doe",
  "ownerNumber": "94770612011"
}
```

**Response:**
```json
{
  "success": true
}
```

---

### 6. Update Session Settings
**POST** `/api/session/update`

Update bot name, owner info, and settings for a session.

**Request Body:**
```json
{
  "sessionId": "qr_94770612011_1772940534398",
  "botName": "Updated Bot Name",
  "ownerName": "Jane Doe",
  "ownerNumber": "94770612011",
  "settings": {
    "prefix": ".",
    "autoRead": false,
    "autoTyping": false
  }
}
```

**Response:**
```json
{
  "success": true
}
```

---

### 7. Delete Session
**POST** `/api/session/delete`

Delete a WhatsApp bot session.

**Request Body:**
```json
{
  "sessionId": "qr_94770612011_1772940534398"
}
```

**Response:**
```json
{
  "success": true
}
```

---

### 8. Restart Session
**POST** `/api/session/restart`

Restart a WhatsApp bot session (useful for reconnecting).

**Request Body:**
```json
{
  "sessionId": "qr_94770612011_1772940534398"
}
```

**Response:**
```json
{
  "success": true
}
```

---

## QR Code & Pairing Endpoints

### 9. Generate QR Code
**GET** `/api/qr`

Generate a WhatsApp QR code for session login. After scanning, the bot automatically creates and activates the session.

**Query Parameters (optional):**
- `botName` - Name for the bot (default: "Infinity MD")
- `ownerName` - Owner name (default: from config)
- `ownerNumber` - Owner phone number (default: from config)

**Example:**
```
GET /api/qr?botName=MyBot&ownerName=John&ownerNumber=94770612011
```

**Response:**
```json
{
  "success": true,
  "qr": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "qrId": "qr_1772940534398_abc123"
}
```

---

### 10. Generate Pairing Code
**POST** `/api/pair`

Generate an 8-digit pairing code for devices without QR scanner capability.

**Request Body:**
```json
{
  "number": "94770612011",
  "botName": "My Bot",
  "ownerName": "John Doe",
  "ownerNumber": "94770612011"
}
```

**Response:**
```json
{
  "success": true,
  "code": "1234-5678",
  "pairId": "pair_1772940534398_xyz789"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Invalid phone number. Enter your full international number..."
}
```

---

## System Status Endpoints

### 11. Get Bot Status
**GET** `/api/status`

Get real-time information about the bot server.

**Response:**
```json
{
  "success": true,
  "status": "online",
  "uptime": 3600,
  "uptimeFormatted": "1h 0m",
  "memory": {
    "heapUsed": "125 MB",
    "heapTotal": "256 MB"
  },
  "activeSessions": 2,
  "timestamp": "2026-03-10T12:00:00.000Z"
}
```

---

## User Profile Endpoints

### 12. Get Current User Info
**GET** `/api/user-info`

Get information about the currently logged-in user.

**Response:**
```json
{
  "username": "your_username",
  "isOwner": false
}
```

---

## Settings Endpoints

### 13. Get User Settings
**GET** `/api/user-settings`

Get user-specific settings.

**Response:**
```json
{
  "theme": "dark",
  "notifications": true
}
```

---

### 14. Update User Settings
**POST** `/api/user-settings/update`

Update user-specific settings.

**Request Body:**
```json
{
  "theme": "light",
  "notifications": false
}
```

**Response:**
```json
{
  "success": true
}
```

---

### 15. Get Global Settings
**GET** `/api/global-settings`

Get global bot settings.

**Response:**
```json
{
  "botName": "Infinity MD",
  "prefix": ".",
  "autoRead": false,
  "autoTyping": false
}
```

---

### 16. Update Global Settings
**POST** `/api/global-settings/update`

Update global bot settings (admin only).

**Request Body:**
```json
{
  "botName": "My Bot",
  "prefix": "!",
  "autoRead": true,
  "autoTyping": true
}
```

**Response:**
```json
{
  "success": true
}
```

---

## Error Handling

All API endpoints return appropriate HTTP status codes:

- **200** - Success
- **400** - Bad Request (invalid parameters)
- **401** - Unauthorized (not logged in)
- **403** - Forbidden (insufficient permissions)
- **404** - Not Found (session/resource not found)
- **503** - Service Unavailable (server starting up)
- **500** - Internal Server Error

**Error Response Format:**
```json
{
  "success": false,
  "message": "Error description here"
}
```

---

## Common Use Cases

### Create a New Bot Session via QR Code
```
1. GET /api/qr?botName=MyBot&ownerName=John&ownerNumber=94770612011
2. Display the returned base64 QR image to user
3. User scans with phone
4. Session auto-created and becomes active
```

### Create a Bot Session via Pairing Code
```
1. POST /api/pair with phone number
2. Return 8-digit code to user
3. User enters code on WhatsApp device
4. Session auto-created and becomes active
```

### List All User's Bot Sessions
```
1. GET /api/sessions
2. Display session list with status
3. Each session can be updated, deleted, or restarted
```

### Monitor Bot Health
```
1. GET /api/status
2. Check uptime, memory usage, active sessions
3. Use for monitoring dashboards
```

---

## Session Cookie Authentication

After login, a secure session cookie is automatically set. This cookie is:
- HttpOnly (not accessible via JavaScript)
- Secure (HTTPS only in production)
- MaxAge: 24 hours

The cookie is automatically sent with all subsequent requests to protected endpoints.

---

## Rate Limiting

Currently no rate limiting is enforced, but it's recommended to implement:
- Max 10 login attempts per minute
- Max 5 QR generation requests per minute
- Max 5 pairing requests per minute

---

## Notes

- All phone numbers must be in international format (e.g., 94770612011, not +94770612011)
- Session IDs are unique identifiers for each WhatsApp bot instance
- QR codes expire after 60 seconds if not scanned
- Pairing codes expire after 2 minutes if not used
- The bot supports unlimited concurrent sessions
