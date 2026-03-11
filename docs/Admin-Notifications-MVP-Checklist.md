# Admin Notifications Checklist

Last updated: 2026-03-11

## Done

- [x] Send in-app notifications to selected users
- [x] Batch send to multiple users in one request
- [x] Support `type` and `category`
- [x] Support `action_url`
- [x] Support `expires_at`
- [x] Admin summary cards
- [x] Admin filters and detail table
- [x] Send job aggregation records
- [x] Read-rate analytics
- [x] Template-based sending
- [x] Failure tracking

## Current Scope

- Admin console page includes `Send`, `Jobs`, `Log`, `Analytics`, and `Templates`.
- Backend exposes summary, notification log, send jobs, delivery details, analytics, template CRUD, and send APIs.
- Delivery records are stored in dedicated `notification_send_jobs` and `notification_deliveries` tables.

## Notes

- The current implementation is for in-app notifications, not email delivery.
- Template variables support plain key-value objects and merge with built-in user variables.
- Future replay or multi-channel delivery can extend the existing send-job model.
