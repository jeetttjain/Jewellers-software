# API Specification & Standard Response Wrapper

## 1. Base URL & Versioning
All backend endpoints are prefixed under:
`/api/v1`

## 2. Standard JSON Response Wrapper
Every response strictly conforms to the `ApiResponse<T>` interface:

### Success Response
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "jewellery-pos-api"
  },
  "meta": {
    "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "timestamp": "2026-08-12T12:00:00.000Z"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Gross weight must be greater than or equal to stone weight",
    "details": []
  },
  "meta": {
    "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "timestamp": "2026-08-12T12:00:00.000Z"
  }
}
```

## 3. Endpoints in Phase 0 Foundation

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/v1/health` | Service health status check | No |
