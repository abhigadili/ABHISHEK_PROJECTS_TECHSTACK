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

    public String getId()           { return id; }
    public String getCountryId()    { return countryId; }
    public String getCountryName()  { return countryName; }
    public String getName()         { return name; }
    public String getFormat()       { return format; }
    public int    getEstablished()  { return established; }
    public String getDescription()  { return description; }

    public void setId(String id)              { this.id = id; }
    public void setCountryId(String c)        { this.countryId = c; }
    public void setCountryName(String c)      { this.countryName = c; }
    public void setName(String name)          { this.name = name; }
    public void setFormat(String format)      { this.format = format; }
    public void setEstablished(int e)         { this.established = e; }
    public void setDescription(String d)      { this.description = d; }
}
