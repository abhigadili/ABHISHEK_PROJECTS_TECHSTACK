package com.hospital.common.client;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** The minimal patient projection other services are allowed to see (no clinical data). */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PatientSummary {
    private Long id;
    private Long userId;
    private String fullName;
    private String email;
    private String phone;
    private String status;
}
