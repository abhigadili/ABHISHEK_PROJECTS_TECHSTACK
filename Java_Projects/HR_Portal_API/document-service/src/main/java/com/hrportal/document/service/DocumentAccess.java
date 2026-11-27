package com.hrportal.document.service;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import org.springframework.stereotype.Component;

import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.security.AuthenticatedUser;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.document.entity.Document;
import com.hrportal.document.entity.DocumentCategory;
import com.hrportal.document.entity.DocumentPermission;
import com.hrportal.document.entity.Enums.AccessLevel;
import com.hrportal.document.entity.Enums.GranteeType;

/**
 * Document access rules, evaluated in this order: the owner always may; SUPER_ADMIN always may; a role listed in the CATEGORY's readRoles may
 * (so payroll / finance can read salary documents, HR the personal ones); finally an explicit, non-expired permission row granted to the
 * caller's employee id or one of the caller's roles. DOWNLOAD needs DOWNLOAD level, viewing metadata needs VIEW or DOWNLOAD.
 */
@Component
public class DocumentAccess {

    public boolean canRead(Document d, DocumentCategory c, List<DocumentPermission> grants, AccessLevel needed) {
        AuthenticatedUser me = CurrentUser.get().orElse(null);
        if (me == null) return false;
        if (d.getOwnerEmployeeId().equals(me.employeeId()) || me.roles().contains("SUPER_ADMIN")) return true;
        if (c != null && Arrays.stream(c.getReadRoles().split(",")).map(String::trim).anyMatch(me.roles()::contains)) return true;
        Instant now = Instant.now();
        return grants.stream().filter(g -> g.getExpiresAt() == null || g.getExpiresAt().isAfter(now)).filter(g -> needed == AccessLevel.VIEW || g.getAccessLevel() == AccessLevel.DOWNLOAD)
                .anyMatch(g -> g.getGranteeType() == GranteeType.EMPLOYEE ? g.getGranteeId().equals(me.employeeId()) : me.roles().contains(g.getGranteeId()));
    }

    public void requireRead(Document d, DocumentCategory c, List<DocumentPermission> grants, AccessLevel needed) {
        if (!canRead(d, c, grants, needed)) throw new ForbiddenOperationException("You do not have access to this document");
    }

    public boolean isOwner(Document d) {
        return d.getOwnerEmployeeId().equals(CurrentUser.employeeId());
    }
}
