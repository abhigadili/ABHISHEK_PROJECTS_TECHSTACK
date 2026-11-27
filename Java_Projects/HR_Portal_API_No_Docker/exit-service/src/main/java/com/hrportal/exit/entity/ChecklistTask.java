package com.hrportal.exit.entity;

import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import lombok.NoArgsConstructor;

/** A plain checklist item the employee completes (hand over documents, update the leaver form ...). */
@Entity
@DiscriminatorValue("CHECKLIST")
@NoArgsConstructor
public class ChecklistTask extends ExitTask {
    @Override
    public String kind() {
        return "CHECKLIST";
    }
}
