package com.cricket.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

@Entity
@Table(name = "leagues")
public class League {

    @Id
    @Size(max = 60)
    @Column(name = "id", length = 60)
    private String id;

    @NotBlank
    @Size(max = 20)
    @Column(name = "country_id", length = 20, nullable = false)
    private String countryId;

    @NotBlank
    @Size(max = 200)
    @Column(name = "name", length = 200, nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "established")
    private Integer established;

    @NotBlank
    @Column(name = "format", length = 20, nullable = false)
    private String format;

    @Column(name = "trophy", length = 200)
    private String trophy;

    @Column(name = "image", length = 255)
    private String image;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public League() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCountryId() { return countryId; }
    public void setCountryId(String countryId) { this.countryId = countryId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Integer getEstablished() { return established; }
    public void setEstablished(Integer established) { this.established = established; }

    public String getFormat() { return format; }
    public void setFormat(String format) { this.format = format; }

    public String getTrophy() { return trophy; }
    public void setTrophy(String trophy) { this.trophy = trophy; }

    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
