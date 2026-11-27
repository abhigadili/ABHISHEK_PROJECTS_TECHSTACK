package com.cricket.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

/** Plain POJO mapped by hand in CountryRepositoryImpl's RowMapper — no JPA involved. */
public class Country {

    // Not @NotBlank: on PUT the id comes from the URL path, not the request body.
    @Size(max = 20)
    private String id;

    @NotBlank
    @Size(max = 100)
    private String name;

    @NotBlank
    @Size(max = 10)
    private String shortName;

    private String flag;
    private String description;
    private String background;
    private Integer established;
    private Integer worldCupsWon;
    private String board;
    private String coach;
    private String captain;

    // Stored as MySQL JSON; kept as raw JSON text since there is no ORM
    // layer here to translate it automatically.
    private String famousPlayers;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Country() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getShortName() { return shortName; }
    public void setShortName(String shortName) { this.shortName = shortName; }

    public String getFlag() { return flag; }
    public void setFlag(String flag) { this.flag = flag; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getBackground() { return background; }
    public void setBackground(String background) { this.background = background; }

    public Integer getEstablished() { return established; }
    public void setEstablished(Integer established) { this.established = established; }

    public Integer getWorldCupsWon() { return worldCupsWon; }
    public void setWorldCupsWon(Integer worldCupsWon) { this.worldCupsWon = worldCupsWon; }

    public String getBoard() { return board; }
    public void setBoard(String board) { this.board = board; }

    public String getCoach() { return coach; }
    public void setCoach(String coach) { this.coach = coach; }

    public String getCaptain() { return captain; }
    public void setCaptain(String captain) { this.captain = captain; }

    public String getFamousPlayers() { return famousPlayers; }
    public void setFamousPlayers(String famousPlayers) { this.famousPlayers = famousPlayers; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
