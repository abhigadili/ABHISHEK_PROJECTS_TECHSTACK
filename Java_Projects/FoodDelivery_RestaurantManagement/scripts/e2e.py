#!/usr/bin/env python3
"""
End-to-end verification of the whole platform THROUGH THE API GATEWAY (real HTTP, real Kafka, real MySQL/Redis/Elasticsearch).
No third-party packages needed (python3 standard library only).

    python3 scripts/e2e.py            # needs: scripts/start-all.sh already running
    E2E_SKIP_ELK=1 python3 scripts/e2e.py   # skip Elasticsearch/Kibana checks

Every check prints PASS/FAIL; exit code 1 if any check fails.
"""
import base64, hashlib, hmac, json, os, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = {}
with open(os.path.join(ROOT, ".env")) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            ENV[k] = v

GW = os.environ.get("GATEWAY", "http://localhost:9080")
ES = ENV.get("ELASTICSEARCH_URL", "http://localhost:9400")
KIBANA = os.environ.get("KIBANA_URL", "http://localhost:5601")
RUN = str(int(time.time()))[-7:]
passed, failed = 0, []


def check(name, cond, detail=""):
    global passed
    if cond:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed.append(name)
        print(f"  FAIL  {name}  {detail}")
    return cond


def call(method, path, body=None, token=None, headers=None, raw=False, base=GW, timeout=30):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
    if headers:
        h.update(headers)
    data = None if body is None else (body if isinstance(body, (bytes, str)) else json.dumps(body)).encode() if not isinstance(body, bytes) else body
    req = urllib.request.Request(base + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            txt = r.read().decode()
            js = json.loads(txt) if txt and not raw and txt.strip()[:1] in "{[" else txt
            return r.status, js, dict(r.headers)
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        try:
            js = json.loads(txt)
        except Exception:
            js = txt
        return e.code, js, dict(e.headers)


def wait_for(fn, timeout=40, every=1.0):
    end = time.time() + timeout
    last = None
    while time.time() < end:
        last = fn()
        if last:
            return last
        time.sleep(every)
    return last


def section(t):
    print(f"\n=== {t}")


def login(user, pwd):
    s, j, _ = call("POST", "/api/auth/login", {"usernameOrEmail": user, "password": pwd})
    return j["accessToken"], j["refreshToken"], j["user"] if s == 200 else (None, None, None)


def order_status(token, oid):
    s, j, _ = call("GET", f"/api/orders/{oid}", token=token)
    return j.get("status") if s == 200 else None


def wait_status(token, oid, wanted, timeout=40):
    return wait_for(lambda: order_status(token, oid) == wanted, timeout)


def kafka_produce_raw(topic, key, value):
    """Publishes a raw (possibly invalid) message with a throw-away Kafka client container on the HOST network
    (the broker advertises localhost:9392, which is not reachable from inside the broker container)."""
    return subprocess.run(["docker", "run", "--rm", "-i", "--network", "host", "apache/kafka:3.9.0", "sh", "-c",
                           f"/opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9392 --topic {topic} "
                           "--property parse.key=true --property key.separator=:"],
                          input=f"{key}:{value}\n", capture_output=True, text=True, timeout=90)


def main():
    pwd = "Test@12345"
    admin_pwd = ENV.get("BOOTSTRAP_ADMIN_PASSWORD", "Admin@12345")

    # ------------------------------------------------------------------ 0 gateway basics
    section("0. Gateway, security basics")
    s, j, _ = call("GET", "/actuator/health", base=GW)
    check("gateway health UP", s == 200 and j.get("status") == "UP")
    s, j, _ = call("GET", "/api/orders/my")
    check("protected route without token -> 401", s == 401, f"{s} {j}")
    s, j, _ = call("GET", "/api/restaurants")
    check("public restaurant browse without token -> 200", s == 200, f"{s}")
    s, j, h = call("OPTIONS", "/api/restaurants", headers={"Origin": "http://localhost:4500", "Access-Control-Request-Method": "GET"})
    check("CORS preflight allowed for the Angular origin", s in (200, 204) and "access-control-allow-origin" in {k.lower() for k in h}, f"{s} {h}")
    s, j, h = call("GET", "/api/restaurants", headers={"X-Correlation-Id": "e2e-cid-" + RUN})
    check("correlation id echoed by gateway", h.get("X-Correlation-Id") == "e2e-cid-" + RUN, str(h))

    # ------------------------------------------------------------------ 1 registration / login
    section("1. Registration, login, refresh, logout, password flows (Scenario 1)")
    users = {}
    for key, role in (("cust", "CUSTOMER"), ("cust2", "CUSTOMER"), ("owner", "RESTAURANT_OWNER"), ("dp", "DELIVERY_PARTNER")):
        uname = f"{key}{RUN}"
        s, j, _ = call("POST", "/api/auth/register", {"username": uname, "email": f"{uname}@example.com", "password": pwd, "confirmPassword": pwd,
                                                      "fullName": f"{key.title()} Tester", "phone": "+919800000001", "role": role})
        check(f"register {role} ({key})", s == 201 and j.get("id"), f"{s} {j}")
        users[key] = {"username": uname, "id": j.get("id")}
    s, j, _ = call("POST", "/api/auth/register", {"username": "x" + RUN, "email": "bad", "password": "weak", "confirmPassword": "no", "fullName": "", "role": "CUSTOMER"})
    check("invalid registration -> 400 with field errors", s == 400 and j.get("details"), f"{s} {j}")
    s, j, _ = call("POST", "/api/auth/register", {"username": f"adm{RUN}", "email": f"adm{RUN}@example.com", "password": pwd, "confirmPassword": pwd, "fullName": "A", "role": "ADMIN"})
    check("self-registering ADMIN is refused", s in (400, 403), f"{s}")
    s, j, _ = call("POST", "/api/auth/register", {"username": users["cust"]["username"], "email": "dup@example.com", "password": pwd, "confirmPassword": pwd, "fullName": "D", "role": "CUSTOMER"})
    check("duplicate username -> 409", s == 409, f"{s}")
    s, j, _ = call("POST", "/api/auth/login", {"usernameOrEmail": users["cust"]["username"], "password": "Wrong@12345"})
    check("wrong password -> 401", s == 401, f"{s}")
    tok = {}
    for k in users:
        a, r, u = login(users[k]["username"], pwd)
        tok[k] = a
        users[k]["refresh"] = r
    check("logins return access tokens", all(tok.values()))
    s, j, _ = call("POST", "/api/auth/refresh", {"refreshToken": users["cust"]["refresh"]})
    check("refresh token rotation", s == 200 and j.get("accessToken"), f"{s} {j}")
    new_refresh = j.get("refreshToken")
    s, j2, _ = call("POST", "/api/auth/refresh", {"refreshToken": users["cust"]["refresh"]})
    check("re-using a rotated refresh token is rejected", s == 401, f"{s} {j2}")
    a, r, _ = login(users["cust"]["username"], pwd)
    tok["cust"] = a
    s, j, _ = call("POST", "/api/auth/forgot-password", {"email": f"{users['cust']['username']}@example.com"})
    reset_token = j.get("devResetToken") if s == 202 else None
    check("forgot-password accepted (dev token exposed only in sandbox)", s == 202 and reset_token, f"{s} {j}")
    s, j, _ = call("POST", "/api/auth/reset-password", {"token": reset_token, "newPassword": "Reset@12345"})
    check("reset-password works", s == 204, f"{s} {j}")
    s, j, _ = call("POST", "/api/auth/login", {"usernameOrEmail": users["cust"]["username"], "password": "Reset@12345"})
    check("login with the reset password", s == 200, f"{s}")
    s, j, _ = call("POST", "/api/auth/reset-password", {"token": reset_token, "newPassword": "Again@12345"})
    check("reset token is single-use", s == 400, f"{s}")
    s, j, _ = call("POST", "/api/auth/change-password", {"currentPassword": "Reset@12345", "newPassword": pwd}, token=tok["cust"])
    # tokens issued before the reset are still valid for this call; password policy applies
    check("change-password works", s == 204, f"{s} {j}")
    a, r, u = login(users["cust"]["username"], pwd)
    tok["cust"] = a
    s, j, _ = call("POST", "/api/auth/logout", {"refreshToken": r}, token=a)
    check("logout -> 204", s == 204, f"{s}")
    s, j, _ = call("GET", "/api/users/me", token=a)
    check("access token is revoked after logout (Redis deny-list)", s == 401, f"{s}")
    a, r, u = login(users["cust"]["username"], pwd)
    tok["cust"] = a
    # second customer + admin
    a, r, u = login(users["cust2"]["username"], pwd)
    tok["cust2"] = a
    adm, _, _ = login("superadmin", admin_pwd)
    check("bootstrap SUPER_ADMIN can log in", adm is not None)
    tok["admin"] = adm
    s, j, _ = call("GET", "/api/users?role=CUSTOMER", token=tok["cust"])
    check("customer cannot list users (403)", s == 403, f"{s}")
    s, j, _ = call("GET", "/api/admin/dashboard", token=tok["cust"])
    check("customer blocked from /api/admin at the gateway (403)", s == 403, f"{s}")
    s, j, _ = call("GET", "/api/users?role=CUSTOMER&size=5", token=adm)
    check("admin lists users", s == 200 and j.get("totalElements", 0) >= 2, f"{s}")

    # notifications from user.registered
    s, j, _ = wait_for(lambda: (lambda r: r if r[0] == 200 and r[1].get("totalElements", 0) >= 1 else None)(call("GET", "/api/notifications", token=tok["cust"])), 30) or (0, {}, {})
    check("Scenario 1: registration notification delivered via Kafka", s == 200 and any("Welcome" in n["title"] for n in j.get("content", [])), f"{s} {j}")

    # customer profile created from event + address
    s, j, _ = wait_for(lambda: (lambda r: r if r[0] == 200 else None)(call("GET", "/api/customers/me", token=tok["cust"])), 20) or (0, {}, {})
    check("customer profile exists", s == 200 and j.get("userId") == users["cust"]["id"], f"{s} {j}")
    addr = {"label": "Home", "line1": "12 MG Road", "city": "Bengaluru", "state": "KA", "postalCode": "560001", "latitude": 12.9716, "longitude": 77.5946, "makeDefault": True}
    s, a1, _ = call("POST", "/api/customers/me/addresses", addr, token=tok["cust"])
    check("add delivery address", s == 201 and a1.get("defaultAddress"), f"{s} {a1}")
    s, a2, _ = call("POST", "/api/customers/me/addresses", dict(addr, label="Work", line1="99 Residency Rd", makeDefault=False), token=tok["cust"])
    s, j, _ = call("PATCH", f"/api/customers/me/addresses/{a2['id']}/default", token=tok["cust"])
    check("switch default address", s == 200 and j.get("defaultAddress"), f"{s}")
    s, a3, _ = call("POST", "/api/customers/me/addresses", dict(addr, label="Cust2", line1="5 Church St"), token=tok["cust2"])

    # ------------------------------------------------------------------ 2 restaurant
    section("2. Restaurant registration and approval (Scenario 2)")
    rbody = {"name": f"Spice Route {RUN}", "description": "Biryani and North Indian classics", "category": "Casual Dining", "cuisines": ["Biryani", "North Indian"],
             "pureVeg": False, "phone": "+918000000001", "email": f"spice{RUN}@example.com", "addressLine": "1 Indiranagar Main", "city": "Bengaluru", "state": "KA",
             "postalCode": "560038", "latitude": 12.9784, "longitude": 77.6408, "minOrderAmount": 100, "deliveryFee": 30, "prepTimeMinutes": 20}
    s, rest, _ = call("POST", "/api/restaurants", rbody, token=tok["owner"])
    check("owner registers a restaurant (PENDING)", s == 201 and rest.get("status") == "PENDING", f"{s} {rest}")
    rid = rest.get("id")
    s, j, _ = call("GET", f"/api/restaurants/{rid}")
    check("pending restaurant is hidden from the public", s == 404, f"{s}")
    s, j, _ = call("POST", f"/api/restaurants/{rid}/approve", token=tok["owner"])
    check("owner cannot approve own restaurant (403)", s == 403, f"{s}")
    s, j, _ = call("POST", f"/api/restaurants/{rid}/approve", token=tok["admin"])
    check("admin approves the restaurant", s == 200 and j.get("status") == "APPROVED", f"{s} {j}")
    s, j, _ = call("PUT", f"/api/restaurants/{rid}/hours", {"hours": [{"dayOfWeek": d, "opensAt": "00:00:00", "closesAt": "23:59:00", "closed": False} for d in
                                                                  ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]]}, token=tok["owner"])
    check("owner sets opening hours", s == 200 and len(j.get("hours", [])) == 7, f"{s} {j}")
    s, j, _ = call("GET", f"/api/restaurants/{rid}")
    check("approved restaurant is public and open now", s == 200 and j.get("openNow") is True, f"{s} {j}")
    s, j, _ = call("GET", f"/api/restaurants?q=Spice&cuisine=Biryani")
    check("restaurant search finds it", s == 200 and any(r["id"] == rid for r in j.get("content", [])), f"{s}")
    s, j, _ = call("GET", "/api/restaurants/nearby?lat=12.97&lng=77.64&radiusKm=10")
    check("nearby restaurants", s == 200 and any(r["id"] == rid for r in j), f"{s}")
    s, j, _ = wait_for(lambda: (lambda r: r if r[0] == 200 and any(x["id"] == rid for x in r[1].get("restaurants", [])) else None)(call("GET", f"/api/search?q=spice%20route%20{RUN}")), 30) or (0, {}, {})
    check("search-service indexed the restaurant from restaurant.approved", s == 200 and any(x["id"] == rid for x in j.get("restaurants", [])), f"{s} {j}")
    s, j, _ = call("PATCH", f"/api/restaurants/{rid}/availability", {"open": True}, token=tok["owner"])

    # ------------------------------------------------------------------ 3 menu
    section("3. Menu management, cache invalidation, inventory setup (Scenario 3)")
    s, cat, _ = call("POST", f"/api/menu/restaurants/{rid}/categories", {"name": "Biryani", "displayOrder": 1}, token=tok["owner"])
    check("create menu category", s == 201, f"{s} {cat}")
    s, cat2, _ = call("POST", f"/api/menu/restaurants/{rid}/categories", {"name": "Beverages", "displayOrder": 2}, token=tok["owner"])
    s, m0, _ = call("GET", f"/api/menu/restaurants/{rid}")
    check("menu is empty at first (and cached)", s == 200 and m0.get("totalItems") == 0, f"{s} {m0}")
    s, item, _ = call("POST", f"/api/menu/restaurants/{rid}/items", {"categoryId": cat["id"], "name": "Chicken Biryani", "description": "Dum biryani", "basePrice": 250, "vegetarian": False,
                                                                  "prepTimeMinutes": 20, "variants": [{"name": "Half", "extraPrice": 0}, {"name": "Full", "extraPrice": 120}],
                                                                  "addOns": [{"name": "Raita", "price": 30}, {"name": "Extra Egg", "price": 20}]}, token=tok["owner"])
    check("create food item with variants and add-ons", s == 201 and len(item.get("variants", [])) == 2, f"{s} {item}")
    s, item2, _ = call("POST", f"/api/menu/restaurants/{rid}/items", {"categoryId": cat2["id"], "name": "Masala Chai", "basePrice": 60, "vegetarian": True}, token=tok["owner"])
    s, m1, _ = call("GET", f"/api/menu/restaurants/{rid}")
    check("Redis menu cache was invalidated: customers see the new items", s == 200 and m1.get("totalItems") == 2, f"{s} {m1}")
    s, other, _ = call("POST", f"/api/menu/restaurants/{rid}/items", {"categoryId": cat["id"], "name": "Hack", "basePrice": 1}, token=tok["cust"])
    check("customer cannot create menu items (403)", s == 403, f"{s}")
    s, j, _ = call("POST", "/internal/menu/validate", {}, token=tok["owner"])
    check("internal endpoints are not routed by the gateway", s in (401, 403, 404), f"{s}")
    s, j, _ = call("GET", f"/api/menu/items?restaurantId={rid}&q=biryani&vegetarian=false")
    check("menu item search/filter", s == 200 and j.get("totalElements") == 1, f"{s} {j}")
    # ingredients: exactly 2 portions of chicken biryani worth of rice
    s, rice, _ = call("POST", f"/api/inventory/restaurants/{rid}/ingredients", {"name": "Basmati rice", "unit": "kg", "quantity": 1.0, "lowStockThreshold": 0.3}, token=tok["owner"])
    check("create ingredient", s == 201, f"{s} {rice}")
    s, j, _ = call("PUT", f"/api/inventory/restaurants/{rid}/recipes/{item['id']}", {"lines": [{"ingredientId": rice["id"], "quantityPerPortion": 0.5}]}, token=tok["owner"])
    check("define recipe (0.5 kg per biryani)", s == 200, f"{s} {j}")
    s, j, _ = call("GET", f"/api/inventory/restaurants/{rid}/availability", token=tok["owner"])
    check("availability = 2 portions", s == 200 and j and j[0]["portionsAvailable"] == 2, f"{s} {j}")
    # coupons
    cc = "SAVE10" + RUN
    s, coupon, _ = call("POST", "/api/coupons", {"code": cc, "description": "10% off up to 50", "discountType": "PERCENTAGE", "discountValue": 10, "minOrderValue": 100, "maxDiscount": 50,
                                                  "validFrom": "2020-01-01T00:00:00Z", "validTo": "2035-01-01T00:00:00Z", "perUserLimit": 5}, token=tok["admin"])
    check("admin creates a coupon", s == 201, f"{s} {coupon}")
    s, j, _ = call("POST", "/api/coupons", {"code": "NOPE" + RUN, "discountType": "FIXED_AMOUNT", "discountValue": 5, "validFrom": "2020-01-01T00:00:00Z", "validTo": "2035-01-01T00:00:00Z"}, token=tok["owner"])
    check("non-admin cannot create coupons (403)", s == 403, f"{s}")
    s, j, _ = call("GET", "/api/coupons/public/active")
    check("public active coupons", s == 200 and any(c["code"] == cc for c in j), f"{s}")

    # ------------------------------------------------------------------ 4 cart
    section("4. Cart (Scenario 4)")
    cart_item = {"restaurantId": rid, "menuItemId": item["id"], "quantity": 1, "variant": "Full", "addOnIds": [item["addOns"][0]["id"]], "instructions": "less spicy"}
    s, cart, _ = call("POST", "/api/cart/items", cart_item, token=tok["cust"])
    check("add customised item to cart", s == 201 and cart.get("subtotal") == 400, f"{s} {cart}")  # 250+120+30
    s, cart, _ = call("POST", "/api/cart/items", cart_item, token=tok["cust"])
    check("same customisation merges into one line (qty 2)", cart["lines"][0]["quantity"] == 2 and len(cart["lines"]) == 1, f"{cart}")
    s, j, _ = call("POST", "/api/cart/items", {"restaurantId": 999999, "menuItemId": item["id"], "quantity": 1, "variant": "Full"}, token=tok["cust"])
    check("item/restaurant mismatch rejected", s in (400, 404, 409), f"{s} {j}")
    s, j, _ = call("POST", "/api/cart/items", {"restaurantId": rid, "menuItemId": item["id"], "quantity": 1}, token=tok["cust"])
    check("variant is mandatory for items that have variants", s == 400, f"{s} {j}")
    s, cart, _ = call("PATCH", f"/api/cart/items/{cart['lines'][0]['id']}", {"quantity": 1}, token=tok["cust"])
    check("update quantity", cart["lines"][0]["quantity"] == 1, f"{cart}")
    s, cart, _ = call("PUT", "/api/cart/coupon", {"code": cc}, token=tok["cust"])
    check("coupon applied by the backend (10% of 400, capped at 50 => 40)", s == 200 and cart.get("discount") == 40, f"{s} {cart}")
    exp_total = 400 - 40 + round((400 - 40) * 0.05, 2) + 30
    check("server-side totals (discount, 5% tax, delivery fee)", abs(cart["total"] - exp_total) < 0.01, f"{cart['total']} vs {exp_total}")
    s, j, _ = call("PUT", "/api/cart/coupon", {"code": "DOESNOTEXIST"}, token=tok["cust"])
    check("unknown coupon yields no discount", j.get("discount") == 0, f"{j}")
    s, cart, _ = call("PUT", "/api/cart/coupon", {"code": cc}, token=tok["cust"])
    s, j, _ = call("POST", "/api/cart/items", dict(cart_item, restaurantId=rid + 100000), token=tok["cust"])

    # ------------------------------------------------------------------ 5 happy path
    section("5. Place order, payment, restaurant, delivery, review (Scenarios 5,6,7)")
    # delivery partner goes online BEFORE the order is ready
    s, dpp, _ = wait_for(lambda: (lambda r: r if r[0] == 200 else None)(call("GET", "/api/delivery/me", token=tok["dp"])), 20) or (0, {}, {})
    # test hygiene: partners left online by earlier runs would be offered the job first -> suspend every other partner
    s, plist, _ = call("GET", "/api/delivery/partners", token=tok["admin"])
    for pr in (plist if s == 200 else []):
        if pr["userId"] != users["dp"]["id"] and not pr["suspended"]:
            call("PATCH", f"/api/delivery/partners/{pr['userId']}/suspended?value=true", token=tok["admin"])
    s, j, _ = call("PATCH", "/api/delivery/me/status", {"online": True}, token=tok["dp"])
    check("delivery partner goes online", s == 200 and j.get("availability") == "AVAILABLE", f"{s} {j}")
    s, j, _ = call("POST", "/api/orders", {"addressId": a2["id"], "paymentMethod": "CARD", "specialInstructions": "ring the bell"}, token=tok["cust2"])
    check("empty cart -> order refused", s == 400, f"{s} {j}")
    idem = "idem-" + RUN
    cid = "e2e-order-" + RUN
    os.makedirs(os.path.join(ROOT, ".run"), exist_ok=True)
    open(os.path.join(ROOT, ".run", "last-order-cid.txt"), "w").write(cid)
    s, order, h = call("POST", "/api/orders", {"addressId": a2["id"], "paymentMethod": "CARD", "specialInstructions": "ring the bell"}, token=tok["cust"],
                       headers={"Idempotency-Key": idem, "X-Correlation-Id": cid})
    check("place order -> PAYMENT_PENDING", s == 201 and order.get("status") == "PAYMENT_PENDING", f"{s} {order}")
    oid = order.get("id")
    check("order total equals the server-calculated cart total", abs(order["totalAmount"] - exp_total) < 0.01, f"{order.get('totalAmount')} vs {exp_total}")
    s, order_b, _ = call("POST", "/api/orders", {"addressId": a2["id"], "paymentMethod": "CARD"}, token=tok["cust"], headers={"Idempotency-Key": idem})
    check("idempotency key: retry returns the SAME order", s == 201 and order_b.get("id") == oid, f"{s} {order_b}")
    s, j, _ = call("GET", "/api/cart", token=tok["cust"])
    check("cart emptied by the order.created event", wait_for(lambda: call("GET", "/api/cart", token=tok["cust"])[1].get("lines") == [], 20), f"{j}")
    s, pay, _ = wait_for(lambda: (lambda r: r if r[0] == 200 else None)(call("GET", f"/api/payments/order/{oid}", token=tok["cust"])), 30) or (0, {}, {})
    check("Payment Service created the payment from order.created (sandbox flagged)", s == 200 and pay.get("status") == "PENDING" and pay.get("sandbox") is True, f"{s} {pay}")
    s, j, _ = call("POST", f"/api/payments/order/{oid}/pay", {"method": "CARD"}, token=tok["cust2"])
    check("another customer cannot pay my order (403)", s == 403, f"{s}")
    s, pay, _ = call("POST", f"/api/payments/order/{oid}/pay", {"method": "CARD", "paymentToken": "tok_success"}, token=tok["cust"], headers={"Idempotency-Key": "pay-" + idem})
    check("pay (SANDBOX provider)", s == 200 and pay.get("status") == "SUCCESS" and pay.get("transactionRef", "").startswith("SBX-"), f"{s} {pay}")
    s, pay2, _ = call("POST", f"/api/payments/order/{oid}/pay", {"method": "CARD", "paymentToken": "tok_success"}, token=tok["cust"], headers={"Idempotency-Key": "pay-" + idem})
    check("duplicate pay request: same result, no second charge", s == 200 and pay2.get("transactionRef") == pay.get("transactionRef"), f"{s} {pay2}")
    check("payment.success -> order CONFIRMED (Kafka saga)", wait_status(tok["cust"], oid, "CONFIRMED"), order_status(tok["cust"], oid))
    s, j, _ = call("POST", f"/api/orders/{oid}/accept", token=tok["cust"])
    check("customer cannot accept orders (403)", s == 403, f"{s}")
    s, j, _ = call("POST", f"/api/orders/{oid}/ready", token=tok["owner"])
    check("invalid transition CONFIRMED -> READY is refused (409)", s == 409 and j.get("code") == "INVALID_TRANSITION", f"{s} {j}")
    s, j, _ = call("POST", f"/api/orders/{oid}/accept", token=tok["owner"])
    check("restaurant accepts", s == 200 and j.get("status") == "RESTAURANT_ACCEPTED", f"{s} {j}")
    s, j, _ = call("POST", f"/api/orders/{oid}/prepare", token=tok["owner"])
    check("restaurant starts preparing", j.get("status") == "PREPARING", f"{s} {j}")
    s, j, _ = call("POST", f"/api/orders/{oid}/cancel", {"reason": "changed mind"}, token=tok["cust"])
    check("cancel after PREPARING is refused (409)", s == 409, f"{s} {j}")
    s, j, _ = call("POST", f"/api/orders/{oid}/ready", token=tok["owner"])
    check("order READY_FOR_PICKUP", j.get("status") == "READY_FOR_PICKUP", f"{s} {j}")
    # delivery assignment
    s, cur, _ = wait_for(lambda: (lambda r: r if r[0] == 200 and r[1] else None)(call("GET", "/api/delivery/me/current", token=tok["dp"])), 40) or (0, [], {})
    check("Scenario 7: delivery partner receives the assignment", s == 200 and cur and cur[0]["status"] == "ASSIGNED" and cur[0]["orderId"] == oid, f"{s} {cur}")
    did = cur[0]["id"] if cur else None
    s, j, _ = call("POST", f"/api/delivery/{did}/pickup", token=tok["dp"])
    check("cannot pick up before accepting (409)", s == 409, f"{s}")
    s, j, _ = call("POST", f"/api/delivery/{did}/accept", token=tok["dp"])
    check("partner accepts the delivery", s == 200 and j.get("status") == "ACCEPTED", f"{s} {j}")
    s, j, _ = call("POST", f"/api/delivery/{did}/pickup", token=tok["dp"])
    check("partner picks up", s == 200 and j.get("status") == "PICKED_UP", f"{s} {j}")
    check("delivery.picked-up -> order OUT_FOR_DELIVERY", wait_status(tok["cust"], oid, "OUT_FOR_DELIVERY"), order_status(tok["cust"], oid))
    s, j, _ = call("POST", f"/api/delivery/{did}/complete", token=tok["dp"])
    check("partner completes the delivery", s == 200 and j.get("status") == "DELIVERED", f"{s} {j}")
    check("delivery.completed -> order DELIVERED", wait_status(tok["cust"], oid, "DELIVERED"), order_status(tok["cust"], oid))
    s, hist, _ = call("GET", f"/api/orders/{oid}/history", token=tok["cust"])
    seq = [x["to"] for x in hist]
    check("full status history recorded", seq[:3] == ["CREATED", "PAYMENT_PENDING", "CONFIRMED"] and seq[-1] == "DELIVERED", f"{seq}")
    s, j, _ = call("GET", f"/api/orders/{oid}", token=tok["cust2"])
    check("other customers cannot read my order (403)", s == 403, f"{s}")
    s, inbox, _ = wait_for(lambda: (lambda r: r if r[0] == 200 and r[1].get("totalElements", 0) >= 1 else None)(call("GET", f"/api/restaurants/{rid}/inbox", token=tok["owner"])), 20) or (0, {}, {})
    check("restaurant inbox built from order.confirmed", s == 200 and any(o["orderId"] == oid for o in inbox.get("content", [])), f"{s} {inbox}")
    s, sales, _ = call("GET", f"/api/restaurants/{rid}/sales", token=tok["owner"])
    check("sales summary", s == 200 and sales.get("deliveredOrders", 0) >= 1, f"{s} {sales}")
    s, coupons, _ = wait_for(lambda: (lambda r: r if r[0] == 200 and r[1].get("content") and r[1]["content"][0]["usedCount"] >= 1 else None)(call("GET", "/api/coupons", token=tok["admin"])), 20) or (0, {}, {})
    check("coupon redeemed via order.confirmed (usage count incremented)", s == 200 and any(c["code"] == cc and c["usedCount"] >= 1 for c in coupons.get("content", [])), f"{coupons}")
    s, ing, _ = call("GET", f"/api/inventory/restaurants/{rid}/ingredients", token=tok["owner"])
    check("inventory consumed 0.5 kg for the delivered biryani", s == 200 and abs(ing[0]["quantity"] - 0.5) < 0.001, f"{ing}")
    # review
    s, j, _ = wait_for(lambda: (lambda r: r if r[0] == 200 and r[1] else None)(call("GET", "/api/reviews/reviewable", token=tok["cust"])), 30) or (0, [], {})
    check("order becomes reviewable after delivery.completed", s == 200 and any(x["orderId"] == oid for x in j), f"{s} {j}")
    s, j, _ = call("POST", "/api/reviews", {"orderId": oid, "restaurantRating": 5, "deliveryRating": 4, "comment": "Great biryani!", "itemRatings": [{"menuItemId": item["id"], "rating": 5}]}, token=tok["cust2"])
    check("another customer cannot review my order (403/400)", s in (400, 403), f"{s}")
    s, rev, _ = call("POST", "/api/reviews", {"orderId": oid, "restaurantRating": 5, "deliveryRating": 4, "comment": "Great biryani!", "itemRatings": [{"menuItemId": item["id"], "rating": 5}]}, token=tok["cust"])
    check("customer reviews the delivered order", s == 201, f"{s} {rev}")
    s, j, _ = call("POST", "/api/reviews", {"orderId": oid, "restaurantRating": 1}, token=tok["cust"])
    check("second review for the same order refused (409)", s == 409, f"{s}")
    r2 = wait_for(lambda: (lambda r: r if r[0] == 200 and r[1].get("ratingCount") == 1 else None)(call("GET", f"/api/restaurants/{rid}")), 30)
    check("restaurant rating aggregate updated from review.created", bool(r2) and abs(float(r2[1]["avgRating"]) - 5.0) < 0.01, f"{r2}")
    s, j, _ = call("GET", f"/api/reviews/summary/restaurant/{rid}")
    check("public review summary", s == 200 and j.get("count") == 1 and j.get("average") == 5.0, f"{s} {j}")
    s, perf, _ = wait_for(lambda: (lambda r: r if r[0] == 200 and r[1].get("ratingCount", 0) >= 1 else None)(call("GET", "/api/delivery/me/performance", token=tok["dp"])), 30) or (0, {}, {})
    check("delivery partner rating + performance", s == 200 and perf.get("completed") == 1 and abs(float(perf["rating"]) - 4.0) < 0.01, f"{s} {perf}")
    s, notes, _ = call("GET", "/api/notifications?size=50", token=tok["cust"])
    titles = [n["title"] for n in notes.get("content", [])]
    check("Scenario 5/6/7: customer notifications for the whole lifecycle", all(any(t in x for x in titles) for t in ("Payment confirmed", "Order confirmed", "Restaurant accepted", "Out for delivery", "Order delivered")), f"{titles}")
    s, notes, _ = call("GET", "/api/notifications?size=50", token=tok["owner"])
    check("restaurant owner got the NEW ORDER notification", any("New order" in n["title"] for n in notes.get("content", [])), f"{notes}")
    s, uc, _ = call("GET", "/api/notifications/unread-count", token=tok["cust"])
    check("unread counter", s == 200 and uc.get("unread", 0) > 0, f"{uc}")

    # ------------------------------------------------------------------ 6 failure scenarios
    section("6. Failure scenarios and compensation (Scenarios 8 + failure cases)")

    def new_order(customer_key, qty=1, token_for_cart=None, item_id=None, variant="Half"):
        t = tok[customer_key]
        if (item_id or item2["id"]) == item2["id"]:
            qty = max(qty, 2)          # the restaurant's minimum order is 100 and one chai costs 60
        call("DELETE", "/api/cart", token=t)
        s, c, _ = call("POST", "/api/cart/items", {"restaurantId": rid, "menuItemId": item_id or item2["id"], "quantity": qty, **({"variant": variant} if (item_id or item2["id"]) == item["id"] else {})}, token=t)
        if s != 201:
            return s, c
        aid = call("GET", "/api/customers/me/addresses", token=t)[1][0]["id"]
        return call("POST", "/api/orders", {"addressId": aid, "paymentMethod": "CARD"}, token=t)[:2]

    # a) payment failure
    s, o_fail = new_order("cust2", qty=2)
    check("order for payment-failure test created", s == 201, f"{s} {o_fail}")
    wait_for(lambda: call("GET", f"/api/payments/order/{o_fail.get('id')}", token=tok["cust2"])[0] == 200, 30)
    s, p, _ = call("POST", f"/api/payments/order/{o_fail['id']}/pay", {"paymentToken": "tok_fail"}, token=tok["cust2"])
    check("declined payment is FAILED", p.get("status") == "FAILED", f"{s} {p}")
    check("payment.failed -> order PAYMENT_FAILED", wait_status(tok["cust2"], o_fail["id"], "PAYMENT_FAILED"), order_status(tok["cust2"], o_fail["id"]))
    s, p, _ = call("POST", f"/api/payments/order/{o_fail['id']}/pay", {"paymentToken": "tok_success"}, token=tok["cust2"])
    check("a failed payment cannot be paid again (409)", s == 409, f"{s} {p}")
    # b) customer cancels unpaid order
    s, o_c = new_order("cust2", qty=1)
    wait_for(lambda: call("GET", f"/api/payments/order/{o_c.get('id')}", token=tok["cust2"])[0] == 200, 30)
    s, j, _ = call("POST", f"/api/orders/{o_c['id']}/cancel", {"reason": "ordered by mistake"}, token=tok["cust2"])
    check("customer cancels an unpaid order", s == 200 and j.get("status") == "CANCELLED", f"{s} {j}")
    check("pending payment cancelled by order.cancelled", wait_for(lambda: call("GET", f"/api/payments/order/{o_c['id']}", token=tok["cust2"])[1].get("status") == "CANCELLED", 30))
    s, j, _ = call("POST", f"/api/payments/order/{o_c['id']}/pay", {"paymentToken": "tok_success"}, token=tok["cust2"])
    check("cancelled payment cannot be paid (409)", s == 409, f"{s}")
    # c) restaurant rejection -> refund
    s, o_r = new_order("cust2", qty=1)
    wait_for(lambda: call("GET", f"/api/payments/order/{o_r.get('id')}", token=tok["cust2"])[0] == 200, 30)
    call("POST", f"/api/payments/order/{o_r['id']}/pay", {"paymentToken": "tok_success"}, token=tok["cust2"])
    wait_status(tok["cust2"], o_r["id"], "CONFIRMED")
    s, j, _ = call("POST", f"/api/orders/{o_r['id']}/reject", {"reason": "kitchen closed early"}, token=tok["owner"])
    check("restaurant rejects a paid order", s == 200 and j.get("status") == "REJECTED", f"{s} {j}")
    check("saga compensation: REJECTED -> REFUND_PENDING -> REFUNDED", wait_status(tok["cust2"], o_r["id"], "REFUNDED", 60), order_status(tok["cust2"], o_r["id"]))
    s, rf, _ = call("GET", f"/api/refunds/order/{o_r['id']}", token=tok["cust2"])
    check("Scenario 8: refund status available", s == 200 and rf.get("status") == "COMPLETED", f"{s} {rf}")
    s, notes, _ = call("GET", "/api/notifications?size=50", token=tok["cust2"])
    check("customer notified about rejection and refund", any("rejected" in n["title"].lower() for n in notes.get("content", [])) and any("Refund completed" in n["title"] for n in notes.get("content", [])), f"{[n['title'] for n in notes.get('content', [])]}")
    # d) paid order cancelled by customer -> refund
    s, o_p = new_order("cust2", qty=1)
    wait_for(lambda: call("GET", f"/api/payments/order/{o_p.get('id')}", token=tok["cust2"])[0] == 200, 30)
    call("POST", f"/api/payments/order/{o_p['id']}/pay", {"paymentToken": "tok_success"}, token=tok["cust2"])
    wait_status(tok["cust2"], o_p["id"], "CONFIRMED")
    s, j, _ = call("POST", f"/api/orders/{o_p['id']}/cancel", {"reason": "no longer hungry"}, token=tok["cust2"])
    check("customer cancels a PAID order", s == 200 and j.get("status") == "CANCELLED", f"{s} {j}")
    check("cancel -> refund -> REFUNDED", wait_status(tok["cust2"], o_p["id"], "REFUNDED", 60), order_status(tok["cust2"], o_p["id"]))
    # e) refund failure + admin retry
    s, o_x = new_order("cust2", qty=1)
    wait_for(lambda: call("GET", f"/api/payments/order/{o_x.get('id')}", token=tok["cust2"])[0] == 200, 30)
    call("POST", f"/api/payments/order/{o_x['id']}/pay", {"paymentToken": "tok_refund_fail"}, token=tok["cust2"])
    wait_status(tok["cust2"], o_x["id"], "CONFIRMED")
    call("POST", f"/api/orders/{o_x['id']}/cancel", {"reason": "refund failure test"}, token=tok["cust2"])
    rf = wait_for(lambda: (lambda r: r[1] if r[0] == 200 and r[1].get("status") == "FAILED" else None)(call("GET", f"/api/refunds/order/{o_x['id']}", token=tok["cust2"])), 40)
    check("refund failure is recorded (FAILED, order stays REFUND_PENDING)", bool(rf) and order_status(tok["cust2"], o_x["id"]) == "REFUND_PENDING", f"{rf} {order_status(tok['cust2'], o_x['id'])}")
    s, j, _ = call("POST", f"/api/refunds/{rf['id']}/retry", token=tok["owner"]) if rf else (0, {}, {})
    check("only PERM_REFUND_MANAGE may retry refunds (403)", s == 403, f"{s}")
    s, j, _ = call("POST", f"/api/refunds/{rf['id']}/retry", token=tok["admin"]) if rf else (0, {}, {})
    check("admin retries the failed refund", s == 200, f"{s} {j}")
    check("retry -> REFUNDED", wait_status(tok["cust2"], o_x["id"], "REFUNDED", 60), order_status(tok["cust2"], o_x["id"]))
    # f) duplicate payment callback (signed webhook)
    s, o_w = new_order("cust2", qty=1)
    wait_for(lambda: call("GET", f"/api/payments/order/{o_w.get('id')}", token=tok["cust2"])[0] == 200, 30)
    body = json.dumps({"providerEventId": "evt-" + RUN, "orderId": o_w["id"], "status": "SUCCESS", "transactionRef": "EXT-" + RUN})
    sig = hmac.new(ENV.get("PAYMENT_WEBHOOK_SECRET", ENV["JWT_SECRET"]).encode(), body.encode(), hashlib.sha256).hexdigest()
    s, j, _ = call("POST", "/api/payments/callback", body, headers={"X-Signature": "deadbeef"})
    check("webhook with a bad signature is rejected (401)", s == 401, f"{s} {j}")
    s, j, _ = call("POST", "/api/payments/callback", body, headers={"X-Signature": sig})
    check("signed webhook applied", s == 200 and j.get("applied") is True, f"{s} {j}")
    s, j, _ = call("POST", "/api/payments/callback", body, headers={"X-Signature": sig})
    check("duplicate payment callback acknowledged but NOT re-applied", s == 200 and j.get("duplicate") is True and j.get("applied") is False, f"{s} {j}")
    check("callback success -> order CONFIRMED", wait_status(tok["cust2"], o_w["id"], "CONFIRMED"), order_status(tok["cust2"], o_w["id"]))
    call("POST", f"/api/orders/{o_w['id']}/cancel", {"reason": "cleanup"}, token=tok["cust2"])
    # g) inventory shortage race: 1 kg left? we consumed 0.5 -> 0.5kg left = exactly one more biryani. Two orders pass pre-check, only one can be fulfilled.
    s, ing, _ = call("GET", f"/api/inventory/restaurants/{rid}/ingredients", token=tok["owner"])
    s, j, _ = call("POST", f"/api/inventory/ingredients/{ing[0]['id']}/adjust", {"newQuantity": 0.5, "reason": "e2e race setup"}, token=tok["owner"])
    check("inventory adjusted to exactly one portion", s == 200 and abs(j["quantity"] - 0.5) < 0.001, f"{s} {j}")
    orders_race = []
    for key in ("cust", "cust2"):
        s, o = new_order(key, qty=1, item_id=item["id"], variant="Half")
        check(f"race order placed by {key} (pre-check passes for both)", s == 201, f"{s} {o}")
        orders_race.append((key, o))
    for key, o in orders_race:
        wait_for(lambda: call("GET", f"/api/payments/order/{o.get('id')}", token=tok[key])[0] == 200, 30)
        call("POST", f"/api/payments/order/{o['id']}/pay", {"paymentToken": "tok_success"}, token=tok[key])
    time.sleep(4)
    final = {}
    for key, o in orders_race:
        wait_for(lambda: order_status(tok[key], o["id"]) in ("RESTAURANT_ACCEPTED", "REJECTED", "CONFIRMED", "REFUNDED"), 30)
    time.sleep(6)
    for key, o in orders_race:
        final[o["id"]] = order_status(tok[key], o["id"])
    vals = list(final.values())
    check("inventory shortage: exactly one order survives, the other is compensated (REJECTED->REFUNDED)",
          sum(1 for v in vals if v == "CONFIRMED") == 1 and sum(1 for v in vals if v in ("REJECTED", "REFUND_PENDING", "REFUNDED")) == 1, f"{final}")
    for key, o in orders_race:      # clean up whichever is still active
        if order_status(tok[key], o["id"]) == "CONFIRMED":
            call("POST", f"/api/orders/{o['id']}/cancel", {"reason": "cleanup"}, token=tok[key])

    # ------------------------------------------------------------------ 7 Kafka monitoring
    section("7. Kafka monitoring and event audit (Scenario 9)")
    s, topics, _ = call("GET", "/api/kafka/topics", token=tok["admin"])
    names = [t["name"] for t in topics] if s == 200 else []
    check("Kafka topics listed from the real broker", s == 200 and "order.created" in names and "payment.success" in names and "order.created.DLT" in names, f"{s} {names[:5]}")
    t = next((x for x in topics if x["name"] == "order.created"), {})
    check("topic metadata: partitions, retention, producers and consumers", t.get("partitions") == 3 and t.get("config", {}).get("retention.ms") and "order-service / OrderEventProducer" in t.get("producers", [])
          and any("PaymentEventConsumer" in c for c in t.get("consumers", [])), f"{t}")
    check("topic has consumer groups and a message count", len(t.get("consumerGroups", [])) >= 3 and t.get("messageCount", 0) > 0, f"{t.get('consumerGroups')} {t.get('messageCount')}")
    s, d, _ = call("GET", "/api/kafka/topics/order.created", token=tok["admin"])
    check("topic details with partition offsets", s == 200 and len(d.get("partitionDetails", [])) == 3 and d["partitionDetails"][0]["leader"] >= 0, f"{s}")
    s, msgs, _ = call("GET", "/api/kafka/topics/order.created/messages?limit=10", token=tok["admin"])
    check("messages read from the broker (key, offset, headers, masked payload)", s == 200 and msgs and msgs[0].get("eventId") and "X-Correlation-Id" in msgs[0].get("headers", {}), f"{s} {msgs[:1]}")
    s, groups, _ = call("GET", "/api/kafka/groups", token=tok["admin"])
    g = {x["groupId"]: x for x in groups} if s == 200 else {}
    check("consumer groups with state, members and lag (real offsets)", "order-service-group" in g and g["order-service-group"]["state"] and "totalLag" in g["order-service-group"], f"{s} {list(g)[:5]}")
    check("consumer lag drains to ~0", wait_for(lambda: all(x["totalLag"] <= 2 for x in call("GET", "/api/kafka/groups", token=tok["admin"])[1]), 30) is True)
    s, flow, _ = call("GET", "/api/kafka/flow", token=tok["admin"])
    edges = {(e["from"], e["to"]) for e in flow.get("edges", [])} if s == 200 else set()
    check("event flow: producer -> topic -> consumer from the real topology", ("svc:order-service", "topic:order.created") in edges and ("topic:order.created", "svc:payment-service") in edges, f"{len(edges)} edges")
    s, aud, _ = call("GET", f"/api/audit/events?role=CONSUMED&eventType=OrderCreated&size=50", token=tok["admin"])
    st = {(a["consumerService"], a["status"]) for a in aud.get("content", [])} if s == 200 else set()
    check("audit: consumers recorded PROCESSED for OrderCreated (payment-service, cart-service, customer-service)",
          {("payment-service", "PROCESSED"), ("cart-service", "PROCESSED"), ("customer-service", "PROCESSED")} <= st, f"{st}")
    s, pub, _ = call("GET", "/api/audit/events?role=PUBLISHED&topic=payment.success&size=5", token=tok["admin"])
    check("audit: published history with producer service, key and partition/offset", s == 200 and pub.get("content") and pub["content"][0]["producerService"] == "payment-service" and pub["content"][0]["offset"] is not None, f"{pub}")
    s, tr, _ = call("GET", f"/api/audit/trace/{cid}", token=tok["admin"])
    types = [x["eventType"] for x in tr] if s == 200 else []
    check("correlation id links the HTTP request to its Kafka events (request-to-event traceability)", "OrderCreated" in types and "OrderStatusUpdated" in types, f"{types}")
    s, stats, _ = call("GET", "/api/audit/stats", token=tok["admin"])
    check("audit statistics", s == 200 and stats.get("published", 0) > 10, f"{s} {stats}")
    s, j, _ = call("GET", "/api/kafka/topics", token=tok["cust"])
    check("Kafka monitoring is admin-only (403 for customers)", s == 403, f"{s}")
    s, j, _ = call("POST", "/api/kafka/publish-test?topic=order.created", {"userId": users["cust"]["id"], "title": "x", "message": "y"}, token=tok["admin"])
    check("test publish is limited to the approved topic list (400)", s == 400, f"{s} {j}")
    s, j, _ = call("POST", "/api/kafka/publish-test", {"userId": users["cust"]["id"], "title": "Admin test", "message": "Hello from the Kafka monitor"}, token=tok["admin"])
    check("admin publishes a test event", s == 202 and j.get("eventId"), f"{s} {j}")
    ev = j.get("eventId")
    s, notes, _ = wait_for(lambda: (lambda r: r if r[0] == 200 and any(n["title"] == "Admin test" for n in r[1].get("content", [])) else None)(call("GET", "/api/notifications", token=tok["cust"])), 30) or (0, {}, {})
    check("test event consumed by notification-service", s == 200 and any(n["title"] == "Admin test" for n in notes.get("content", [])), f"{s}")
    # poison message -> retries -> dead letter topic
    poison = "not-json-" + RUN
    r = kafka_produce_raw("payment.success", "k1", poison)
    check("poison message published for the DLT test", r.returncode == 0, r.stderr[:200])
    dl = wait_for(lambda: (lambda r: [a for a in r[1].get("content", []) if a["status"] == "DEAD_LETTERED"] if r[0] == 200 else None)(call("GET", "/api/audit/failed?size=50", token=tok["admin"])), 40)
    check("invalid event is validated, NOT retried forever, and dead-lettered (audit shows DEAD_LETTERED)", bool(dl), f"{dl}")
    s, dlts, _ = call("GET", "/api/kafka/dead-letters", token=tok["admin"])
    check("dead-letter topic holds the message", s == 200 and any(x["name"] == "payment.success.DLT" and x["messageCount"] >= 1 for x in dlts), f"{[(x['name'], x['messageCount']) for x in dlts if x['messageCount']]}")
    if dl:
        adm_name = "plainadmin" + RUN
        s, j, _ = call("POST", "/api/users/admins", {"username": adm_name, "email": adm_name + "@example.com", "password": pwd, "fullName": "Plain Admin", "superAdmin": False}, token=tok["admin"])
        check("SUPER_ADMIN creates a plain ADMIN account", s == 201, f"{s} {j}")
        plain, _, _ = login(adm_name, pwd)
        s, j, _ = call("POST", f"/api/audit/events/{dl[0]['id']}/replay", token=plain)
        check("replay needs PERM_KAFKA_REPLAY: a plain ADMIN gets 403", s == 403, f"{s}")
        s, j, _ = call("GET", "/api/kafka/topics", token=plain)
        check("a plain ADMIN can still monitor Kafka (KAFKA_MONITOR)", s == 200, f"{s}")
        s, j, _ = call("POST", f"/api/audit/events/{dl[0]['id']}/replay", token=tok["admin"])
        check("SUPER_ADMIN replays the dead-lettered original message (re-published with x-replay)", s == 200 and j.get("replayed") is True and j.get("replayCount") == 1, f"{s} {j}")
        s, j, _ = call("POST", f"/api/audit/events/{dl[0]['id']}/replay", token=tok["admin"])
        check("replay duplicate-protection: a 2nd replay within 30 s is refused (409)", s == 409 and j.get("code") == "REPLAY_TOO_SOON", f"{s} {j}")
    s, mon, _ = call("GET", "/api/monitoring/services", token=tok["admin"])
    up = {x["service"] for x in mon if x.get("status") == "UP"} if s == 200 else set()
    check("service health overview: all services UP with db/redis/kafka status", len(up) >= 15 and all(x.get("database") == "UP" for x in mon if x["service"] == "order-service"), f"{s} up={sorted(up)}")

    # ------------------------------------------------------------------ 8 caching + docs
    section("8. Redis caching, OpenAPI documentation")
    keys = subprocess.run(["docker", "exec", "food-redis", "redis-cli", "--scan", "--pattern", "food:*"], capture_output=True, text=True).stdout.split()
    check("Redis holds restaurant/menu cache keys", any(k.startswith("food:restaurant::") for k in keys) and any(k.startswith("food:menu::") for k in keys), f"{keys[:8]}")
    check("Redis holds revoked-token deny-list entries", bool(subprocess.run(["docker", "exec", "food-redis", "redis-cli", "--scan", "--pattern", "jwt:revoked:*"], capture_output=True, text=True).stdout.strip()))
    ttl = subprocess.run(["docker", "exec", "food-redis", "redis-cli", "ttl", f"food:restaurant::{rid}"], capture_output=True, text=True).stdout.strip()
    check("cache entries carry a TTL", ttl.lstrip("-").isdigit() and 0 < int(ttl) <= 600, ttl)
    s, j, _ = call("GET", "/docs/order/v3/api-docs")
    check("gateway serves the order-service OpenAPI document", s == 200 and "/api/orders" in json.dumps(j), f"{s}")
    s, j, _ = call("GET", "/swagger-ui.html", raw=True)
    check("gateway Swagger UI entry point", s in (200, 302), f"{s}")
    s, j, _ = call("GET", "/servlet/info", base="http://localhost:9106")
    check("Jakarta servlet (ServiceInfoServlet) answers inside Tomcat", s == 200 and j.get("servletApi") and j.get("sessionCreated") is False, f"{s} {j}")

    # ------------------------------------------------------------------ 9 logging
    if os.environ.get("E2E_SKIP_ELK"):
        print("\n(skipping ELK checks)")
    else:
        section("9. Centralised logging: Log4j2 -> Logstash -> Elasticsearch -> API (Scenario 10)")
        s, res, _ = wait_for(lambda: (lambda r: r if r[0] == 200 and r[1].get("total", 0) >= 4 else None)(call("GET", f"/api/logs/correlation/{cid}", token=tok["admin"])), 90, 3) or (0, {}, {})
        hits = res.get("hits", []) if isinstance(res, dict) else []
        services = {h.get("service") for h in hits}
        check("one correlation id is searchable across services in Elasticsearch", s == 200 and {"api-gateway", "order-service"} <= services, f"{s} total={res.get('total') if isinstance(res, dict) else res} services={services}")
        check("the same correlation id reaches payment-service through Kafka headers/envelope", "payment-service" in services, f"{services}")
        s, ov, _ = call("GET", "/api/logs/overview?minutes=120", token=tok["admin"])
        check("log overview by service/level", s == 200 and ov.get("total", 0) > 50 and ov.get("byService") and ov.get("byLevel"), f"{s}")
        s, er, _ = call("GET", "/api/logs/search?level=ERROR&size=5", token=tok["admin"])
        check("log search by level", s == 200 and "hits" in er, f"{s}")
        if hits:
            s, d, _ = call("GET", f"/api/logs/entry/{hits[0]['index']}/{hits[0]['id']}", token=tok["admin"])
            check("log entry detail", s == 200 and d.get("message"), f"{s}")
            tid = next((h["traceId"] for h in hits if h.get("traceId")), None)
            if tid:
                s, tr2, _ = call("GET", f"/api/logs/search?traceId={tid}", token=tok["admin"])
                check("search by trace id", s == 200 and tr2.get("total", 0) >= 1, f"{s}")
        s, j, _ = call("GET", "/api/logs/search", token=tok["cust"])
        check("logs are admin-only (403 for customers)", s == 403, f"{s}")
        s, j, _ = call("GET", "/api/logs/config", token=tok["admin"])
        check("Kibana link provided", s == 200 and j.get("kibanaUrl"), f"{s}")
        try:
            with urllib.request.urlopen(KIBANA + "/api/saved_objects/dashboard/fd-dashboard", timeout=10) as r:
                check("Kibana dashboard 'Food Delivery - Operations' exists", json.loads(r.read())["attributes"]["title"].startswith("Food Delivery"))
        except Exception as e:
            check("Kibana dashboard 'Food Delivery - Operations' exists", False, str(e))

    print(f"\n{passed} checks passed, {len(failed)} failed")
    for f in failed:
        print("  FAILED:", f)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
