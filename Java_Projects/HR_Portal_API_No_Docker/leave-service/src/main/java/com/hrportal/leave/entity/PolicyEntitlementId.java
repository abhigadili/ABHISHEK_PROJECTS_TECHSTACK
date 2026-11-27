package com.hrportal.leave.entity;

import java.io.Serializable;
import java.util.Objects;

/** @IdClass composite key of LeavePolicyEntitlement: (policyId, leaveTypeId). */
public class PolicyEntitlementId implements Serializable {
    private String policyId;
    private String leaveTypeId;

    public PolicyEntitlementId() {
    }

    public PolicyEntitlementId(String policyId, String leaveTypeId) {
        this.policyId = policyId;
        this.leaveTypeId = leaveTypeId;
    }

    public String getPolicyId() {
        return policyId;
    }

    public String getLeaveTypeId() {
        return leaveTypeId;
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof PolicyEntitlementId that && Objects.equals(policyId, that.policyId) && Objects.equals(leaveTypeId, that.leaveTypeId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(policyId, leaveTypeId);
    }
}
