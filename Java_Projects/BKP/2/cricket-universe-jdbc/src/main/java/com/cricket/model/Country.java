package com.cricket.model;

public class Country {
    private String id;
    private String name;
    private String shortName;
    private String flag;
    private String board;
    private String captain;
    private String coach;
    private int worldCupsWon;
    private int established;

    public Country() {}

    public Country(String id, String name, String shortName, String flag,
                   String board, String captain, String coach,
                   int worldCupsWon, int established) {
        this.id           = id;
        this.name         = name;
        this.shortName    = shortName;
        this.flag         = flag;
        this.board        = board;
        this.captain      = captain;
        this.coach        = coach;
        this.worldCupsWon = worldCupsWon;
        this.established  = established;
    }

    // Getters
    public String getId()          { return id; }
    public String getName()        { return name; }
    public String getShortName()   { return shortName; }
    public String getFlag()        { return flag; }
    public String getBoard()       { return board; }
    public String getCaptain()     { return captain; }
    public String getCoach()       { return coach; }
    public int    getWorldCupsWon(){ return worldCupsWon; }
    public int    getEstablished() { return established; }

    // Setters
    public void setId(String id)                  { this.id = id; }
    public void setName(String name)              { this.name = name; }
    public void setShortName(String s)            { this.shortName = s; }
    public void setFlag(String flag)              { this.flag = flag; }
    public void setBoard(String board)            { this.board = board; }
    public void setCaptain(String captain)        { this.captain = captain; }
    public void setCoach(String coach)            { this.coach = coach; }
    public void setWorldCupsWon(int w)            { this.worldCupsWon = w; }
    public void setEstablished(int e)             { this.established = e; }

    @Override
    public String toString() {
        return String.format("%-15s %-25s %-5s %-30s WCs:%-2d  Captain: %s",
                id, name, shortName, board, worldCupsWon, captain);
    }
}
