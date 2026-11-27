package com.cricket.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public class Team {

    // Not @NotBlank: on PUT the id comes from the URL path, not the request body.
    @Size(max = 60)
    private String id;

    @NotBlank
    @Size(max = 60)
    private String leagueId;

    @NotBlank
    @Size(max = 200)
    private String name;

    private String captain;
    private String coach;
    private String homeGround;
    private Integer titles;
    private String logo;
    private String description;
    private LocalDateTime createdAt;
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
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
