package com.hospital.common.events;

import java.util.List;

/** Central catalogue of Kafka topics. Dead-letter topics are "&lt;topic&gt;.DLT". */
public final class Topics {
    private Topics() {
    }

    public static final String PATIENT_REGISTERED = "hospital.patient.registered";
    public static final String APPOINTMENT_BOOKED = "hospital.appointment.booked";
    public static final String APPOINTMENT_CANCELLED = "hospital.appointment.cancelled";
    public static final String APPOINTMENT_RESCHEDULED = "hospital.appointment.rescheduled";
    public static final String APPOINTMENT_COMPLETED = "hospital.appointment.completed";
    public static final String LAB_TEST_REQUESTED = "hospital.lab.test-requested";
    public static final String LAB_REPORT_GENERATED = "hospital.lab.report-generated";
    public static final String PRESCRIPTION_CREATED = "hospital.prescription.created";
    public static final String BILLING_GENERATED = "hospital.billing.generated";
    public static final String PAYMENT_COMPLETED = "hospital.payment.completed";
    public static final String PAYMENT_FAILED = "hospital.payment.failed";
    public static final String MEDICINE_DISPENSED = "hospital.medicine.dispensed";
    public static final String NOTIFICATION_REQUESTED = "hospital.notification.requested";

    public static final List<String> ALL = List.of(PATIENT_REGISTERED, APPOINTMENT_BOOKED, APPOINTMENT_CANCELLED,
            APPOINTMENT_RESCHEDULED, APPOINTMENT_COMPLETED, LAB_TEST_REQUESTED, LAB_REPORT_GENERATED,
            PRESCRIPTION_CREATED, BILLING_GENERATED, PAYMENT_COMPLETED, PAYMENT_FAILED, MEDICINE_DISPENSED,
            NOTIFICATION_REQUESTED);
}
