package com.cricket.model;

public class Team {
    private String id;
    private String leagueId;
    private String leagueName;
    private String name;
    private String captain;
    private String coach;
    private String homeGround;
    private int    titles;

    public Team() {}

    public Team(String id, String leagueId, String name, String captain, int titles) {
        this.id       = id;
        this.leagueId = leagueId;
        this.name     = name;
        this.captain  = captain;
        this.titles   = titles;
    }

    public String getId()          { return id; }
    public String getLeagueId()    { return leagueId; }
    public String getLeagueName()  { return leagueName; }
    public String getName()        { return name; }
    public String getCaptain()     { return captain; }
    public String getCoach()       { return coach; }
    public String getHomeGround()  { return homeGround; }
    public int    getTitles()      { return titles; }

    public void setId(String id)             { this.id = id; }
    public void setLeagueId(String l)        { this.leagueId = l; }
    public void setLeagueName(String l)      { this.leagueName = l; }
    public void setName(String name)         { this.name = name; }
    public void setCaptain(String captain)   { this.captain = captain; }
    public void setCoach(String coach)       { this.coach = coach; }
    public void setHomeGround(String h)      { this.homeGround = h; }
    public void setTitles(int titles)        { this.titles = titles; }

    @Override
    public String toString() {
        return String.format("%-25s %-30s Titles:%-3d  Captain: %s  [%s]",
                id, name, titles, captain, leagueName);
    }
}
