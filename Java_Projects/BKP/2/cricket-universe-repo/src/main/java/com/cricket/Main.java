package com.cricket;

import com.cricket.servlet.*;
import org.apache.catalina.Context;
import org.apache.catalina.LifecycleException;
import org.apache.catalina.connector.Connector;
import org.apache.catalina.startup.Tomcat;

import java.io.File;

/**
 * Application entry point — starts an embedded Tomcat 10.1 server.
 *
 * Architecture summary:
 *
 *   HTTP → Servlet → Service → Repository interface → JDBC impl → MySQL
 *
 *   Repository Pattern: Servlets depend only on Service classes.
 *   Service classes depend only on Repository interfaces, never on JDBC directly.
 *   JDBC implementations (in repository/impl/) can be swapped without touching
 *   any Service or Servlet code.
 *
 * Run: java -jar target/cricket-universe-repo.jar
 */
public class Main {

    private static final int PORT = 8081;   // 8081 to avoid conflict with cricket-universe-servlet

    public static void main(String[] args) throws LifecycleException {

        Tomcat tomcat = new Tomcat();
        tomcat.setPort(PORT);

        Connector connector = new Connector();
        connector.setPort(PORT);
        tomcat.getService().addConnector(connector);

        Context ctx = tomcat.addContext("", new File(".").getAbsolutePath());

        add(tomcat, ctx, "CountryServlet",   new CountryServlet(),   "/api/countries/*");
        add(tomcat, ctx, "LeagueServlet",    new LeagueServlet(),    "/api/leagues/*");
        add(tomcat, ctx, "TeamServlet",      new TeamServlet(),       "/api/teams/*");
        add(tomcat, ctx, "CricketerServlet", new CricketerServlet(), "/api/cricketers/*");
        add(tomcat, ctx, "ViewServlet",      new ViewServlet(),       "/api/views/*");
        add(tomcat, ctx, "ProcedureServlet", new ProcedureServlet(), "/api/procedures/*");
        add(tomcat, ctx, "FunctionServlet",  new FunctionServlet(),  "/api/functions/*");

        tomcat.start();

        System.out.println("=======================================================");
        System.out.println("  Cricket Universe — Repository Pattern REST API");
        System.out.println("  Server started on http://localhost:" + PORT);
        System.out.println();
        System.out.println("  Architecture: Servlet → Service → Repository → JDBC → MySQL");
        System.out.println();
        System.out.println("  CRUD (countries | leagues | teams | cricketers):");
        System.out.println("    GET    /api/{resource}        list");
        System.out.println("    GET    /api/{resource}/{id}   single");
        System.out.println("    POST   /api/{resource}        create (JSON body)");
        System.out.println("    PUT    /api/{resource}/{id}   update (JSON body)");
        System.out.println("    DELETE /api/{resource}/{id}   delete");
        System.out.println();
        System.out.println("  Query filters:");
        System.out.println("    /api/countries?search=india");
        System.out.println("    /api/leagues?countryId=ind&search=ipl");
        System.out.println("    /api/teams?leagueId=ipl");
        System.out.println("    /api/cricketers?teamId=csk&role=Batsman");
        System.out.println();
        System.out.println("  Views:");
        System.out.println("    GET /api/views/countries-leagues");
        System.out.println("    GET /api/views/teams-players");
        System.out.println("    GET /api/views/all-players");
        System.out.println();
        System.out.println("  Procedures:");
        System.out.println("    GET /api/procedures/list-countries");
        System.out.println("    GET /api/procedures/cursor-role-totals");
        System.out.println("    GET /api/procedures/window-functions");
        System.out.println("    GET /api/procedures/analytics");
        System.out.println();
        System.out.println("  Functions (UDFs):");
        System.out.println("    GET /api/functions/batting-average?runs=850&matches=20");
        System.out.println("    GET /api/functions/player-grade?runs=500&wickets=10&role=Allrounder");
        System.out.println("    GET /api/functions/all-players");
        System.out.println("=======================================================");

        tomcat.getServer().await();
    }

    private static void add(Tomcat t, Context ctx, String name,
                            jakarta.servlet.Servlet s, String pattern) {
        Tomcat.addServlet(ctx, name, s);
        ctx.addServletMappingDecoded(pattern, name);
    }
}
