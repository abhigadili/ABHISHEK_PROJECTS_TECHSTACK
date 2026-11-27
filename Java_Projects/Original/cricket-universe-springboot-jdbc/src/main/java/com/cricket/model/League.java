package com.cricket.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public class League {

    // Not @NotBlank: on PUT the id comes from the URL path, not the request body.
    @Size(max = 60)
    private String id;

    @NotBlank
    @Size(max = 20)
    private String countryId;

    @NotBlank
    @Size(max = 200)
    private String name;

    private String description;
    private Integer established;

    @NotBlank
    private String format;

    private String trophy;
    private String image;
    private LocalDateTime createdAt;
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
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
