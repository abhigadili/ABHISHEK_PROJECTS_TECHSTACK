package com.hrportal.leave.entity;

import java.io.Serializable;
import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** @EmbeddedId of LeaveBalance: (employee, leave type, year). */
@Embeddable
public class LeaveBalanceId implements Serializable {
    @Column(name = "employee_id", length = 36)
    private String employeeId;
    @Column(name = "leave_type_id", length = 36)
    private String leaveTypeId;
    @Column(name = "balance_year")
    private int year;

    public LeaveBalanceId() {
    }

    public LeaveBalanceId(String employeeId, String leaveTypeId, int year) {
        this.employeeId = employeeId;
        this.leaveTypeId = leaveTypeId;
        this.year = year;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public String getLeaveTypeId() {
        return leaveTypeId;
    }

    public int getYear() {
        return year;
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof LeaveBalanceId that && year == that.year && Objects.equals(employeeId, that.employeeId)
                && Objects.equals(leaveTypeId, that.leaveTypeId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(employeeId, leaveTypeId, year);
    }
}
