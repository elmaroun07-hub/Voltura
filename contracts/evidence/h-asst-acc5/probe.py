"""H-ASST-ACC5 live accuracy test: the H-ASST-ACC4 question set against production."""
import json, subprocess, sys, time

API = "https://voltura-api.onrender.com"
SESSION = "probe-acc5-2026-10-24-9b6d5c1"
OUT = sys.argv[1]

L2 = {
    "es": ["¿Qué es Voltura?"] * 8 + [
        "¿Voltura calcula tarifas de inyección a la red?",
        "¿Voltura calcula el valor actual neto (VAN)?",
        "¿Voltura cumple la Ley de IA de la UE?",
    ],
    "en": ["What is Voltura?"] * 8 + [
        "Does Voltura calculate feed-in tariffs?",
        "Does Voltura calculate net present value (NPV)?",
        "Is Voltura EU AI Act compliant?",
    ],
}
L2S = {
    "es": ["¿Qué tiempo hace hoy en Madrid?", "Escríbame un poema sobre el mar.", "¿Qué marca de placas solares es la mejor?"],
    "en": ["What's the weather in Madrid today?", "Write me a poem about the sea.", "Which solar panel brand is best?"],
}


def curl(args, timeout=120):
    r = subprocess.run(["curl", "-sS", "-m", str(timeout), *args], capture_output=True, text=True)
    return r.stdout


def ask(lang, question, kind, idx):
    hdr = ["-H", "Content-Type: application/json", "-H", f"X-Session-Id: {SESSION}", "-H", f"Accept-Language: {lang}"]
    for attempt in range(6):
        created = curl(["-w", "\n%{http_code}", "-X", "POST", *hdr, "-d", json.dumps({"title": f"{kind}-{lang}-{idx}"}), f"{API}/api/conversations"])
        body, code = created.rsplit("\n", 1)
        if code == "201":
            conv = json.loads(body)["id"]
            break
        time.sleep(20)
    else:
        return {"lang": lang, "kind": kind, "q": question, "error": f"create {code} {body[:200]}"}
    for attempt in range(6):
        raw = curl(["-N", "-w", "\n__HTTP__%{http_code}", "-X", "POST", *hdr, "-d", json.dumps({"content": question}), f"{API}/api/conversations/{conv}/messages"])
        raw, code = raw.rsplit("\n__HTTP__", 1)
        if code == "200":
            break
        time.sleep(20)
    text, err = "", None
    for line in raw.splitlines():
        if line.startswith("data: "):
            ev = json.loads(line[6:])
            if "content" in ev:
                text += ev["content"]
            if "error" in ev:
                err = ev["error"]
    return {"lang": lang, "kind": kind, "q": question, "conv": conv, "status": code, "answer": text, "error": err,
            "at": time.strftime("%H:%M:%SZ", time.gmtime())}


results = []
plan = [(l, q, "L2", i) for l in ("es", "en") for i, q in enumerate(L2[l], 1)] + \
       [(l, q, "L2S", i) for l in ("es", "en") for i, q in enumerate(L2S[l], 1)]
for n, (lang, q, kind, i) in enumerate(plan, 1):
    r = ask(lang, q, kind, i)
    results.append(r)
    print(f"{n:2d} {kind} {lang} conv={r.get('conv')} status={r.get('status')} chars={len(r.get('answer',''))} err={r.get('error')}", flush=True)
    json.dump(results, open(OUT, "w"), ensure_ascii=False, indent=1)
    if n < len(plan):
        time.sleep(30)
