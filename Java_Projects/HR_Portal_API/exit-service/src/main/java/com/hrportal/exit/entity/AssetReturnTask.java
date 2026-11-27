package com.hrportal.exit.entity;

import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Company asset to be returned (laptop, access card ...). */
@Getter
@Setter
@Entity
@DiscriminatorValue("ASSET")
@NoArgsConstructor
public class AssetReturnTask extends ExitTask {
    @Column(name = "asset_tag", length = 60)
    private String assetTag;
    @Column(name = "asset_condition", length = 40)
    private String assetCondition;
    private LocalDate returnedOn;

    @Override
    public String kind() {
        return "ASSET";
    }
}
