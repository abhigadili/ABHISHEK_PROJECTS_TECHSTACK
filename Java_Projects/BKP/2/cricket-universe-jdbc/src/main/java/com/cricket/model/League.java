package com.cricket.model;

public class League {
    private String id;
    private String countryId;
    private String countryName;
    private String name;
    private String format;
    private int    established;
    private String description;

    public League() {}

    public League(String id, String countryId, String name, String format, int established) {
        this.id          = id;
        this.countryId   = countryId;
        this.name        = name;
        this.format      = format;
        this.established = established;
    }

    public String getId()          { return id; }
    public String getCountryId()   { return countryId; }
    public String getCountryName() { return countryName; }
    public String getName()        { return name; }
    public String getFormat()      { return format; }
    public int    getEstablished() { return established; }
    public String getDescription() { return description; }

    public void setId(String id)               { this.id = id; }
    public void setCountryId(String c)         { this.countryId = c; }
    public void setCountryName(String c)       { this.countryName = c; }
    public void setName(String name)           { this.name = name; }
    public void setFormat(String format)       { this.format = format; }
    public void setEstablished(int e)          { this.established = e; }
    public void setDescription(String d)       { this.description = d; }

    @Override
    public String toString() {
        return String.format("%-25s %-35s %-12s %d  [%s]",
                id, name, format, established, countryName);
    }
}
