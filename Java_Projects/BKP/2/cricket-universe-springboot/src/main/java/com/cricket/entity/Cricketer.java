package com.cricket.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

@Entity
@Table(name = "cricketers")
public class Cricketer {

    @Id
    @Size(max = 100)
    @Column(name = "id", length = 100)
    private String id;

    @NotBlank
    @Size(max = 60)
    @Column(name = "team_id", length = 60, nullable = false)
    private String teamId;

    @NotBlank
    @Size(max = 100)
    @Column(name = "name", length = 100, nullable = false)
    private String name;

    @Column(name = "country", length = 100)
    private String country;

    @NotBlank
    @Column(name = "role", length = 30, nullable = false)
    private String role;

    @Column(name = "batting_style", length = 20, nullable = false)
    private String battingStyle;

    @Column(name = "bowling_style", length = 100)
    private String bowlingStyle;

    @Column(name = "age")
    private Integer age;

    @Column(name = "matches")
    private Integer matches;

    @Column(name = "runs")
    private Integer runs;

    @Column(name = "wickets")
    private Integer wickets;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "image", length = 255)
    private String image;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
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
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
