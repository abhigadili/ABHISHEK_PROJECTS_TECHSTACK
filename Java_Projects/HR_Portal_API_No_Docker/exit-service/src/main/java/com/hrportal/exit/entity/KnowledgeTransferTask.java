package com.hrportal.exit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Knowledge-transfer item: a topic handed over to a named colleague. */
@Getter
@Setter
@Entity
@DiscriminatorValue("KT")
@NoArgsConstructor
public class KnowledgeTransferTask extends ExitTask {
    @Column(name = "kt_topic", length = 200)
    private String topic;
    @Column(name = "kt_transferee_id", length = 36)
    private String transfereeEmployeeId;

    @Override
    public String kind() {
        return "KT";
    }
}
