package com.cricket.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public class Cricketer {

    // Not @NotBlank: on PUT the id comes from the URL path, not the request body.
    @Size(max = 100)
    private String id;

    @NotBlank
    @Size(max = 60)
    private String teamId;

    @NotBlank
    @Size(max = 100)
    private String name;

    private String country;

    @NotBlank
    private String role;

    private String battingStyle;
    private String bowlingStyle;
    private Integer age;
    private Integer matches;
    private Integer runs;
    private Integer wickets;
    private String description;
    private String image;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Cricketer() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTeamId() { return teamId; }
    public void setTeamId(String teamId) { this.teamId = teamId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getBattingStyle() { return battingStyle; }
    public void setBattingStyle(String battingStyle) { this.battingStyle = battingStyle; }

    public String getBowlingStyle() { return bowlingStyle; }
    public void setBowlingStyle(String bowlingStyle) { this.bowlingStyle = bowlingStyle; }

    public Integer getAge() { return age; }
    public void setAge(Integer age) { this.age = age; }

    public Integer getMatches() { return matches; }
    public void setMatches(Integer matches) { this.matches = matches; }

    public Integer getRuns() { return runs; }
    public void setRuns(Integer runs) { this.runs = runs; }

    public Integer getWickets() { return wickets; }
    public void setWickets(Integer wickets) { this.wickets = wickets; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
