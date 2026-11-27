package com.cricket;

import com.cricket.servlet.*;
import org.apache.catalina.Context;
import org.apache.catalina.LifecycleException;
import org.apache.catalina.connector.Connector;
import org.apache.catalina.startup.Tomcat;

import java.io.File;

/**
 * Entry point — starts an embedded Tomcat 10.1 server and registers all
 * servlets programmatically (no web.xml, no WAR, no external container).
 *
 * Run:
 *   java -jar target/cricket-universe-servlet.jar
 *
 * Then call the API, e.g.:
 *   curl http://localhost:8080/api/countries
 *   curl http://localhost:8080/api/views/all-players
 *   curl http://localhost:8080/api/procedures/list-players?teamId=csk
 *   curl http://localhost:8080/api/functions/all-players
 */
public class Main {

    private static final int PORT = 8080;

    public static void main(String[] args) throws LifecycleException {

        Tomcat tomcat = new Tomcat();
        tomcat.setPort(PORT);

        // Connector must be added explicitly when using embedded Tomcat without a server.xml
        Connector connector = new Connector();
        connector.setPort(PORT);
        tomcat.getService().addConnector(connector);

        // A minimal docBase is required even though we never serve static files
        String docBase = new File(".").getAbsolutePath();
        Context ctx = tomcat.addContext("", docBase);

        // Register each servlet with its URL pattern
        addServlet(tomcat, ctx, "CountryServlet",   new CountryServlet(),   "/api/countries/*");
        addServlet(tomcat, ctx, "LeagueServlet",    new LeagueServlet(),    "/api/leagues/*");
        addServlet(tomcat, ctx, "TeamServlet",      new TeamServlet(),      "/api/teams/*");
        addServlet(tomcat, ctx, "CricketerServlet", new CricketerServlet(), "/api/cricketers/*");
        addServlet(tomcat, ctx, "ViewServlet",      new ViewServlet(),      "/api/views/*");
        addServlet(tomcat, ctx, "ProcedureServlet", new ProcedureServlet(), "/api/procedures/*");
        addServlet(tomcat, ctx, "FunctionServlet",  new FunctionServlet(),  "/api/functions/*");

        tomcat.start();

        System.out.println("=======================================================");
        System.out.println("  Cricket Universe Servlet API");
        System.out.println("  Server started on http://localhost:" + PORT);
        System.out.println();
        System.out.println("  Endpoints:");
        System.out.println("    GET  /api/countries");
        System.out.println("    GET  /api/countries/{id}");
        System.out.println("    POST /api/countries          (JSON body)");
        System.out.println("    PUT  /api/countries/{id}     (JSON body)");
        System.out.println("    DELETE /api/countries/{id}");
        System.out.println();
        System.out.println("    Same pattern for /api/leagues, /api/teams, /api/cricketers");
        System.out.println();
        System.out.println("    GET /api/views/countries-leagues");
        System.out.println("    GET /api/views/teams-players");
        System.out.println("    GET /api/views/all-players");
        System.out.println();
        System.out.println("    GET /api/procedures/list-countries");
        System.out.println("    GET /api/procedures/list-leagues");
        System.out.println("    GET /api/procedures/list-teams");
        System.out.println("    GET /api/procedures/list-players");
        System.out.println("    GET /api/procedures/all-players-detail");
        System.out.println("    GET /api/procedures/cursor-role-totals");
        System.out.println("    GET /api/procedures/window-functions");
        System.out.println("    GET /api/procedures/analytics");
        System.out.println();
        System.out.println("    GET /api/functions/batting-average?runs=500&matches=20");
        System.out.println("    GET /api/functions/player-grade?runs=500&wickets=10&role=Allrounder");
        System.out.println("    GET /api/functions/player-label?name=Virat&role=Batsman&team=RCB");
        System.out.println("    GET /api/functions/all-players");
        System.out.println("=======================================================");

        tomcat.getServer().await();
    }

    private static void addServlet(Tomcat tomcat, Context ctx,
                                   String name, jakarta.servlet.Servlet servlet, String pattern) {
        Tomcat.addServlet(ctx, name, servlet);
        ctx.addServletMappingDecoded(pattern, name);
    }
}
