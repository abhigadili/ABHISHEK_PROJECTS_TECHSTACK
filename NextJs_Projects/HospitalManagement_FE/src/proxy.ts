import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { AT_COOKIE, RT_COOKIE } from "@/lib/constants/auth";
import { AREA_ROLES } from "@/lib/constants/navigation";
import { ROLE_HOME, type RoleKey } from "@/lib/constants/rbac";

/**
 * Proxy (Next.js 16 successor of Middleware): request interception for NAVIGATION decisions only -
 *  1. verifies the access JWT (signature + exp) and silently refreshes it through POST /api/v1/auth/refresh (token rotation)
 *  2. redirects anonymous users to /login?next=, signed-in users away from /login, wrong-role users to /access-denied
 *  3. rewrites the friendly alias /dashboard -> role home, sets request-id/pathname headers, optional locale cookie from ?lang=
 * It is NOT the security boundary: every page guard, Server Action and Route Handler re-authenticates and re-authorizes.
 */
const secret = () => new TextEncoder().encode(process.env.JWT_ACCESS_SECRET ?? "");
async function roleOf(token?: string): Promise<RoleKey | null> {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, secret(), {
            issuer: "hms-fe",
            audience: "hms-api",
            algorithms: ["HS256"],
        });
        return payload.role as RoleKey;
    } catch {
        return null;
    }
}
const PUBLIC = [
    "/",
    "/about",
    "/hospitals",
    "/doctors",
    "/departments",
    "/contact",
    "/help",
    "/info",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/mfa",
    "/access-denied",
    "/api/v1/public",
    "/api/v1/auth",
    "/api/v1/health",
];
const isPublic = (p: string) => PUBLIC.some((x) => p === x || p.startsWith(`${x}/`));

export async function proxy(req: NextRequest) {
    const { pathname, search } = req.nextUrl;
    const headers = new Headers(req.headers);
    headers.set("x-request-id", crypto.randomUUID());
    headers.set("x-pathname", pathname);
    let role = await roleOf(req.cookies.get(AT_COOKIE)?.value);
    let setCookies: string[] = [];
    const rt = req.cookies.get(RT_COOKIE)?.value;
    if (!role && rt && !pathname.startsWith("/api/v1/auth")) {
        // silent refresh (rotating refresh token)
        const r = await fetch(new URL("/api/v1/auth/refresh", req.url), {
            method: "POST",
            headers: { cookie: req.headers.get("cookie") ?? "" },
            cache: "no-store",
        }).catch(() => null);
        if (r?.ok) {
            setCookies = r.headers.getSetCookie();
            const fresh = Object.fromEntries(setCookies.map((c) => c.split(";")[0].split("=") as [string, string]));
            headers.set(
                "cookie",
                [
                    ...req.cookies
                        .getAll()
                        .filter((c) => !(c.name in fresh))
                        .map((c) => `${c.name}=${c.value}`),
                    ...Object.entries(fresh).map(([k, v]) => `${k}=${v}`),
                ].join("; "),
            );
            role = await roleOf(fresh[AT_COOKIE]);
        }
    }
    const finish = (res: NextResponse) => {
        setCookies.forEach((c) => res.headers.append("set-cookie", c));
        const lang = req.nextUrl.searchParams.get("lang");
        if (lang && /^(en|hi|te)$/.test(lang)) res.cookies.set("hms_lang", lang, { path: "/", maxAge: 31536000 });
        return res;
    };

    if (pathname === "/dashboard")
        return finish(NextResponse.redirect(new URL(role ? ROLE_HOME[role] : "/login", req.url)));
    if (!role && !isPublic(pathname)) {
        if (pathname.startsWith("/api/"))
            return NextResponse.json(
                { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
                { status: 401 },
            );
        const url = new URL("/login", req.url);
        url.searchParams.set("next", pathname + search);
        return NextResponse.redirect(url);
    }
    if (role && (pathname === "/login" || pathname === "/register"))
        return finish(NextResponse.redirect(new URL(ROLE_HOME[role], req.url)));
    if (role)
        for (const [prefix, roles] of Object.entries(AREA_ROLES))
            if ((pathname === prefix || pathname.startsWith(prefix + "/")) && !roles.includes(role))
                return finish(NextResponse.redirect(new URL("/access-denied", req.url)));
    return finish(NextResponse.next({ request: { headers } }));
}
export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|icon.svg|images/|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|css|js|map|txt|xml)$).*)",
    ],
};
