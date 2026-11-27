# NotificationDB – migrations owned by notification-service
Flyway: `services/notification-service/src/main/resources/db/migration/V1__create_notification_tables.sql`.
Pre-existing tables (never touched): `Notifications`, `Email_Logs`, `SMS_Logs`.
New tables: `sms_notifications`, `sms_inbox_messages`. Details: Documentation/07-Notification-Service.md, 13, 14.
