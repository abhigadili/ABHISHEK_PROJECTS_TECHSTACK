package com.cricket.model;

public class Cricketer {
    private String id;
    private String teamId;
    private String teamName;
    private String name;
    private String role;
    private String battingStyle;
    private String bowlingStyle;
    private int    age;
    private int    matches;
    private int    runs;
    private int    wickets;
    private String country;

    public Cricketer() {}

    public Cricketer(String id, String teamId, String name, String role, int runs, int wickets) {
        this.id      = id;
        this.teamId  = teamId;
        this.name    = name;
        this.role    = role;
        this.runs    = runs;
        this.wickets = wickets;
    }

    public String getId()           { return id; }
    public String getTeamId()       { return teamId; }
    public String getTeamName()     { return teamName; }
    public String getName()         { return name; }
    public String getRole()         { return role; }
    public String getBattingStyle() { return battingStyle; }
    public String getBowlingStyle() { return bowlingStyle; }
    public int    getAge()          { return age; }
    public int    getMatches()      { return matches; }
    public int    getRuns()         { return runs; }
    public int    getWickets()      { return wickets; }
    public String getCountry()      { return country; }

    public void setId(String id)               { this.id = id; }
    public void setTeamId(String t)            { this.teamId = t; }
    public void setTeamName(String t)          { this.teamName = t; }
    public void setName(String name)           { this.name = name; }
    public void setRole(String role)           { this.role = role; }
    public void setBattingStyle(String b)      { this.battingStyle = b; }
    public void setBowlingStyle(String b)      { this.bowlingStyle = b; }
    public void setAge(int age)                { this.age = age; }
    public void setMatches(int matches)        { this.matches = matches; }
    public void setRuns(int runs)              { this.runs = runs; }
    public void setWickets(int wickets)        { this.wickets = wickets; }
    public void setCountry(String country)     { this.country = country; }

    @Override
    public String toString() {
        return String.format("%-30s %-22s Runs:%-6d Wkts:%-4d M:%-4d [%s]",
                name, role, runs, wickets, matches, teamName);
    }
}
