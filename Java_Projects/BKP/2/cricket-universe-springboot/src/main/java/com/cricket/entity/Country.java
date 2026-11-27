package com.cricket.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

@Entity
@Table(name = "countries")
public class Country {

    @Id
    @Size(max = 20)
    @Column(name = "id", length = 20)
    private String id;

    @NotBlank
    @Size(max = 100)
    @Column(name = "name", length = 100, nullable = false)
    private String name;

    @NotBlank
    @Size(max = 10)
    @Column(name = "short_name", length = 10, nullable = false)
    private String shortName;

    @Column(name = "flag", length = 20)
    private String flag;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "background", length = 255)
    private String background;

    @Column(name = "established")
    private Integer established;

    @Column(name = "world_cups_won")
    private Integer worldCupsWon;

    @Column(name = "board", length = 100)
    private String board;

    @Column(name = "coach", length = 100)
    private String coach;

    @Column(name = "captain", length = 100)
    private String captain;

    // Stored as MySQL JSON; kept as raw JSON text at the JPA layer to avoid
    // pulling in a third-party Hibernate JSON-type dependency for one column.
    @Column(name = "famous_players", columnDefinition = "json")
    private String famousPlayers;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
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
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
