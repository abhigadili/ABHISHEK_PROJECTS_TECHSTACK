package com.example.notification.entity;

/** PENDING = waiting for first attempt or for a retry (see nextAttemptAt); SENT; FAILED = retries exhausted. */
public enum NotificationStatus { PENDING, SENT, FAILED }
