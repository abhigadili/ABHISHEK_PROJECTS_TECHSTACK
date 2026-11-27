package com.cricket.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

@Entity
@Table(name = "teams")
public class Team {

    @Id
    @Size(max = 60)
    @Column(name = "id", length = 60)
    private String id;

    @NotBlank
    @Size(max = 60)
    @Column(name = "league_id", length = 60, nullable = false)
    private String leagueId;

    @NotBlank
    @Size(max = 200)
    @Column(name = "name", length = 200, nullable = false)
    private String name;

    @Column(name = "captain", length = 100)
    private String captain;

    @Column(name = "coach", length = 100)
    private String coach;

    @Column(name = "home_ground", length = 200)
    private String homeGround;

    @Column(name = "titles")
    private Integer titles;

    @Column(name = "logo", length = 255)
    private String logo;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Team() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getLeagueId() { return leagueId; }
    public void setLeagueId(String leagueId) { this.leagueId = leagueId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCaptain() { return captain; }
    public void setCaptain(String captain) { this.captain = captain; }

    public String getCoach() { return coach; }
    public void setCoach(String coach) { this.coach = coach; }

    public String getHomeGround() { return homeGround; }
    public void setHomeGround(String homeGround) { this.homeGround = homeGround; }

    public Integer getTitles() { return titles; }
    public void setTitles(Integer titles) { this.titles = titles; }

    public String getLogo() { return logo; }
    public void setLogo(String logo) { this.logo = logo; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
