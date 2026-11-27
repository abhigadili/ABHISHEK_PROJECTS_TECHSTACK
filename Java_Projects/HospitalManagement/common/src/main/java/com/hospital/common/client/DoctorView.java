package com.hospital.common.client;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class DoctorView {
    private Long id;
    private Long userId;
    private String fullName;
    private String email;
    private String phone;
    private String specialization;
    private BigDecimal consultationFee;
    private boolean active;
}
