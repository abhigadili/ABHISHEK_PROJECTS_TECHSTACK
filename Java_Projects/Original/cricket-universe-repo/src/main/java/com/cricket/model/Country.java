package com.cricket.model;

public class Country {
    private String id;
    private String name;
    private String shortName;
    private String flag;
    private String board;
    private String captain;
    private String coach;
    private int    worldCupsWon;
    private int    established;

    public Country() {}

    public String getId()           { return id; }
    public String getName()         { return name; }
    public String getShortName()    { return shortName; }
    public String getFlag()         { return flag; }
    public String getBoard()        { return board; }
    public String getCaptain()      { return captain; }
    public String getCoach()        { return coach; }
    public int    getWorldCupsWon() { return worldCupsWon; }
    public int    getEstablished()  { return established; }

    public void setId(String id)                  { this.id = id; }
    public void setName(String name)              { this.name = name; }
    public void setShortName(String shortName)    { this.shortName = shortName; }
    public void setFlag(String flag)              { this.flag = flag; }
    public void setBoard(String board)            { this.board = board; }
    public void setCaptain(String captain)        { this.captain = captain; }
    public void setCoach(String coach)            { this.coach = coach; }
    public void setWorldCupsWon(int worldCupsWon){ this.worldCupsWon = worldCupsWon; }
    public void setEstablished(int established)   { this.established = established; }
}
