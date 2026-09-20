# Ruling — B2-STEP0: measure the geocoder before touching it

**Date of probes:** 2026-09-19, 11:15Z–11:21Z. **Block type:** measurement only. **Status of this file:** uncommitted, untracked, written on whatever branch the working tree happened to be on (`heatshield/h-src-es` at the time). No source file was saved, nothing was committed, pushed, deployed, restarted or reconfigured.

Every claim below is followed by the command that produced it. Raw output is in Appendices A–D and is byte-for-byte what the tools returned, except where a section says otherwise.

---

## 0. Bottom line

1. **Matrix row that fired: `200 / 200` — "it self-healed".** Render returned `geocodeStatus: "resolved"` on both routes for all six real locations; the control returned 422 exactly as a genuine no-match should. Nominatim, queried directly with the byte-identical request, returned 200 with results for all six and `200 []` for the control. No 403, no 429, no timeout, in either half.
2. **The brief's premise does not hold against the record, and I am reporting that rather than measuring around it.** There is no evidence of eight days of continuous failure. The repo's own ruling (`contracts/rulings/h-opt-merge.md` at `b1f2c99`) records an outage of **about twelve minutes on 11 Sept (10:41Z–10:53:45Z)** that "healed itself", followed by four successful probes at 10:55Z. `b1f2c99` has been live since **11 Sept 10:57:35Z**, not 12 Sept. And Render's retained app log contains a **200 on `POST /api/calculate` at 2026-09-14T23:07:51Z**, which cannot be produced without a successful geocode. See §2.
3. **The evidence was not destroyed by this block.** Same container instance, same pid, and contiguous request ids (25 → 47) from 14 Sept through the end of my probing. No deploy exists after `b1f2c99`. See §5.
4. **Cause of the 11 Sept outage remains unresolved. Do not close the ticket.** One new datum, an inference not a finding: Render's deploy list shows two deploys (each of which would normally replace the container; I did not verify that Render does so here) finishing *inside* the 11 Sept outage window, and the outage persisted through both, then cleared at a moment no deploy touched. That does not fit "this container sits behind a bad egress IP". See §7.
5. **The absence of a log line is confirmed and is the reason this is undiagnosable.** 16 log lines in the probe window, all pino-http `request completed`. Nothing from the geocode path, including for the four 422s. See §5.

---

## 1. Production sha at probe time (0a)

```
$ date -u +"%Y-%m-%dT%H:%M:%SZ"; curl -s -i https://voltura-api.onrender.com/api/version
2026-09-19T11:15:28Z
HTTP/1.1 200 OK
Date: Sat, 19 Sep 2026 11:15:31 GMT
...
{"sha":"b1f2c99","shaFull":"b1f2c9934c9c708756a4a1a468a9f9b40740dd1f","source":"render"}
```

The block's web command returned **nothing**, because the sha is an HTML `<meta>` tag, not a response header, and `-I` sends HEAD:

```
$ curl -sI https://voltura-web.onrender.com | grep -i build-sha
(no output)
$ curl -s https://voltura-web.onrender.com | grep -n -i "build-sha"
12:    <!-- Substituted at build time by the voltura-build-sha plugin in vite.config.ts.
14:         curl -s https://voltura-web.onrender.com/ | grep build-sha -->
15:    <meta name="build-sha" content="b1f2c99" />
```

Both services are at `b1f2c99`. Premise check on the sha: **holds**. The block's `0a` web command is wrong as written (HEAD vs GET); the page's own comment gives the working form.

Also confirmed independently of the sha: the most recent entry in Render's deploy list is the `b1f2c99` deploy (Appendix C), so nothing has deployed since.

---

## 2. Premise check against the repository record (not in the block; found while measuring)

The brief says: *"Production has been at b1f2c99 since 12 Sept and every location has returned 422 geocode_failed since 10 Sept. Eight days of a reproducible failure."*

| Brief says | Record says | Source |
|---|---|---|
| Production at `b1f2c99` since 12 Sept | Deploy `dep-dahtspdg1s2s73d8cj20`, `startedAt 2026-09-11T10:56:37Z`, `finishedAt 2026-09-11T10:57:35Z`, `status: live` | `list_deploys`, Appendix C |
| 422 since 10 Sept | 10 Sept was a *working* day: "It worked in production yesterday" — two live 200s at `c459b0d` (Gate H1). First failure observed **2026-09-11T10:41Z** | `h-opt-merge.md` §"It is not this block", row 4 |
| Eight days, reproducible | "Outage window: roughly 10:41Z to 10:53Z, about twelve minutes ... ending with no intervention." Recovered at **10:53:45Z**; four probes at 10:55Z all `HTTP 200`, `geocodeStatus: "resolved"` | `h-opt-merge.md` §"Resolved — it was transient", and the `b1f2c99` commit message |
| — | A `POST /api/calculate` returned **200 in 819 ms at 2026-09-14T23:07:51Z**, preceded by an `OPTIONS /api/calculate` 204 one second earlier (a browser preflight). A 200 from that route is only reachable through `resolved.ok === true`, i.e. a successful geocode | Render app log, §5 table |
| — | Probed today, six real locations, both routes: all resolve | §4 |

The four strings the brief calls "the exact strings that failed on 10 Sept" (Paris, Madrid, Almeria, Berlin) are the strings that failed on **11 Sept**, in that twelve-minute window.

**I cannot see where "eight days" came from.** If it is an observation of the live site (a UI, another operator's probe), I have not seen it and it conflicts with everything above; I would need the date, the location string and the response body. If it is a carry-over from the 11 Sept ruling, it overstates the duration by a factor of roughly 960 (eight days against twelve minutes). I am not asserting which.

The commit message the outage is recorded in, verbatim from git:

```
$ git show -s --format=%B b1f2c99
contract: H-OPT merge ruling — the four live probes, and the geocoder recovered

Probes at 10:55Z against 4afdf95, 5000 kWh/year and one identical 24h pattern:
Tetouan 3.371 kWp / 5.08, Fuengirola 3.391 / 5.05, Paris 4.935 / 3.47,
London 5.651 / 3.03. Battery 4.1 kWh at all four — it is sized from the night
load, which is identical across the runs. coverageTarget 1 everywhere, against
the old silent 100/100/88/40. All nasa-live, 2019-2023, twelve months.

London inverts the defect: the old output gave it the SMALLEST coverage at
40%, where the honest answer is a 67% LARGER array than Fuengirola.

The geocoder outage cleared itself at 10:53:45Z after ~12 minutes with no
redeploy — which weakens the fixed-bad-egress-IP explanation rather than
confirming it. Cause still not determinable from outside, for the reason the
ruling already records: the code keeps no status for it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

And the retry watch it refers to, verbatim from the ruling:

```
$ git show b1f2c99:contracts/rulings/h-opt-merge.md | sed -n '162,172p'
A retry watch ran `/api/calculate` every 90 seconds from 10:42:58Z. Seven consecutive
failures, then:

```
10:43:00Z attempt 1 -> still geocode_failed
...
10:52:13Z attempt 7 -> still geocode_failed
10:53:45Z attempt 8 -> GEOCODE RECOVERED
```

**Outage window: roughly 10:41Z to 10:53Z, about twelve minutes, beginning minutes after
```

**A discrepancy in that record, flagged not resolved.** The ruling says of the outage "No redeploy was performed". Render's deploy list shows two auto-deploys (doc-only pushes, `3fa864d` and `e165de5`) that *completed* at 10:46:45Z and 10:47:41Z — both inside the 10:41Z–10:53:45Z window. The ruling most plausibly meant "no operator-initiated redeploy", but container replacement did occur during the outage. That matters for §7.

---

## 3. The request `geocode()` makes (0b)

Read from `b1f2c99` with `git show`, not from the working tree, so no checkout and no file was opened for writing.

```
$ git show b1f2c99:artifacts/api-server/src/routes/routes.ts | nl -ba -v88 | sed -n '1,20p'
    88	// Geocode location string to lat/lon via Nominatim
    89	async function geocode(location: string): Promise<{ lat: number; lon: number; country: string } | null> {
    90	  try {
    91	    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1&addressdetails=1&accept-language=en`;
    92	    const res = await fetch(url, {
    93	      headers: { "User-Agent": "GreenEnergyCalculator/1.0" },
    94	      signal: AbortSignal.timeout(6000),
    95	    });
    96	    if (!res.ok) return null;
    97	    const data = (await res.json()) as any[];
    98	    if (!data.length) return null;
    99	    return {
   100	      lat: parseFloat(data[0].lat),
   101	      lon: parseFloat(data[0].lon),
   102	      country: data[0].address?.country ?? "",
   103	    };
   104	  } catch {
   105	    return null;
   106	  }
   107	}
```

The call site and what it does with `null`:

```
$ git show b1f2c99:artifacts/api-server/src/routes/routes.ts | nl -ba -v498 | sed -n '1,31p'
   498	  locationInput: string,
   499	): Promise<IrradianceResolved | IrradianceRejection> {
   500	  // A failure used to fall through to lat 45, lon 10 — northern Italy — and
   501	  // produce a complete, confident result computed from a location the user
   502	  // never asked about, with nothing on screen saying so. Some requests that
   503	  // used to "succeed" now fail here. That is the point.
   504	  const geo = await geocode(locationInput);
   505	  if (!geo) {
   506	    return {
   507	      ok: false,
   508	      status: 422,
   509	      body: {
   510	        message:
   511	          "We could not locate that place. Check the spelling, or try including the country - for example \"Madrid, Spain\".",
   512	        code: "geocode_failed",
   513	        field: "location",
   514	        // Provenance matters most at the moment a request cannot be served.
   515	        resolution: {
   516	          locationInput,
   517	          geocodeStatus: "failed",
   518	          lat: null,
   519	          lon: null,
   520	          irradianceSource: "not-reached",
   521	          irradiancePeriod: null,
   522	          nasaHttpStatus: "not-called",
   523	          nasaKeysRequested: [],
   524	          nasaKeysPresent: [],
   525	          irradianceMonthly: [],
   526	        },
   527	      },
   528	    };
```

`git grep -n "geocode(" b1f2c99 -- artifacts/api-server/src` (non-test): exactly two hits, the definition (line 89) and one call site (line 504).

| Question | Answer |
|---|---|
| Full URL template | `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1&addressdetails=1&accept-language=en` |
| User-Agent | `GreenEnergyCalculator/1.0` (exact) |
| Other headers set by the app | **None.** Only `User-Agent`. Anything else on the wire is the runtime's default (Node's `fetch`/undici), not set here |
| Timeout | `AbortSignal.timeout(6000)`: 6 s, total |
| Retry | **None.** `git show ... \| grep -i -E "retry\|p-retry\|cache"` finds no retry or cache in `routes.ts`; no `globalThis.fetch` override, undici dispatcher or proxy env handling anywhere in non-test `src` |
| Non-200 | `if (!res.ok) return null;` — confirmed, a bare `return null` |
| Empty array | `if (!data.length) return null;` — **same** `null` |
| Exception (timeout, DNS, TLS, JSON parse) | `catch { return null; }` — **same** `null`, exception discarded |
| Logging | **None** in the function |

Consequence, and the core of why this is undiagnosable: a 403, a 429, a 5xx, a timeout, a DNS failure, malformed JSON and a genuine "no such place" all become the identical `null`, then the identical `422 geocode_failed` with `geocodeStatus: "failed"`, and no line is written anywhere.

---

## 4. Live probes against Render (0c)

**Payload shapes were taken from source at `b1f2c99`** (`lib/db/src/schema/schema.ts:59` `calculationInputSchema`; `shared-routes.ts` optimize `input`):

- `POST /api/calculate` — header `X-Session-Id` required; body `{location, energyUsage, pvWattage, batteryCapacity}` (others default). Sent `energyUsage 5000, pvWattage 4000, batteryCapacity 10`.
- `POST /api/optimize` — no session header; `annualUsageKwh` 100–100,000, `energyPattern` 24 non-negative numbers. Sent `annualUsageKwh 5000`, twenty-four `1`s. This route is rate-limited to 10 per 15 min per IP; each location was sent once.

**Locations: seven, not eight.** The brief lists Paris, Madrid, Almeria, Berlin (4), Fuengirola, Tétouan (2) and one control = 7. Its "eight live responses / eight local probes" does not match its own list. I ran 7 locations × 2 routes = 14 live responses, and 7 local probes twice (curl and Node `fetch`) plus the control again as 0f. I did not invent an eighth location.

**Window:** Render 11:17:49Z → 11:18:24Z, then local 11:18:24Z → 11:18:51Z, contiguous in one script (`probe.mjs`), so the two halves are ~30 s apart, not minutes.

**Defect in my own probe, corrected.** In run 1 the Tétouan request reached Render with a raw `é` that my Windows `curl` passed in the ANSI code page. Render's own echo shows it: `"locationInput":"T�touan, Morocco"`. That is not the string under test, so **the two 422s for Tétouan in run 1 are a probe artifact and are not evidence about the geocoder.** I redid Tétouan with an ASCII-only JSON body (`Tétouan`) at 11:20:12Z, with the local probe immediately after at 11:20:18Z. Both runs are in the appendices; the redo is the valid one.

Key fields, extracted mechanically from the raw output by `extract.mjs` (Appendix D). The full bodies are in Appendix A (run 1) and Appendix B (Tétouan redo).

| Location | Route | HTTP | geocodeStatus | lat | lon | irradianceSource | nasaHttpStatus |
|---|---|---|---|---|---|---|---|
| Paris, France | calculate | 200 | resolved | 48.8535 | 2.3484 | nasa-live | 200 |
| Paris, France | optimize | 200 | resolved | 48.8535 | 2.3484 | nasa-live | 200 |
| Madrid, Spain | calculate | 200 | resolved | 40.4168 | -3.7035 | nasa-live | 200 |
| Madrid, Spain | optimize | 200 | resolved | 40.4168 | -3.7035 | nasa-live | 200 |
| Almeria, Spain | calculate | 200 | resolved | 36.8686 | -2.312 | nasa-live | 200 |
| Almeria, Spain | optimize | 200 | resolved | 36.8686 | -2.312 | nasa-live | 200 |
| Berlin, Germany | calculate | 200 | resolved | 52.5174 | 13.3951 | nasa-live | 200 |
| Berlin, Germany | optimize | 200 | resolved | 52.5174 | 13.3951 | nasa-live | 200 |
| Fuengirola, Spain | calculate | 200 | resolved | 36.5388 | -4.6234 | nasa-live | 200 |
| Fuengirola, Spain | optimize | 200 | resolved | 36.5388 | -4.6234 | nasa-live | 200 |
| Tétouan, Morocco (run 1, **bad bytes**) | both | 422 | failed | null | null | not-reached | not-called |
| Tétouan, Morocco (**redo, valid**) | calculate | 200 | resolved | 35.5698 | -5.3747 | nasa-live | 200 |
| Tétouan, Morocco (**redo, valid**) | optimize | 200 | resolved | 35.5698 | -5.3747 | nasa-live | 200 |
| Xqzzyvv, Nowhere (control) | both | 422 | failed | null | null | not-reached | not-called |

Because every real location resolved, and NASA answered `nasaHttpStatus 200` with a 12-value `irradianceMonthly` series each time, there is no geocode-succeeds/NASA-fails case in this data set; the fields that would separate the two faults show no fault of either kind. (The response's `nasaKeysRequested`/`nasaKeysPresent` arrays carry only three sample key names, `201901`–`201903`, so I am not asserting anything from them beyond that they match.)

---

## 5. Render logs (0d)

Service `srv-d8q8vumgvqtc73a1ik90`, workspace `tea-d7s87mv7f7vs73dg3eag`, via the Render MCP connector, with the workspace ID passed explicitly on each call (no `select_workspace`). All calls read-only: `list_logs`, `list_log_label_values`, `get_service`, `list_deploys`.

**Ordering note.** The block puts 0d before 0e. I ran 0e first, immediately after 0c, because the local/Render comparison is what decays and the log store does not.

**What the logs contain.** `list_logs`, `startTime 2026-09-19T11:17:40Z`, `endTime 11:21:00Z`, no text or level filter: **16 entries, `hasMore: false`.** All 16 have identical labels (`resource srv-d8q8vumgvqtc73a1ik90`, `instance srv-d8q8vumgvqtc73a1ik90-spf7z`, `level info`, `type app`) and every one is a pino-http `request completed` line. **There is no line from the geocode path**: not for the 200s, and not for the four 422s. `list_log_label_values label=type` over 21 Aug → 19 Sep returns only `["app"]`.

**That absence is a finding.** It is expected, and it is why a geocode failure has been undiagnosable: `geocode()` writes nothing (§3). The only trace of a geocode failure in production is a request-completed line whose status is 422 — the same line a typo produces.

Messages and timestamps below are verbatim; the tool's per-entry `id` and the repeated identical `labels` array are elided.

```
# list_logs, startTime 2026-08-21T00:00:00Z endTime 2026-09-19T11:17:00Z, direction forward, limit 10, NO filters
# -> 7 entries, hasMore:false. Everything Render retains for this service before the probe.
2026-09-14T23:07:50.099475003Z  {"level":30,"time":1789427270085,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":25,"method":"OPTIONS","url":"/api/calculate"},"res":{"statusCode":204},"responseTime":11,"msg":"request completed"}
2026-09-14T23:07:51.217336973Z  {"level":30,"time":1789427271217,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":26,"method":"POST","url":"/api/calculate"},"res":{"statusCode":200},"responseTime":819,"msg":"request completed"}
2026-09-16T11:29:07.03836498Z  {"level":30,"time":1789558147023,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":27,"method":"OPTIONS","url":"/api/history"},"res":{"statusCode":204},"responseTime":9,"msg":"request completed"}
2026-09-16T11:29:07.240753988Z  {"level":30,"time":1789558147240,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":28,"method":"GET","url":"/api/history"},"res":{"statusCode":200},"responseTime":117,"msg":"request completed"}
2026-09-18T13:14:17.965714112Z  {"level":30,"time":1789737257956,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":29,"method":"GET","url":"/robots.txt"},"res":{"statusCode":404},"responseTime":74,"msg":"request completed"}
2026-09-18T13:14:18.280387454Z  {"level":30,"time":1789737258280,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":30,"method":"GET","url":"/api/version"},"res":{"statusCode":200},"responseTime":110,"msg":"request completed"}
2026-09-19T11:15:31.302156701Z  {"level":30,"time":1789816531260,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":31,"method":"GET","url":"/api/version"},"res":{"statusCode":200},"responseTime":100,"msg":"request completed"}

# list_logs, startTime 2026-09-19T11:17:40Z endTime 2026-09-19T11:21:00Z, direction forward, limit 100, NO filters
# -> 16 entries, hasMore:false. Entries 32-45 are probe.mjs (run 1); 46-47 are probe-tetouan.mjs (redo).
2026-09-19T11:17:50.588703746Z  {"level":30,"time":1789816670588,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":32,"method":"POST","url":"/api/calculate"},"res":{"statusCode":200},"responseTime":1533,"msg":"request completed"}
2026-09-19T11:17:54.526987901Z  {"level":30,"time":1789816674526,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":33,"method":"POST","url":"/api/optimize"},"res":{"statusCode":200},"responseTime":3596,"msg":"request completed"}
2026-09-19T11:17:56.015255173Z  {"level":30,"time":1789816676014,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":34,"method":"POST","url":"/api/calculate"},"res":{"statusCode":200},"responseTime":1104,"msg":"request completed"}
2026-09-19T11:17:59.964875602Z  {"level":30,"time":1789816679964,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":35,"method":"POST","url":"/api/optimize"},"res":{"statusCode":200},"responseTime":3500,"msg":"request completed"}
2026-09-19T11:18:01.74842697Z  {"level":30,"time":1789816681748,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":36,"method":"POST","url":"/api/calculate"},"res":{"statusCode":200},"responseTime":1456,"msg":"request completed"}
2026-09-19T11:18:12.300844847Z  {"level":30,"time":1789816692300,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":37,"method":"POST","url":"/api/optimize"},"res":{"statusCode":200},"responseTime":10081,"msg":"request completed"}
2026-09-19T11:18:13.453004679Z  {"level":30,"time":1789816693452,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":38,"method":"POST","url":"/api/calculate"},"res":{"statusCode":200},"responseTime":768,"msg":"request completed"}
2026-09-19T11:18:17.597275751Z  {"level":30,"time":1789816697591,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":39,"method":"POST","url":"/api/optimize"},"res":{"statusCode":200},"responseTime":3667,"msg":"request completed"}
2026-09-19T11:18:18.734181881Z  {"level":30,"time":1789816698730,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":40,"method":"POST","url":"/api/calculate"},"res":{"statusCode":200},"responseTime":745,"msg":"request completed"}
2026-09-19T11:18:22.505413075Z  {"level":30,"time":1789816702505,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":41,"method":"POST","url":"/api/optimize"},"res":{"statusCode":200},"responseTime":3369,"msg":"request completed"}
2026-09-19T11:18:23.026201713Z  {"level":30,"time":1789816703023,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":42,"method":"POST","url":"/api/calculate"},"res":{"statusCode":422},"responseTime":177,"msg":"request completed"}
2026-09-19T11:18:23.406606251Z  {"level":30,"time":1789816703406,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":43,"method":"POST","url":"/api/optimize"},"res":{"statusCode":422},"responseTime":6,"msg":"request completed"}
2026-09-19T11:18:23.780208214Z  {"level":30,"time":1789816703779,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":44,"method":"POST","url":"/api/calculate"},"res":{"statusCode":422},"responseTime":58,"msg":"request completed"}
2026-09-19T11:18:24.095523658Z  {"level":30,"time":1789816704095,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":45,"method":"POST","url":"/api/optimize"},"res":{"statusCode":422},"responseTime":7,"msg":"request completed"}
2026-09-19T11:20:12.773162137Z  {"level":30,"time":1789816812772,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":46,"method":"POST","url":"/api/calculate"},"res":{"statusCode":200},"responseTime":751,"msg":"request completed"}
2026-09-19T11:20:17.658531066Z  {"level":30,"time":1789816817658,"pid":70,"hostname":"srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z","req":{"id":47,"method":"POST","url":"/api/optimize"},"res":{"statusCode":200},"responseTime":4395,"msg":"request completed"}
```

**Container continuity.** Request ids 25 → 47 are contiguous, same `pid 70`, same hostname `srv-d8q8vumgvqtc73a1ik90-65679bcd4f-spf7z`, one instance label across the whole query range. So it is the same process from 14 Sept 23:07Z through my last request. Nothing I ran restarted, replaced or redeployed it. (Ids 1–24 are not retrievable; see §7.)

**Two log-tool limitations, stated so no negative claim rests on them.** (a) A `statusCode` filter returned zero hits, and a `text` regex `statusCode.{1,3}422` also returned zero hits, **even though the four 422s at 11:18:23Z were in range** — so neither filter works on this service's logs, and I made no negative claim from a filtered query. The "nothing older than 14 Sept" statement rests on an *unfiltered* forward read from 21 Aug that returned exactly 7 entries before the probe. (b) That read starts at request id 25, 2026-09-14T23:07:50Z, although the tool documents a 30-day window. I cannot tell whether that is retention, or whether ids 1–24 were never logged.

**`get_service` (outbound IPs).** Fields returned: `autoDeploy yes / commit`, `branch main`, `plan starter`, `buildPlan starter`, `numInstances 1`, `region frankfurt`, `ipAllowList [{0.0.0.0/0, "everywhere"}]`, `openPorts [{10000, TCP}]`, `updatedAt 2026-09-11T10:57:35.616405Z`, `suspended not_suspended`. **It exposes no outbound IP field.** `ipAllowList` is *inbound*. I did not go into the dashboard, per the block. The egress IP is therefore unknown to me, both now and on 11 Sept.

---

## 6. The same request from this machine (0e, 0f)

Reconstruction of §3 exactly: same URL template with `encodeURIComponent` producing the query, same parameters in the same order, `User-Agent: GreenEnergyCalculator/1.0`, no other headers set. Encoding was done by `encodeURIComponent` inside Node (not by the shell), so `é` went out as `%C3%A9` and does not depend on my console code page.

Two forms, because "byte-identical" is only as good as the header set on the wire:

1. **curl**, the form the block specifies (`-i` added to capture headers).
2. **Node `fetch`** with `{headers: {"User-Agent": "GreenEnergyCalculator/1.0"}, signal: AbortSignal.timeout(6000)}` — the literal call from `geocode()`, so undici's default headers apply as they do on Render. Local Node is `v24.18.0` (printed by the probe); Render's runtime version was not checked.

Full status, headers and bodies: Appendix A (curl and Node, run 1) and Appendix B (Tétouan redo). Summary, extracted mechanically (Appendix D):

| Location | curl | first result (curl) | Node fetch | first result (Node) |
|---|---|---|---|---|
| Paris, France | 200 | n=1, 48.8534951, 2.3483915, France | 200 | n=1, 48.8588897, 2.3200410, France |
| Madrid, Spain | 200 | n=1, 40.4167820, -3.7035070, Spain | 200 | n=1, 40.4167820, -3.7035070, Spain |
| Almeria, Spain | 200 | n=1, 36.8685739, -2.3120282, Spain | 200 | n=1, 36.8685739, -2.3120282, Spain |
| Berlin, Germany | 200 | n=1, 52.5173885, 13.3951309, Germany | 200 | n=1, 52.5173885, 13.3951309, Germany |
| Fuengirola, Spain | 200 | n=1, 36.5388398, -4.6233974, Spain | 200 | n=1, 36.5388398, -4.6233974, Spain |
| Tétouan, Morocco | 200 | n=1, 35.5697958, -5.3746918, Morocco | 200 | n=1, 35.5697958, -5.3746918, Morocco |
| **Xqzzyvv, Nowhere (0e control)** | 200 | **`[]`**, `Content-Length: 2` | 200 | **`[]`** |
| **0f control, direct again** | 200 | **`[]`**, `Content-Length: 2` | — | — |

The four outcomes the block asks me to separate, for these probes: **200 with results — 6 of 7 locations, both methods. 200 with empty array — the control only, all three runs. 403/429 — none. Timeout/exception — none** (Node `fetch` completed in 208–1228 ms against a 6000 ms limit; curl 0.31–0.99 s).

**0f (control the control).** The control returns `200 []` from Nominatim directly, and Render returns `422 geocode_failed` for the same string. A genuine no-match therefore reaches the user as the same 422 as an outage — the identical response shape — which is the same conclusion as §3 from the other side. The blocked-vs-no-match comparison the block sets up has nothing to compare against today, because nothing is blocked.

---

## 7. Which row of the matrix fired

| Render (0c) | Local (0e) | Reading |
|---|---|---|
| 200 (all six real locations, both routes) | 200 with results (all six) | **Fired: "It self-healed. Record it, and treat the cause as unresolved rather than fixed. Do not close the ticket."** |

Rows 1–3 did not fire: Render did not 422 on any real location, local was never 403/429, and Nominatim resolves Madrid, Spain.

The block asks me to be honest about this row, so precisely:

- **What is established:** at 11:17–11:20Z on 19 Sept, the deployed container geocodes correctly through Nominatim, and a byte-identical request from a different origin gets the same answers. There is **no standing egress-IP block or User-Agent refusal today.**
- **What is not established:** why the 11 Sept outage happened, or whether it has recurred. A healthy probe in this minute says nothing about 10–12 Sept.
- **The "eight days" asset never existed in the record** (§2). What existed was a twelve-minute window on 11 Sept, already gone by 10:53:45Z, before `b1f2c99` even deployed.

**A weakening of the leading hypothesis, from the record (inference, not a finding).** The 11 Sept ruling's leading explanation was a bad egress IP behind the replaced container. Render's deploy list (Appendix C) shows the container was replaced *during* the outage: `3fa864d` finished 10:46:45Z and `e165de5` finished 10:47:41Z, and the retry watch kept failing across both until 10:53:45Z, a moment with no deploy activity (the next, `b1f2c99`, started 10:56:37Z). A per-container fixed-bad-IP explanation predicts the failure would *change* at a swap; it did not, and it *ended* when nothing changed. That fits a transient refusal — upstream, or a rate-limit window on a shared egress — better. It does not identify which. Egress IPs on Render are platform-level and not exposed to me, so I cannot say whether the two swaps changed the IP at all.

**What this does and does not decide for Step 1 and 2** (inference):

- It does **not** support making a gazetteer *primary* on this evidence: row 1 is not shown, and a standing origin-specific block is not shown. It does not support "fix the request shape" either: the request as written is being served, from two origins.
- A cache-and-throttle change **cannot be justified as a fix for the 11 Sept outage** by anything measured here, because the cause was never observed. If shipped, it would be a resilience measure whose necessity is unproven.
- The one thing every measurement above ran into is that `geocode()` discards status, body and exception (§3). Until it records *which* of the six failure modes occurred, the next outage will be as undiagnosable as this one, and any later "it works now" will be as inconclusive as this block's. That, not a cache or a gazetteer, is the smallest change that turns the next occurrence into evidence. That is a Step 1 decision and I have not made it.

---

## 8. What I am not sure about

1. **Where "eight days" came from** (§2). If there is an observation I have not seen, this ruling's reading of the premise is wrong for that observation.
2. **Whether the failure recurred between 11 Sept 10:58Z and 19 Sept.** The only retained evidence in that span is one 200 on 14 Sept. Log lines before 14 Sept 23:07Z are not retrievable, and I don't know why (retention, or never logged). A recurrence on 12, 13, 15–18 Sept would be invisible to me.
3. **Render's egress IP, then or now.** `get_service` has no field for it, and I did not use the dashboard. So I cannot test "the IP changed" directly, only infer around it.
4. **Whether I have the right cause class for 11 Sept.** "Transient refusal" is an inference from the deploy timing. It is compatible with Nominatim-side rate limiting of a shared IP, with a single Nominatim backend serving errors (the responses came from four different backends, `vhagar`, `dulcy`, `longma`, `poldi`), and with something I haven't thought of. I tested none of these.
5. **Nominatim is not deterministic for identical requests.** Paris returned `place_id 97620444` (48.8535, 2.3484) via curl and `place_id 97554783` (48.8589, 2.3200) via Node `fetch`, ~15 s apart. Render's own answer for Paris matches the curl one. The ~2 km difference is small, but it means "the geocoder returned X" is a sample, not a constant.
6. **Local Node version vs Render's.** I used local Node to reproduce undici's default headers. If Render's Node differs, the default header set could differ slightly. The app-set header (`User-Agent`) is exact.
7. **The 14 Sept 200 is inferred to be a real geocode success**, from the code path (`/api/calculate` 200 requires `resolved.ok`). I did not see its body or its location string.
8. **Invalid-UTF-8 input becomes `geocode_failed`.** My own artifact shows this: bytes that are not valid UTF-8 in `location` produce a 422 `geocode_failed` (with U+FFFD echoed), not a 400. I did not investigate it and it does not explain ASCII strings like "Paris, France". Noted as a real second route into the same error message.

---

## 9. Side effects of running this block (disclosed, not cleaned up)

The block says it changes nothing in code or deploys, and that is true. The probes it prescribes are ordinary API requests, and they are not free of effect:

- **6 successful `POST /api/calculate`** (Paris, Madrid, Almeria, Berlin, Fuengirola, Tétouan-redo) each go through `storage.createCalculation` on success, so **six rows were very likely written to the production `calculations` table**, all under `X-Session-Id: b2step0-probe-0000-4000-8000-000000000001`. I did not query the database to confirm. I have not deleted them: a deletion is a write to production and is your call. That session id is the handle if you want them removed.
- **6 successful `POST /api/optimize`** each made one paid LLM call (Groq).
- **Optimize rate limit (10 per 900 s):** I did not hit it. The `ratelimit` response headers across my 8 optimize requests read `remaining` = 9, 9, 9, 8, 9, 9, 8 (run 1) and 8 (redo), with `reset` = 900, 900, 900, 883, 900, 900, 867 and 791. **That is not a counter decrementing per request**, so I cannot say how many slots I used. It suggests the limiter's key varies between my requests (the service sits behind Cloudflare and Render's proxy). I did not investigate; it is an unexamined observation about a route that spends money, noted so it is not lost.
- **Nominatim:** 16 requests from this machine (7 curl + 7 Node `fetch` + the 0f control + the Tétouan redo), spaced ≥1.2 s; none refused.

---

## Appendix A — raw output, run 1 (`probe.mjs`, 11:17:49Z → 11:18:51Z)

Render `/api/calculate` and `/api/optimize` for all 7 strings, then local curl ×7, then local Node `fetch` ×7, then the 0f control. **The two Tétouan Render responses in this appendix are the bad-bytes artifact described in §4.** Contains full bodies and headers, unedited.

```
=== RENDER WINDOW START 2026-09-19T11:17:49.441Z

##### RENDER /api/calculate :: Paris, France

>>> [2026-09-19T11:17:49.444Z] curl -sS -i --max-time 100 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -X POST https://voltura-api.onrender.com/api/calculate -H 'Content-Type: application/json' -H 'X-Session-Id: b2step0-probe-0000-4000-8000-000000000001' --data-binary '{"location":"Paris, France","energyUsage":5000,"pvWattage":4000,"batteryCapacity":10}'
HTTP/1.1 200 OK
Date: Sat, 19 Sep 2026 11:17:50 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
access-control-allow-origin: https://voltura-web.onrender.com
cf-cache-status: DYNAMIC
etag: W/"e95-Dez/J7OGmSAut2ZvAWrhlAZFe8g"
rndr-id: 0aa696de-69c6-47fa
Server: cloudflare
vary: Origin
vary: Accept-Encoding
x-powered-by: Express
x-render-origin-server: Render
CF-RAY: a3d82fa55f21189a-MRS
alt-svc: h3=":443"; ma=86400

{"savingsKwh":2921,"co2Reduction":243,"annualSavingsEur":730.33,"carbonIntensity":0.083,"avgIrradiance":3.47,"irradianceSource":"nasa-live","recommendation":"Your system offsets 58% of your energy usage, saving €730/year. Consider increasing PV capacity to 6000W for better coverage.","breakdown":{"solar":58,"battery":0,"grid":42},"monthlyData":[{"month":1,"name":"Jan","generationKwh":88.8,"consumptionKwh":583.9,"savingsKwh":88.8,"gridImportKwh":495.1,"co2Kg":7.4},{"month":2,"name":"Feb","generationKwh":173.9,"consumptionKwh":494.9,"savingsKwh":173.2,"gridImportKwh":321.6,"co2Kg":14.4},{"month":3,"name":"Mar","generationKwh":306.1,"consumptionKwh":493.1,"savingsKwh":297.6,"gridImportKwh":195.6,"co2Kg":24.7},{"month":4,"name":"Apr","generationKwh":438.2,"consumptionKwh":405.8,"savingsKwh":403.9,"gridImportKwh":2,"co2Kg":33.5},{"month":5,"name":"May","generationKwh":534.7,"consumptionKwh":353.6,"savingsKwh":353.6,"gridImportKwh":0,"co2Kg":29.3},{"month":6,"name":"Jun","generationKwh":559.9,"consumptionKwh":290.3,"savingsKwh":290.3,"gridImportKwh":0,"co2Kg":24.1},{"month":7,"name":"Jul","generationKwh":569.1,"consumptionKwh":282.9,"savingsKwh":282.9,"gridImportKwh":0,"co2Kg":23.5},{"month":8,"name":"Aug","generationKwh":466.1,"consumptionKwh":294.9,"savingsKwh":294.9,"gridImportKwh":0,"co2Kg":24.5},{"month":9,"name":"Sep","generationKwh":359.1,"consumptionKwh":332.3,"savingsKwh":332.3,"gridImportKwh":0,"co2Kg":27.6},{"month":10,"name":"Oct","generationKwh":213.9,"consumptionKwh":418.9,"savingsKwh":216,"gridImportKwh":202.9,"co2Kg":17.9},{"month":11,"name":"Nov","generationKwh":114,"consumptionKwh":489.6,"savingsKwh":114,"gridImportKwh":375.6,"co2Kg":9.5},{"month":12,"name":"Dec","generationKwh":73.8,"consumptionKwh":559.7,"savingsKwh":73.8,"gridImportKwh":485.9,"co2Kg":6.1}],"installationCostEur":9800,"paybackYears":12.3,"roiCurve":[{"year":0,"cumulativeSavings":0,"netPosition":-9800},{"year":1,"cumulativeSavings":730,"netPosition":-9070},{"year":2,"cumulativeSavings":1472,"netPosition":-8328},{"year":3,"cumulativeSavings":2224,"netPosition":-7576},{"year":4,"cumulativeSavings":2988,"netPosition":-6812},{"year":5,"cumulativeSavings":3763,"netPosition":-6037},{"year":6,"cumulativeSavings":4550,"netPosition":-5250},{"year":7,"cumulativeSavings":5348,"netPosition":-4452},{"year":8,"cumulativeSavings":6159,"netPosition":-3641},{"year":9,"cumulativeSavings":6981,"netPosition":-2819},{"year":10,"cumulativeSavings":7817,"netPosition":-1983},{"year":11,"cumulativeSavings":8664,"netPosition":-1136},{"year":12,"cumulativeSavings":9524,"netPosition":-276},{"year":13,"cumulativeSavings":10398,"netPosition":598},{"year":14,"cumulativeSavings":11284,"netPosition":1484},{"year":15,"cumulativeSavings":12183,"netPosition":2383},{"year":16,"cumulativeSavings":13097,"netPosition":3297},{"year":17,"cumulativeSavings":14023,"netPosition":4223},{"year":18,"cumulativeSavings":14964,"netPosition":5164},{"year":19,"cumulativeSavings":15919,"netPosition":6119},{"year":20,"cumulativeSavings":16888,"netPosition":7088},{"year":21,"cumulativeSavings":17872,"netPosition":8072},{"year":22,"cumulativeSavings":18870,"netPosition":9070},{"year":23,"cumulativeSavings":19883,"netPosition":10083},{"year":24,"cumulativeSavings":20912,"netPosition":11112},{"year":25,"cumulativeSavings":21956,"netPosition":12156}],"resolution":{"locationInput":"Paris, France","geocodeStatus":"resolved","lat":48.8535,"lon":2.3484,"irradianceSource":"nasa-live","irradiancePeriod":{"start":2019,"end":2023},"nasaHttpStatus":200,"nasaKeysRequested":["201901","201902","201903"],"nasaKeysPresent":["201901","201902","201903"],"irradianceMonthly":[0.9322,2.0204,3.2133,4.7527,5.6125,6.0725,5.9739,4.8926,3.8946,2.2449,1.2363,0.7746]}}
---STATUS:200 TIME:1.831430


##### RENDER /api/optimize :: Paris, France

>>> [2026-09-19T11:17:51.400Z] curl -sS -i --max-time 100 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -X POST https://voltura-api.onrender.com/api/optimize -H 'Content-Type: application/json' --data-binary '{"location":"Paris, France","annualUsageKwh":5000,"energyPattern":[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]}'
HTTP/1.1 200 OK
Date: Sat, 19 Sep 2026 11:17:54 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
access-control-allow-origin: https://voltura-web.onrender.com
cf-cache-status: DYNAMIC
etag: W/"5be-oVSsyAOBu5mtx1ELYbNC5nJJnoU"
ratelimit: limit=10, remaining=9, reset=900
ratelimit-policy: 10;w=900
rndr-id: 0e10c050-0021-483e
Server: cloudflare
vary: Origin
vary: Accept-Encoding
x-powered-by: Express
x-render-origin-server: Render
CF-RAY: a3d82fb11ac12558-MRS
alt-svc: h3=":443"; ma=86400

{"optimalPv":4935,"optimalBattery":7.13,"explanation":"The site at latitude 48.8535 and longitude 2.3484 receives a mean daily irradiance of 3.47 kWh/m2/day. With a system performance ratio of 0.8 the recommended PV array of 4.935 kWp (4935 W) is sized to produce, over a year, the 5000 kWh that the household meters, meeting the coverage target of 1. The average daily use of 13.699 kWh is therefore fully supplied by the array output. During the 9 hours each day when the array produces nothing the home consumes 5.137 kWh. The recommended battery of 7.13 kWh, when limited to a usable depth of discharge of 0.8 and accounting for a round‑trip efficiency of 0.9, can store enough of the day's generation to cover that 5.137 kWh demand, ensuring uninterrupted power.","sizing":{"pvKwp":4.935,"pvWatts":4935,"batteryKwh":7.13,"annualUsageKwh":5000,"dailyUsageKwh":13.699,"nightUsageKwh":5.137,"nightShare":0.375,"darkHours":9,"irradianceKwhM2Day":3.47,"coverageTarget":1,"performanceRatio":0.8,"roundTripEfficiency":0.9,"usableDepthOfDischarge":0.8,"daysPerYear":365},"resolution":{"locationInput":"Paris, France","geocodeStatus":"resolved","lat":48.8535,"lon":2.3484,"irradianceSource":"nasa-live","irradiancePeriod":{"start":2019,"end":2023},"nasaHttpStatus":200,"nasaKeysRequested":["201901","201902","201903"],"nasaKeysPresent":["201901","201902","201903"],"irradianceMonthly":[0.9322,2.0204,3.2133,4.7527,5.6125,6.0725,5.9739,4.8926,3.8946,2.2449,1.2363,0.7746]}}
---STATUS:200 TIME:3.839039


##### RENDER /api/calculate :: Madrid, Spain

>>> [2026-09-19T11:17:55.326Z] curl -sS -i --max-time 100 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -X POST https://voltura-api.onrender.com/api/calculate -H 'Content-Type: application/json' -H 'X-Session-Id: b2step0-probe-0000-4000-8000-000000000001' --data-binary '{"location":"Madrid, Spain","energyUsage":5000,"pvWattage":4000,"batteryCapacity":10}'
HTTP/1.1 200 OK
Date: Sat, 19 Sep 2026 11:17:56 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
access-control-allow-origin: https://voltura-web.onrender.com
etag: W/"e9e-5I/anrot1QALxH9XUK0qSBILqTg"
rndr-id: ac62ba0a-9092-4b00
Server: cloudflare
vary: Origin
vary: Accept-Encoding
x-powered-by: Express
x-render-origin-server: Render
cf-cache-status: DYNAMIC
CF-RAY: a3d82fc9c8d9b24a-MRS
alt-svc: h3=":443"; ma=86400

{"savingsKwh":3542,"co2Reduction":864,"annualSavingsEur":885.4,"carbonIntensity":0.244,"avgIrradiance":4.71,"irradianceSource":"nasa-live","recommendation":"Great result! Your system covers 71% of your energy, saving €885/year. A slightly larger battery could push you closer to 100%.","breakdown":{"solar":71,"battery":0,"grid":29},"monthlyData":[{"month":1,"name":"Jan","generationKwh":224.3,"consumptionKwh":591.8,"savingsKwh":222.9,"gridImportKwh":368.9,"co2Kg":54.4},{"month":2,"name":"Feb","generationKwh":288.3,"consumptionKwh":497.4,"savingsKwh":281.3,"gridImportKwh":216.1,"co2Kg":68.6},{"month":3,"name":"Mar","generationKwh":408.6,"consumptionKwh":497.7,"savingsKwh":392.9,"gridImportKwh":104.8,"co2Kg":95.9},{"month":4,"name":"Apr","generationKwh":485.2,"consumptionKwh":411.7,"savingsKwh":409.8,"gridImportKwh":1.9,"co2Kg":100},{"month":5,"name":"May","generationKwh":647.1,"consumptionKwh":351.9,"savingsKwh":351.9,"gridImportKwh":0,"co2Kg":85.9},{"month":6,"name":"Jun","generationKwh":679.3,"consumptionKwh":285.6,"savingsKwh":285.6,"gridImportKwh":0,"co2Kg":69.7},{"month":7,"name":"Jul","generationKwh":741.9,"consumptionKwh":272,"savingsKwh":272,"gridImportKwh":0,"co2Kg":66.4},{"month":8,"name":"Aug","generationKwh":654.5,"consumptionKwh":287.1,"savingsKwh":287.1,"gridImportKwh":0,"co2Kg":70.1},{"month":9,"name":"Sep","generationKwh":451.2,"consumptionKwh":330.5,"savingsKwh":330.5,"gridImportKwh":0,"co2Kg":80.6},{"month":10,"name":"Oct","generationKwh":337.4,"consumptionKwh":415.4,"savingsKwh":331.1,"gridImportKwh":84.3,"co2Kg":80.8},{"month":11,"name":"Nov","generationKwh":208.9,"consumptionKwh":491.6,"savingsKwh":206.5,"gridImportKwh":285.1,"co2Kg":50.4},{"month":12,"name":"Dec","generationKwh":170,"consumptionKwh":567.3,"savingsKwh":170,"gridImportKwh":397.4,"co2Kg":41.5}],"installationCostEur":9800,"paybackYears":10.3,"roiCurve":[{"year":0,"cumulativeSavings":0,"netPosition":-9800},{"year":1,"cumulativeSavings":885,"netPosition":-8915},{"year":2,"cumulativeSavings":1784,"netPosition":-8016},{"year":3,"cumulativeSavings":2696,"netPosition":-7104},{"year":4,"cumulativeSavings":3622,"netPosition":-6178},{"year":5,"cumulativeSavings":4562,"netPosition":-5238},{"year":6,"cumulativeSavings":5516,"netPosition":-4284},{"year":7,"cumulativeSavings":6484,"netPosition":-3316},{"year":8,"cumulativeSavings":7466,"netPosition":-2334},{"year":9,"cumulativeSavings":8464,"netPosition":-1336},{"year":10,"cumulativeSavings":9476,"netPosition":-324},{"year":11,"cumulativeSavings":10504,"netPosition":704},{"year":12,"cumulativeSavings":11547,"netPosition":1747},{"year":13,"cumulativeSavings":12605,"netPosition":2805},{"year":14,"cumulativeSavings":13680,"netPosition":3880},{"year":15,"cumulativeSavings":14770,"netPosition":4970},{"year":16,"cumulativeSavings":15877,"netPosition":6077},{"year":17,"cumulativeSavings":17001,"netPosition":7201},{"year":18,"cumulativeSavings":18141,"netPosition":8341},{"year":19,"cumulativeSavings":19299,"netPosition":9499},{"year":20,"cumulativeSavings":20474,"netPosition":10674},{"year":21,"cumulativeSavings":21666,"netPosition":11866},{"year":22,"cumulativeSavings":22877,"netPosition":13077},{"year":23,"cumulativeSavings":24105,"netPosition":14305},{"year":24,"cumulativeSavings":25352,"netPosition":15552},{"year":25,"cumulativeSavings":26618,"netPosition":16818}],"resolution":{"locationInput":"Madrid, Spain","geocodeStatus":"resolved","lat":40.4168,"lon":-3.7035,"irradianceSource":"nasa-live","irradiancePeriod":{"start":2019,"end":2023},"nasaHttpStatus":200,"nasaKeysRequested":["201901","201902","201903"],"nasaKeysPresent":["201901","201902","201903"],"irradianceMonthly":[2.3543,3.3506,4.2884,5.2628,6.7921,7.368,7.7876,6.8698,4.8937,3.5412,2.2659,1.7843]}}
---STATUS:200 TIME:1.400820


##### RENDER /api/optimize :: Madrid, Spain

>>> [2026-09-19T11:17:56.821Z] curl -sS -i --max-time 100 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -X POST https://voltura-api.onrender.com/api/optimize -H 'Content-Type: application/json' --data-binary '{"location":"Madrid, Spain","annualUsageKwh":5000,"energyPattern":[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]}'
HTTP/1.1 200 OK
Date: Sat, 19 Sep 2026 11:17:59 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
access-control-allow-origin: https://voltura-web.onrender.com
etag: W/"637-8kYtchO197T8wAb7sjJ0YCCZaVg"
ratelimit: limit=10, remaining=9, reset=900
ratelimit-policy: 10;w=900
rndr-id: 7ca987a5-088b-4a0f
Server: cloudflare
vary: Origin
vary: Accept-Encoding
x-powered-by: Express
x-render-origin-server: Render
cf-cache-status: DYNAMIC
CF-RAY: a3d82fd37df0e1cc-MRS
alt-svc: h3=":443"; ma=86400

{"optimalPv":3636,"optimalBattery":7.13,"explanation":"The location at latitude 40.4168 and longitude -3.7035 receives a mean daily irradiance of 4.71 kWh/m2/day, and with a system performance ratio of 0.8 the 3.636 kWp (3636 W) array is expected to produce roughly the 5000 kWh/year needed to cover the metered annual electricity use. This matches the coverage target of 1. The average daily use of 13.699 kWh/day means that during the 9 hours when the array produces nothing the household consumes 5.137 kWh/day, which can be supplied by the 7.13 kWh battery when accounting for a usable depth of discharge of 0.8 and a round‑trip efficiency of 0.9. The battery therefore stores enough usable energy to meet the nightly demand while respecting its depth‑of‑discharge limit, making the recommended PV size and battery capacity well matched to the solar resource and the load profile.","sizing":{"pvKwp":3.636,"pvWatts":3636,"batteryKwh":7.13,"annualUsageKwh":5000,"dailyUsageKwh":13.699,"nightUsageKwh":5.137,"nightShare":0.375,"darkHours":9,"irradianceKwhM2Day":4.71,"coverageTarget":1,"performanceRatio":0.8,"roundTripEfficiency":0.9,"usableDepthOfDischarge":0.8,"daysPerYear":365},"resolution":{"locationInput":"Madrid, Spain","geocodeStatus":"resolved","lat":40.4168,"lon":-3.7035,"irradianceSource":"nasa-live","irradiancePeriod":{"start":2019,"end":2023},"nasaHttpStatus":200,"nasaKeysRequested":["201901","201902","201903"],"nasaKeysPresent":["201901","201902","201903"],"irradianceMonthly":[2.3543,3.3506,4.2884,5.2628,6.7921,7.368,7.7876,6.8698,4.8937,3.5412,2.2659,1.7843]}}
---STATUS:200 TIME:3.853280


##### RENDER /api/calculate :: Almeria, Spain

>>> [2026-09-19T11:18:00.775Z] curl -sS -i --max-time 100 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -X POST https://voltura-api.onrender.com/api/calculate -H 'Content-Type: application/json' -H 'X-Session-Id: b2step0-probe-0000-4000-8000-000000000001' --data-binary '{"location":"Almeria, Spain","energyUsage":5000,"pvWattage":4000,"batteryCapacity":10}'
HTTP/1.1 200 OK
Date: Sat, 19 Sep 2026 11:18:01 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
access-control-allow-origin: https://voltura-web.onrender.com
etag: W/"e98-TgtjpHPwAhbiMvVGpVckayKNa+E"
rndr-id: 1f50e5b9-605b-4437
Server: cloudflare
vary: Origin
vary: Accept-Encoding
x-powered-by: Express
x-render-origin-server: Render
cf-cache-status: DYNAMIC
CF-RAY: a3d82febb90cc0fb-MRS
alt-svc: h3=":443"; ma=86400

{"savingsKwh":3880,"co2Reduction":947,"annualSavingsEur":970.1,"carbonIntensity":0.244,"avgIrradiance":5,"irradianceSource":"nasa-live","recommendation":"Great result! Your system covers 78% of your energy, saving €970/year. A slightly larger battery could push you closer to 100%.","breakdown":{"solar":78,"battery":0,"grid":22},"monthlyData":[{"month":1,"name":"Jan","generationKwh":273.5,"consumptionKwh":578.9,"savingsKwh":269.3,"gridImportKwh":309.6,"co2Kg":65.7},{"month":2,"name":"Feb","generationKwh":328.3,"consumptionKwh":495.3,"savingsKwh":318.3,"gridImportKwh":177,"co2Kg":77.7},{"month":3,"name":"Mar","generationKwh":441.3,"consumptionKwh":499.1,"savingsKwh":423,"gridImportKwh":76.1,"co2Kg":103.2},{"month":4,"name":"Apr","generationKwh":526.3,"consumptionKwh":415.3,"savingsKwh":413.6,"gridImportKwh":1.7,"co2Kg":100.9},{"month":5,"name":"May","generationKwh":664,"consumptionKwh":357,"savingsKwh":357,"gridImportKwh":0,"co2Kg":87.1},{"month":6,"name":"Jun","generationKwh":692.9,"consumptionKwh":292.2,"savingsKwh":292.2,"gridImportKwh":0,"co2Kg":71.3},{"month":7,"name":"Jul","generationKwh":683.3,"consumptionKwh":284.6,"savingsKwh":284.6,"gridImportKwh":0,"co2Kg":69.4},{"month":8,"name":"Aug","generationKwh":622,"consumptionKwh":297.3,"savingsKwh":297.3,"gridImportKwh":0,"co2Kg":72.5},{"month":9,"name":"Sep","generationKwh":474.5,"consumptionKwh":332.2,"savingsKwh":332.2,"gridImportKwh":0,"co2Kg":81.1},{"month":10,"name":"Oct","generationKwh":392,"consumptionKwh":414.9,"savingsKwh":380.5,"gridImportKwh":34.4,"co2Kg":92.8},{"month":11,"name":"Nov","generationKwh":286.1,"consumptionKwh":482.3,"savingsKwh":279.5,"gridImportKwh":202.8,"co2Kg":68.2},{"month":12,"name":"Dec","generationKwh":235.6,"consumptionKwh":550.8,"savingsKwh":232.9,"gridImportKwh":317.8,"co2Kg":56.8}],"installationCostEur":9800,"paybackYears":9.5,"roiCurve":[{"year":0,"cumulativeSavings":0,"netPosition":-9800},{"year":1,"cumulativeSavings":970,"netPosition":-8830},{"year":2,"cumulativeSavings":1955,"netPosition":-7845},{"year":3,"cumulativeSavings":2954,"netPosition":-6846},{"year":4,"cumulativeSavings":3969,"netPosition":-5831},{"year":5,"cumulativeSavings":4998,"netPosition":-4802},{"year":6,"cumulativeSavings":6043,"netPosition":-3757},{"year":7,"cumulativeSavings":7104,"netPosition":-2696},{"year":8,"cumulativeSavings":8181,"netPosition":-1619},{"year":9,"cumulativeSavings":9274,"netPosition":-526},{"year":10,"cumulativeSavings":10383,"netPosition":583},{"year":11,"cumulativeSavings":11509,"netPosition":1709},{"year":12,"cumulativeSavings":12651,"netPosition":2851},{"year":13,"cumulativeSavings":13811,"netPosition":4011},{"year":14,"cumulativeSavings":14988,"netPosition":5188},{"year":15,"cumulativeSavings":16183,"netPosition":6383},{"year":16,"cumulativeSavings":17396,"netPosition":7596},{"year":17,"cumulativeSavings":18627,"netPosition":8827},{"year":18,"cumulativeSavings":19877,"netPosition":10077},{"year":19,"cumulativeSavings":21145,"netPosition":11345},{"year":20,"cumulativeSavings":22432,"netPosition":12632},{"year":21,"cumulativeSavings":23739,"netPosition":13939},{"year":22,"cumulativeSavings":25065,"netPosition":15265},{"year":23,"cumulativeSavings":26411,"netPosition":16611},{"year":24,"cumulativeSavings":27777,"netPosition":17977},{"year":25,"cumulativeSavings":29164,"netPosition":19364}],"resolution":{"locationInput":"Almeria, Spain","geocodeStatus":"resolved","lat":36.8686,"lon":-2.312,"irradianceSource":"nasa-live","irradiancePeriod":{"start":2019,"end":2023},"nasaHttpStatus":200,"nasaKeysRequested":["201901","201902","201903"],"nasaKeysPresent":["201901","201902","201903"],"irradianceMonthly":[2.8712,3.8147,4.6325,5.709,6.9694,7.5153,7.1725,6.5286,5.1471,4.1149,3.1031,2.4735]}}
---STATUS:200 TIME:1.704148


##### RENDER /api/optimize :: Almeria, Spain

>>> [2026-09-19T11:18:02.567Z] curl -sS -i --max-time 100 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -X POST https://voltura-api.onrender.com/api/optimize -H 'Content-Type: application/json' --data-binary '{"location":"Almeria, Spain","annualUsageKwh":5000,"energyPattern":[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]}'
HTTP/1.1 200 OK
Date: Sat, 19 Sep 2026 11:18:12 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
access-control-allow-origin: https://voltura-web.onrender.com
etag: W/"592-q1ghH+1igjfBHrapnZIp9oECNBg"
ratelimit: limit=10, remaining=9, reset=900
ratelimit-policy: 10;w=900
rndr-id: f2068581-40f6-41e4
Server: cloudflare
vary: Origin
vary: Accept-Encoding
x-powered-by: Express
x-render-origin-server: Render
cf-cache-status: DYNAMIC
CF-RAY: a3d82ff7bcadfb98-MRS
alt-svc: h3=":443"; ma=86400

{"optimalPv":3425,"optimalBattery":7.13,"explanation":"At the latitude 36.8686 and longitude -2.312 the site receives a mean daily irradiance of 5 kWh/m2/day according to NASA POWER satellite measurement for 2019–2023. With a system performance ratio of 80% the 3.425 kWp (3425 W) array can produce the metered average daily use of 13.699 kWh/day, satisfying the coverage target of 100% (1) of the annual consumption of 5000 kWh/year. The household’s use during the 9 hours the array produces nothing is 5.137 kWh/day. The 7.13 kWh battery, limited by a usable depth of discharge of 80% and a round‑trip efficiency of 90%, can reliably store and deliver that amount, ensuring the load is met when solar production is zero.","sizing":{"pvKwp":3.425,"pvWatts":3425,"batteryKwh":7.13,"annualUsageKwh":5000,"dailyUsageKwh":13.699,"nightUsageKwh":5.137,"nightShare":0.375,"darkHours":9,"irradianceKwhM2Day":5,"coverageTarget":1,"performanceRatio":0.8,"roundTripEfficiency":0.9,"usableDepthOfDischarge":0.8,"daysPerYear":365},"resolution":{"locationInput":"Almeria, Spain","geocodeStatus":"resolved","lat":36.8686,"lon":-2.312,"irradianceSource":"nasa-live","irradiancePeriod":{"start":2019,"end":2023},"nasaHttpStatus":200,"nasaKeysRequested":["201901","201902","201903"],"nasaKeysPresent":["201901","201902","201903"],"irradianceMonthly":[2.8712,3.8147,4.6325,5.709,6.9694,7.5153,7.1725,6.5286,5.1471,4.1149,3.1031,2.4735]}}
---STATUS:200 TIME:10.388324


##### RENDER /api/calculate :: Berlin, Germany

>>> [2026-09-19T11:18:13.103Z] curl -sS -i --max-time 100 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -X POST https://voltura-api.onrender.com/api/calculate -H 'Content-Type: application/json' -H 'X-Session-Id: b2step0-probe-0000-4000-8000-000000000001' --data-binary '{"location":"Berlin, Germany","energyUsage":5000,"pvWattage":4000,"batteryCapacity":10}'
HTTP/1.1 200 OK
Date: Sat, 19 Sep 2026 11:18:13 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
access-control-allow-origin: https://voltura-web.onrender.com
etag: W/"ea0-xOY6TeBSSbLj5LQUvCJtOiAjsdM"
rndr-id: 403c0fa0-f2d5-4d8d
Server: cloudflare
vary: Origin
vary: Accept-Encoding
x-powered-by: Express
x-render-origin-server: Render
cf-cache-status: DYNAMIC
CF-RAY: a3d83038c8f6e219-MRS
alt-svc: h3=":443"; ma=86400

{"savingsKwh":2560,"co2Reduction":1026,"annualSavingsEur":639.88,"carbonIntensity":0.401,"avgIrradiance":2.92,"irradianceSource":"nasa-live","recommendation":"Your system offsets 51% of your energy usage, saving €640/year. Consider increasing PV capacity to 6000W for better coverage.","breakdown":{"solar":51,"battery":0,"grid":49},"monthlyData":[{"month":1,"name":"Jan","generationKwh":61.8,"consumptionKwh":583.3,"savingsKwh":61.8,"gridImportKwh":521.5,"co2Kg":24.8},{"month":2,"name":"Feb","generationKwh":118.1,"consumptionKwh":507,"savingsKwh":118.1,"gridImportKwh":389,"co2Kg":47.4},{"month":3,"name":"Mar","generationKwh":248,"consumptionKwh":496.9,"savingsKwh":243.5,"gridImportKwh":253.3,"co2Kg":97.6},{"month":4,"name":"Apr","generationKwh":387.6,"consumptionKwh":409.9,"savingsKwh":369.7,"gridImportKwh":40.2,"co2Kg":148.2},{"month":5,"name":"May","generationKwh":479.3,"consumptionKwh":348.8,"savingsKwh":348.2,"gridImportKwh":0.6,"co2Kg":139.6},{"month":6,"name":"Jun","generationKwh":529.9,"consumptionKwh":277.6,"savingsKwh":277.6,"gridImportKwh":0,"co2Kg":111.3},{"month":7,"name":"Jul","generationKwh":472.6,"consumptionKwh":275.6,"savingsKwh":275.6,"gridImportKwh":0,"co2Kg":110.5},{"month":8,"name":"Aug","generationKwh":403.3,"consumptionKwh":289.4,"savingsKwh":289.4,"gridImportKwh":0,"co2Kg":116},{"month":9,"name":"Sep","generationKwh":294.7,"consumptionKwh":332.7,"savingsKwh":289.5,"gridImportKwh":43.2,"co2Kg":116.1},{"month":10,"name":"Oct","generationKwh":165.9,"consumptionKwh":422.4,"savingsKwh":165.1,"gridImportKwh":257.4,"co2Kg":66.2},{"month":11,"name":"Nov","generationKwh":74.1,"consumptionKwh":489.6,"savingsKwh":74.1,"gridImportKwh":415.6,"co2Kg":29.7},{"month":12,"name":"Dec","generationKwh":46.9,"consumptionKwh":566.8,"savingsKwh":46.9,"gridImportKwh":519.9,"co2Kg":18.8}],"installationCostEur":9800,"paybackYears":13.9,"roiCurve":[{"year":0,"cumulativeSavings":0,"netPosition":-9800},{"year":1,"cumulativeSavings":640,"netPosition":-9160},{"year":2,"cumulativeSavings":1289,"netPosition":-8511},{"year":3,"cumulativeSavings":1949,"netPosition":-7851},{"year":4,"cumulativeSavings":2618,"netPosition":-7182},{"year":5,"cumulativeSavings":3297,"netPosition":-6503},{"year":6,"cumulativeSavings":3986,"netPosition":-5814},{"year":7,"cumulativeSavings":4686,"netPosition":-5114},{"year":8,"cumulativeSavings":5396,"netPosition":-4404},{"year":9,"cumulativeSavings":6117,"netPosition":-3683},{"year":10,"cumulativeSavings":6848,"netPosition":-2952},{"year":11,"cumulativeSavings":7591,"netPosition":-2209},{"year":12,"cumulativeSavings":8345,"netPosition":-1455},{"year":13,"cumulativeSavings":9110,"netPosition":-690},{"year":14,"cumulativeSavings":9886,"netPosition":86},{"year":15,"cumulativeSavings":10675,"netPosition":875},{"year":16,"cumulativeSavings":11475,"netPosition":1675},{"year":17,"cumulativeSavings":12287,"netPosition":2487},{"year":18,"cumulativeSavings":13111,"netPosition":3311},{"year":19,"cumulativeSavings":13947,"netPosition":4147},{"year":20,"cumulativeSavings":14796,"netPosition":4996},{"year":21,"cumulativeSavings":15658,"netPosition":5858},{"year":22,"cumulativeSavings":16533,"netPosition":6733},{"year":23,"cumulativeSavings":17421,"netPosition":7621},{"year":24,"cumulativeSavings":18322,"netPosition":8522},{"year":25,"cumulativeSavings":19237,"netPosition":9437}],"resolution":{"locationInput":"Berlin, Germany","geocodeStatus":"resolved","lat":52.5174,"lon":13.3951,"irradianceSource":"nasa-live","irradiancePeriod":{"start":2019,"end":2023},"nasaHttpStatus":200,"nasaKeysRequested":["201901","201902","201903"],"nasaKeysPresent":["201901","201902","201903"],"irradianceMonthly":[0.6482,1.3722,2.6027,4.2037,5.0313,5.7475,4.9602,4.2333,3.1968,1.7416,0.8033,0.4924]}}
---STATUS:200 TIME:1.082092


##### RENDER /api/optimize :: Berlin, Germany

>>> [2026-09-19T11:18:14.291Z] curl -sS -i --max-time 100 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -X POST https://voltura-api.onrender.com/api/optimize -H 'Content-Type: application/json' --data-binary '{"location":"Berlin, Germany","annualUsageKwh":5000,"energyPattern":[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]}'
HTTP/1.1 200 OK
Date: Sat, 19 Sep 2026 11:18:17 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
access-control-allow-origin: https://voltura-web.onrender.com
etag: W/"5e8-mNNyFGC0G53cSO7gooZHE29sMGc"
ratelimit: limit=10, remaining=8, reset=883
ratelimit-policy: 10;w=900
rndr-id: 19afbebd-53fd-4505
Server: cloudflare
vary: Origin
vary: Accept-Encoding
x-powered-by: Express
x-render-origin-server: Render
cf-cache-status: DYNAMIC
CF-RAY: a3d83040eea9e159-MRS
alt-svc: h3=":443"; ma=86400

{"optimalPv":5864,"optimalBattery":7.13,"explanation":"The location at latitude 52.5174 and longitude 13.3951 receives a mean daily irradiance of 2.92 kWh/m2/day. Using the computed recommendation of a 5.864 kWp (5864 W) PV array together with the system performance ratio of 0.8, the array is sized to generate enough energy to meet the average daily use of 13.699 kWh/day and, over a year, the metered annual electricity use of 5000 kWh/year, satisfying the coverage target of 100% (1). During the 9 hours when the array produces nothing, the household needs 5.137 kWh/day. The recommended battery capacity of 7.13 kWh, when limited to the usable depth of discharge of 0.8 and accounting for the round‑trip efficiency of 0.9, can store and deliver the required energy, ensuring the load is fully covered.","sizing":{"pvKwp":5.864,"pvWatts":5864,"batteryKwh":7.13,"annualUsageKwh":5000,"dailyUsageKwh":13.699,"nightUsageKwh":5.137,"nightShare":0.375,"darkHours":9,"irradianceKwhM2Day":2.92,"coverageTarget":1,"performanceRatio":0.8,"roundTripEfficiency":0.9,"usableDepthOfDischarge":0.8,"daysPerYear":365},"resolution":{"locationInput":"Berlin, Germany","geocodeStatus":"resolved","lat":52.5174,"lon":13.3951,"irradianceSource":"nasa-live","irradiancePeriod":{"start":2019,"end":2023},"nasaHttpStatus":200,"nasaKeysRequested":["201901","201902","201903"],"nasaKeysPresent":["201901","201902","201903"],"irradianceMonthly":[0.6482,1.3722,2.6027,4.2037,5.0313,5.7475,4.9602,4.2333,3.1968,1.7416,0.8033,0.4924]}}
---STATUS:200 TIME:3.993521


##### RENDER /api/calculate :: Fuengirola, Spain

>>> [2026-09-19T11:18:18.430Z] curl -sS -i --max-time 100 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -X POST https://voltura-api.onrender.com/api/calculate -H 'Content-Type: application/json' -H 'X-Session-Id: b2step0-probe-0000-4000-8000-000000000001' --data-binary '{"location":"Fuengirola, Spain","energyUsage":5000,"pvWattage":4000,"batteryCapacity":10}'
HTTP/1.1 200 OK
Date: Sat, 19 Sep 2026 11:18:18 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
access-control-allow-origin: https://voltura-web.onrender.com
etag: W/"ea5-UFDxLU3fvrmmXJoxTmqy2UMSGIc"
rndr-id: ffd73d3b-5df6-45df
Server: cloudflare
vary: Origin
vary: Accept-Encoding
x-powered-by: Express
x-render-origin-server: Render
cf-cache-status: DYNAMIC
CF-RAY: a3d8305a4e24e23c-MRS
alt-svc: h3=":443"; ma=86400

{"savingsKwh":3860,"co2Reduction":942,"annualSavingsEur":965.1,"carbonIntensity":0.244,"avgIrradiance":5.05,"irradianceSource":"nasa-live","recommendation":"Great result! Your system covers 77% of your energy, saving €965/year. A slightly larger battery could push you closer to 100%.","breakdown":{"solar":77,"battery":0,"grid":23},"monthlyData":[{"month":1,"name":"Jan","generationKwh":260,"consumptionKwh":565.3,"savingsKwh":256.2,"gridImportKwh":309.1,"co2Kg":62.5},{"month":2,"name":"Feb","generationKwh":310,"consumptionKwh":488.6,"savingsKwh":301.1,"gridImportKwh":187.4,"co2Kg":73.5},{"month":3,"name":"Mar","generationKwh":441.1,"consumptionKwh":494.8,"savingsKwh":422.5,"gridImportKwh":72.3,"co2Kg":103.1},{"month":4,"name":"Apr","generationKwh":519.9,"consumptionKwh":415.5,"savingsKwh":413.9,"gridImportKwh":1.6,"co2Kg":101},{"month":5,"name":"May","generationKwh":678.3,"consumptionKwh":363.5,"savingsKwh":363.5,"gridImportKwh":0,"co2Kg":88.7},{"month":6,"name":"Jun","generationKwh":712.3,"consumptionKwh":303.6,"savingsKwh":303.6,"gridImportKwh":0,"co2Kg":74.1},{"month":7,"name":"Jul","generationKwh":725.4,"consumptionKwh":289.7,"savingsKwh":289.7,"gridImportKwh":0,"co2Kg":70.7},{"month":8,"name":"Aug","generationKwh":652.3,"consumptionKwh":304.4,"savingsKwh":304.4,"gridImportKwh":0,"co2Kg":74.3},{"month":9,"name":"Sep","generationKwh":485.7,"consumptionKwh":337.5,"savingsKwh":337.5,"gridImportKwh":0,"co2Kg":82.3},{"month":10,"name":"Oct","generationKwh":390.5,"consumptionKwh":415.9,"savingsKwh":379.1,"gridImportKwh":36.8,"co2Kg":92.5},{"month":11,"name":"Nov","generationKwh":273.2,"consumptionKwh":475.8,"savingsKwh":267.3,"gridImportKwh":208.5,"co2Kg":65.2},{"month":12,"name":"Dec","generationKwh":223.8,"consumptionKwh":545.2,"savingsKwh":221.6,"gridImportKwh":323.6,"co2Kg":54.1}],"installationCostEur":9800,"paybackYears":9.5,"roiCurve":[{"year":0,"cumulativeSavings":0,"netPosition":-9800},{"year":1,"cumulativeSavings":965,"netPosition":-8835},{"year":2,"cumulativeSavings":1945,"netPosition":-7855},{"year":3,"cumulativeSavings":2939,"netPosition":-6861},{"year":4,"cumulativeSavings":3948,"netPosition":-5852},{"year":5,"cumulativeSavings":4972,"netPosition":-4828},{"year":6,"cumulativeSavings":6012,"netPosition":-3788},{"year":7,"cumulativeSavings":7067,"netPosition":-2733},{"year":8,"cumulativeSavings":8139,"netPosition":-1661},{"year":9,"cumulativeSavings":9226,"netPosition":-574},{"year":10,"cumulativeSavings":10329,"netPosition":529},{"year":11,"cumulativeSavings":11449,"netPosition":1649},{"year":12,"cumulativeSavings":12586,"netPosition":2786},{"year":13,"cumulativeSavings":13740,"netPosition":3940},{"year":14,"cumulativeSavings":14911,"netPosition":5111},{"year":15,"cumulativeSavings":16100,"netPosition":6300},{"year":16,"cumulativeSavings":17307,"netPosition":7507},{"year":17,"cumulativeSavings":18531,"netPosition":8731},{"year":18,"cumulativeSavings":19774,"netPosition":9974},{"year":19,"cumulativeSavings":21036,"netPosition":11236},{"year":20,"cumulativeSavings":22317,"netPosition":12517},{"year":21,"cumulativeSavings":23617,"netPosition":13817},{"year":22,"cumulativeSavings":24936,"netPosition":15136},{"year":23,"cumulativeSavings":26275,"netPosition":16475},{"year":24,"cumulativeSavings":27634,"netPosition":17834},{"year":25,"cumulativeSavings":29014,"netPosition":19214}],"resolution":{"locationInput":"Fuengirola, Spain","geocodeStatus":"resolved","lat":36.5388,"lon":-4.6234,"irradianceSource":"nasa-live","irradiancePeriod":{"start":2019,"end":2023},"nasaHttpStatus":200,"nasaKeysRequested":["201901","201902","201903"],"nasaKeysPresent":["201901","201902","201903"],"irradianceMonthly":[2.7288,3.602,4.6302,5.6395,7.1196,7.7255,7.614,6.8466,5.2683,4.0985,2.9637,2.3492]}}
---STATUS:200 TIME:1.016963


##### RENDER /api/optimize :: Fuengirola, Spain

>>> [2026-09-19T11:18:19.540Z] curl -sS -i --max-time 100 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -X POST https://voltura-api.onrender.com/api/optimize -H 'Content-Type: application/json' --data-binary '{"location":"Fuengirola, Spain","annualUsageKwh":5000,"energyPattern":[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]}'
HTTP/1.1 200 OK
Date: Sat, 19 Sep 2026 11:18:22 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
access-control-allow-origin: https://voltura-web.onrender.com
etag: W/"5d1-u5nL2/+4xDdMrujJqEwdrjH5zFE"
ratelimit: limit=10, remaining=9, reset=900
ratelimit-policy: 10;w=900
rndr-id: d6345d4f-218a-4cfc
Server: cloudflare
vary: Origin
vary: Accept-Encoding
x-powered-by: Express
x-render-origin-server: Render
cf-cache-status: DYNAMIC
CF-RAY: a3d830612f9c4329-MRS
alt-svc: h3=":443"; ma=86400

{"optimalPv":3391,"optimalBattery":7.13,"explanation":"The location at latitude 36.5388 and longitude -4.6234 receives a mean daily irradiance of 5.05 kWh/m2/day. With a system performance ratio of 0.8 (80%) the recommended PV array of 3.391 kWp (3391 W) can generate enough electricity to meet the metered annual electricity use of 5000 kWh/year, which corresponds to an average daily use of 13.699 kWh/day. During the 9 hours the array produces nothing the household consumes 5.137 kWh/day. The recommended battery capacity of 7.13 kWh, operating with a usable depth of discharge of 0.8 (80%) and a round‑trip efficiency of 0.9 (90%), provides sufficient stored energy to cover that 5.137 kWh/day demand, thereby achieving the coverage target of 1 (100%) of the annual consumption.","sizing":{"pvKwp":3.391,"pvWatts":3391,"batteryKwh":7.13,"annualUsageKwh":5000,"dailyUsageKwh":13.699,"nightUsageKwh":5.137,"nightShare":0.375,"darkHours":9,"irradianceKwhM2Day":5.05,"coverageTarget":1,"performanceRatio":0.8,"roundTripEfficiency":0.9,"usableDepthOfDischarge":0.8,"daysPerYear":365},"resolution":{"locationInput":"Fuengirola, Spain","geocodeStatus":"resolved","lat":36.5388,"lon":-4.6234,"irradianceSource":"nasa-live","irradiancePeriod":{"start":2019,"end":2023},"nasaHttpStatus":200,"nasaKeysRequested":["201901","201902","201903"],"nasaKeysPresent":["201901","201902","201903"],"irradianceMonthly":[2.7288,3.602,4.6302,5.6395,7.1196,7.7255,7.614,6.8466,5.2683,4.0985,2.9637,2.3492]}}
---STATUS:200 TIME:3.669036


##### RENDER /api/calculate :: Tétouan, Morocco

>>> [2026-09-19T11:18:23.311Z] curl -sS -i --max-time 100 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -X POST https://voltura-api.onrender.com/api/calculate -H 'Content-Type: application/json' -H 'X-Session-Id: b2step0-probe-0000-4000-8000-000000000001' --data-binary '{"location":"Tétouan, Morocco","energyUsage":5000,"pvWattage":4000,"batteryCapacity":10}'
HTTP/1.1 422 Unprocessable Entity
Date: Sat, 19 Sep 2026 11:18:23 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
access-control-allow-origin: https://voltura-web.onrender.com
etag: W/"1a7-KqdjWnrTsCX2HYFN0htdcxvkM80"
rndr-id: 3da34ea6-9366-4eaf
Server: cloudflare
vary: Origin
vary: Accept-Encoding
x-powered-by: Express
x-render-origin-server: Render
cf-cache-status: DYNAMIC
CF-RAY: a3d830789be3b97c-MRS
alt-svc: h3=":443"; ma=86400

{"message":"We could not locate that place. Check the spelling, or try including the country - for example \"Madrid, Spain\".","code":"geocode_failed","field":"location","resolution":{"locationInput":"T�touan, Morocco","geocodeStatus":"failed","lat":null,"lon":null,"irradianceSource":"not-reached","irradiancePeriod":null,"nasaHttpStatus":"not-called","nasaKeysRequested":[],"nasaKeysPresent":[],"irradianceMonthly":[]}}
---STATUS:422 TIME:0.415617


##### RENDER /api/optimize :: Tétouan, Morocco

>>> [2026-09-19T11:18:23.830Z] curl -sS -i --max-time 100 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -X POST https://voltura-api.onrender.com/api/optimize -H 'Content-Type: application/json' --data-binary '{"location":"Tétouan, Morocco","annualUsageKwh":5000,"energyPattern":[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]}'
HTTP/1.1 422 Unprocessable Entity
Date: Sat, 19 Sep 2026 11:18:23 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
access-control-allow-origin: https://voltura-web.onrender.com
etag: W/"1a7-KqdjWnrTsCX2HYFN0htdcxvkM80"
ratelimit: limit=10, remaining=9, reset=900
ratelimit-policy: 10;w=900
rndr-id: 454d7a23-682b-47c1
Server: cloudflare
vary: Origin
vary: Accept-Encoding
x-powered-by: Express
x-render-origin-server: Render
cf-cache-status: DYNAMIC
CF-RAY: a3d8307c1d3ae232-MRS
alt-svc: h3=":443"; ma=86400

{"message":"We could not locate that place. Check the spelling, or try including the country - for example \"Madrid, Spain\".","code":"geocode_failed","field":"location","resolution":{"locationInput":"T�touan, Morocco","geocodeStatus":"failed","lat":null,"lon":null,"irradianceSource":"not-reached","irradiancePeriod":null,"nasaHttpStatus":"not-called","nasaKeysRequested":[],"nasaKeysPresent":[],"irradianceMonthly":[]}}
---STATUS:422 TIME:0.297648


##### RENDER /api/calculate :: Xqzzyvv, Nowhere

>>> [2026-09-19T11:18:24.205Z] curl -sS -i --max-time 100 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -X POST https://voltura-api.onrender.com/api/calculate -H 'Content-Type: application/json' -H 'X-Session-Id: b2step0-probe-0000-4000-8000-000000000001' --data-binary '{"location":"Xqzzyvv, Nowhere","energyUsage":5000,"pvWattage":4000,"batteryCapacity":10}'
HTTP/1.1 422 Unprocessable Entity
Date: Sat, 19 Sep 2026 11:18:23 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
access-control-allow-origin: https://voltura-web.onrender.com
etag: W/"1a5-QPN8FQlGoHcHPeOJi9h6Y5lw1WU"
rndr-id: 18a164c1-8ceb-4b6b
Server: cloudflare
vary: Origin
vary: Accept-Encoding
x-powered-by: Express
x-render-origin-server: Render
cf-cache-status: DYNAMIC
CF-RAY: a3d8307e1a9de1d0-MRS
alt-svc: h3=":443"; ma=86400

{"message":"We could not locate that place. Check the spelling, or try including the country - for example \"Madrid, Spain\".","code":"geocode_failed","field":"location","resolution":{"locationInput":"Xqzzyvv, Nowhere","geocodeStatus":"failed","lat":null,"lon":null,"irradianceSource":"not-reached","irradiancePeriod":null,"nasaHttpStatus":"not-called","nasaKeysRequested":[],"nasaKeysPresent":[],"irradianceMonthly":[]}}
---STATUS:422 TIME:0.300257


##### RENDER /api/optimize :: Xqzzyvv, Nowhere

>>> [2026-09-19T11:18:24.581Z] curl -sS -i --max-time 100 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -X POST https://voltura-api.onrender.com/api/optimize -H 'Content-Type: application/json' --data-binary '{"location":"Xqzzyvv, Nowhere","annualUsageKwh":5000,"energyPattern":[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]}'
HTTP/1.1 422 Unprocessable Entity
Date: Sat, 19 Sep 2026 11:18:24 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
access-control-allow-origin: https://voltura-web.onrender.com
cf-cache-status: DYNAMIC
etag: W/"1a5-QPN8FQlGoHcHPeOJi9h6Y5lw1WU"
ratelimit: limit=10, remaining=8, reset=867
ratelimit-policy: 10;w=900
rndr-id: 15f48397-66e0-42cf
Server: cloudflare
vary: Origin
vary: Accept-Encoding
x-powered-by: Express
x-render-origin-server: Render
CF-RAY: a3d830806e0a6488-MRS
alt-svc: h3=":443"; ma=86400

{"message":"We could not locate that place. Check the spelling, or try including the country - for example \"Madrid, Spain\".","code":"geocode_failed","field":"location","resolution":{"locationInput":"Xqzzyvv, Nowhere","geocodeStatus":"failed","lat":null,"lon":null,"irradianceSource":"not-reached","irradiancePeriod":null,"nasaHttpStatus":"not-called","nasaKeysRequested":[],"nasaKeysPresent":[],"irradianceMonthly":[]}}
---STATUS:422 TIME:0.235886


=== RENDER WINDOW END 2026-09-19T11:18:24.891Z

=== LOCAL 0e (curl, block-specified form) START 2026-09-19T11:18:24.891Z

##### LOCAL curl :: Paris, France

>>> [2026-09-19T11:18:24.891Z] curl -sS -i --max-time 30 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -H 'User-Agent: GreenEnergyCalculator/1.0' https://nominatim.openstreetmap.org/search?q=Paris%2C%20France&format=json&limit=1&addressdetails=1&accept-language=en
HTTP/1.1 200 OK
Connection: keep-alive
Content-Length: 612
server: gunicorn/asgi
x-nominatim-server: vhagar.openstreetmap.org
content-type: application/json; charset=utf-8
Accept-Ranges: bytes
Age: 0
Date: Sat, 19 Sep 2026 11:18:24 GMT
Via: 1.1 varnish
X-Served-By: cache-lin1730068-LIN, cache-lin1730037-LIN
X-Cache: MISS, MISS
X-Cache-Hits: 0, 0
X-Timer: S1789816705.548927,VS0,VE407
Vary: accept-language, Accept-Encoding
Strict-Transport-Security: max-age=300
alt-svc: h3=":443";ma=86400,h3-29=":443";ma=86400,h3-27=":443";ma=86400

[{"place_id":97620444,"licence":"Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright","osm_type":"relation","osm_id":71525,"lat":"48.8534951","lon":"2.3483915","class":"boundary","type":"administrative","place_rank":12,"importance":0.897098092136026,"addresstype":"city","name":"Paris","display_name":"Paris, Ile-de-France, Metropolitan France, France","address":{"city":"Paris","ISO3166-2-lvl6":"FR-75C","state":"Ile-de-France","ISO3166-2-lvl4":"FR-IDF","region":"Metropolitan France","country":"France","country_code":"fr"},"boundingbox":["48.8155755","48.9021560","2.2241220","2.4697602"]}]
---STATUS:200 TIME:0.789381


##### LOCAL curl :: Madrid, Spain

>>> [2026-09-19T11:18:26.958Z] curl -sS -i --max-time 30 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -H 'User-Agent: GreenEnergyCalculator/1.0' https://nominatim.openstreetmap.org/search?q=Madrid%2C%20Spain&format=json&limit=1&addressdetails=1&accept-language=en
HTTP/1.1 200 OK
Connection: keep-alive
Content-Length: 553
server: gunicorn/asgi
x-nominatim-server: dulcy.openstreetmap.org
content-type: application/json; charset=utf-8
Accept-Ranges: bytes
Age: 0
Date: Sat, 19 Sep 2026 11:18:26 GMT
Via: 1.1 varnish
X-Served-By: cache-lin1730040-LIN, cache-lin1730022-LIN
X-Cache: MISS, MISS
X-Cache-Hits: 0, 0
X-Timer: S1789816707.501001,VS0,VE325
Vary: accept-language, Accept-Encoding
Strict-Transport-Security: max-age=300
alt-svc: h3=":443";ma=86400,h3-29=":443";ma=86400,h3-27=":443";ma=86400

[{"place_id":295969504,"licence":"Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright","osm_type":"relation","osm_id":5326784,"lat":"40.4167820","lon":"-3.7035070","class":"boundary","type":"administrative","place_rank":16,"importance":0.8186903991321961,"addresstype":"city","name":"Madrid","display_name":"Madrid, Community of Madrid, Spain","address":{"city":"Madrid","state":"Community of Madrid","ISO3166-2-lvl4":"ES-MD","country":"Spain","country_code":"es"},"boundingbox":["40.3119774","40.6437293","-3.8889539","-3.5183264"]}]
---STATUS:200 TIME:0.579290


##### LOCAL curl :: Almeria, Spain

>>> [2026-09-19T11:18:28.830Z] curl -sS -i --max-time 30 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -H 'User-Agent: GreenEnergyCalculator/1.0' https://nominatim.openstreetmap.org/search?q=Almeria%2C%20Spain&format=json&limit=1&addressdetails=1&accept-language=en
HTTP/1.1 200 OK
Connection: keep-alive
Content-Length: 581
server: gunicorn/asgi
x-nominatim-server: vhagar.openstreetmap.org
content-type: application/json; charset=utf-8
Accept-Ranges: bytes
Age: 0
Date: Sat, 19 Sep 2026 11:18:28 GMT
Via: 1.1 varnish
X-Served-By: cache-lin1730078-LIN, cache-lin1730079-LIN
X-Cache: MISS, MISS
X-Cache-Hits: 0, 0
X-Timer: S1789816708.400282,VS0,VE178
Vary: accept-language, Accept-Encoding
Strict-Transport-Security: max-age=300
alt-svc: h3=":443";ma=86400,h3-29=":443";ma=86400,h3-27=":443";ma=86400

[{"place_id":295192953,"licence":"Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright","osm_type":"relation","osm_id":347796,"lat":"36.8685739","lon":"-2.3120282","class":"boundary","type":"administrative","place_rank":16,"importance":0.6295518492517769,"addresstype":"city","name":"Almeria","display_name":"Almeria, Andalusia, Spain","address":{"city":"Almeria","province":"Almeria","ISO3166-2-lvl6":"ES-AL","state":"Andalusia","ISO3166-2-lvl4":"ES-AN","country":"Spain","country_code":"es"},"boundingbox":["35.9376398","37.0000125","-3.0372135","-2.2022024"]}]
---STATUS:200 TIME:0.463332


##### LOCAL curl :: Berlin, Germany

>>> [2026-09-19T11:18:30.590Z] curl -sS -i --max-time 30 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -H 'User-Agent: GreenEnergyCalculator/1.0' https://nominatim.openstreetmap.org/search?q=Berlin%2C%20Germany&format=json&limit=1&addressdetails=1&accept-language=en
HTTP/1.1 200 OK
Connection: keep-alive
Content-Length: 503
server: gunicorn/asgi
x-nominatim-server: longma.openstreetmap.org
content-type: application/json; charset=utf-8
Accept-Ranges: bytes
Age: 0
Date: Sat, 19 Sep 2026 11:18:30 GMT
Via: 1.1 varnish
X-Served-By: cache-lin1730082-LIN, cache-lin1730073-LIN
X-Cache: MISS, MISS
X-Cache-Hits: 0, 0
X-Timer: S1789816710.142567,VS0,VE255
Vary: accept-language, Accept-Encoding
Strict-Transport-Security: max-age=300
alt-svc: h3=":443";ma=86400,h3-29=":443";ma=86400,h3-27=":443";ma=86400

[{"place_id":145306205,"licence":"Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright","osm_type":"relation","osm_id":62422,"lat":"52.5173885","lon":"13.3951309","class":"boundary","type":"administrative","place_rank":8,"importance":0.8522196536088086,"addresstype":"city","name":"Berlin","display_name":"Berlin, Germany","address":{"city":"Berlin","ISO3166-2-lvl4":"DE-BE","country":"Germany","country_code":"de"},"boundingbox":["52.3382448","52.6755087","13.0883450","13.7611609"]}]
---STATUS:200 TIME:0.532973


##### LOCAL curl :: Fuengirola, Spain

>>> [2026-09-19T11:18:32.415Z] curl -sS -i --max-time 30 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -H 'User-Agent: GreenEnergyCalculator/1.0' https://nominatim.openstreetmap.org/search?q=Fuengirola%2C%20Spain&format=json&limit=1&addressdetails=1&accept-language=en
HTTP/1.1 200 OK
Connection: keep-alive
Content-Length: 691
server: gunicorn/asgi
x-nominatim-server: vhagar.openstreetmap.org
content-type: application/json; charset=utf-8
Accept-Ranges: bytes
Age: 0
Date: Sat, 19 Sep 2026 11:18:32 GMT
Via: 1.1 varnish
X-Served-By: cache-lin1730027-LIN, cache-lin1730066-LIN
X-Cache: MISS, MISS
X-Cache-Hits: 0, 0
X-Timer: S1789816712.979563,VS0,VE132
Vary: accept-language, Accept-Encoding
Strict-Transport-Security: max-age=300
alt-svc: h3=":443";ma=86400,h3-29=":443";ma=86400,h3-27=":443";ma=86400

[{"place_id":295472761,"licence":"Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright","osm_type":"relation","osm_id":345414,"lat":"36.5388398","lon":"-4.6233974","class":"boundary","type":"administrative","place_rank":16,"importance":0.5257237258429168,"addresstype":"city","name":"Fuengirola","display_name":"Fuengirola, Costa del Sol Occidental, Malaga, Andalusia, 29640, Spain","address":{"city":"Fuengirola","county":"Costa del Sol Occidental","state_district":"Malaga","ISO3166-2-lvl6":"ES-MA","state":"Andalusia","ISO3166-2-lvl4":"ES-AN","postcode":"29640","country":"Spain","country_code":"es"},"boundingbox":["36.5190239","36.5896933","-4.6366187","-4.5897986"]}]
---STATUS:200 TIME:0.389904


##### LOCAL curl :: Tétouan, Morocco

>>> [2026-09-19T11:18:34.127Z] curl -sS -i --max-time 30 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -H 'User-Agent: GreenEnergyCalculator/1.0' https://nominatim.openstreetmap.org/search?q=T%C3%A9touan%2C%20Morocco&format=json&limit=1&addressdetails=1&accept-language=en
HTTP/1.1 200 OK
Connection: keep-alive
Content-Length: 792
server: gunicorn/asgi
x-nominatim-server: poldi.openstreetmap.org
content-type: application/json; charset=utf-8
Accept-Ranges: bytes
Age: 0
Date: Sat, 19 Sep 2026 11:18:34 GMT
Via: 1.1 varnish
X-Served-By: cache-lin1730043-LIN, cache-lin1730046-LIN
X-Cache: MISS, MISS
X-Cache-Hits: 0, 0
X-Timer: S1789816714.792163,VS0,VE636
Vary: accept-language, Accept-Encoding
Strict-Transport-Security: max-age=300
alt-svc: h3=":443";ma=86400,h3-29=":443";ma=86400,h3-27=":443";ma=86400

[{"place_id":294709828,"licence":"Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright","osm_type":"relation","osm_id":2464649,"lat":"35.5697958","lon":"-5.3746918","class":"boundary","type":"administrative","place_rank":16,"importance":0.5656022813621683,"addresstype":"city","name":"Tétouan تطوان","display_name":"Tétouan تطوان, Pachalik de Tétouan باشوية تطوان, Tetouan Province, Tangier-Tetouan-Al Hoceima, Morocco","address":{"city":"Tétouan تطوان","county":"Pachalik de Tétouan باشوية تطوان","state_district":"Tetouan Province","ISO3166-2-lvl5":"MA-TET","state":"Tangier-Tetouan-Al Hoceima","ISO3166-2-lvl4":"MA-01","country":"Morocco","country_code":"ma"},"boundingbox":["35.5410698","35.6106991","-5.4303242","-5.2611430"]}]
---STATUS:200 TIME:0.944409


##### LOCAL curl :: Xqzzyvv, Nowhere

>>> [2026-09-19T11:18:36.447Z] curl -sS -i --max-time 30 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -H 'User-Agent: GreenEnergyCalculator/1.0' https://nominatim.openstreetmap.org/search?q=Xqzzyvv%2C%20Nowhere&format=json&limit=1&addressdetails=1&accept-language=en
HTTP/1.1 200 OK
Connection: keep-alive
Content-Length: 2
server: gunicorn/asgi
x-nominatim-server: longma.openstreetmap.org
content-type: application/json; charset=utf-8
Accept-Ranges: bytes
Age: 0
Date: Sat, 19 Sep 2026 11:18:36 GMT
Via: 1.1 varnish
X-Served-By: cache-lin1730073-LIN, cache-lin1730051-LIN
X-Cache: MISS, MISS
X-Cache-Hits: 0, 0
X-Timer: S1789816716.998648,VS0,VE66
Vary: accept-language, Accept-Encoding
Strict-Transport-Security: max-age=300
alt-svc: h3=":443";ma=86400,h3-29=":443";ma=86400,h3-27=":443";ma=86400

[]
---STATUS:200 TIME:0.313623


=== LOCAL 0e (Node fetch, verbatim geocode() request incl. undici default headers) START 2026-09-19T11:18:38.068Z

##### LOCAL node-fetch :: Paris, France
[2026-09-19T11:18:39.295Z] STATUS:200 ok:true TIME:1228ms
accept-ranges: bytes
age: 0
alt-svc: h3=":443";ma=86400,h3-29=":443";ma=86400,h3-27=":443";ma=86400
connection: keep-alive
content-encoding: br
content-length: 378
content-type: application/json; charset=utf-8
date: Sat, 19 Sep 2026 11:18:38 GMT
server: gunicorn/asgi
strict-transport-security: max-age=300
vary: accept-language, Accept-Encoding
via: 1.1 varnish
x-cache: MISS, MISS
x-cache-hits: 0, 0
x-nominatim-server: dulcy.openstreetmap.org
x-served-by: cache-lin1730068-LIN, cache-lin1730042-LIN
x-timer: S1789816718.711106,VS0,VE726
BODY: [{"place_id":97554783,"licence":"Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright","osm_type":"relation","osm_id":7444,"lat":"48.8588897","lon":"2.3200410","class":"boundary","type":"administrative","place_rank":15,"importance":0.897098092136026,"addresstype":"suburb","name":"Paris","display_name":"Paris, Ile-de-France, Metropolitan France, France","address":{"suburb":"Paris","city_district":"Paris","city":"Paris","ISO3166-2-lvl6":"FR-75C","state":"Ile-de-France","ISO3166-2-lvl4":"FR-IDF","region":"Metropolitan France","country":"France","country_code":"fr"},"boundingbox":["48.8155755","48.9021560","2.2241220","2.4697602"]}]

##### LOCAL node-fetch :: Madrid, Spain
[2026-09-19T11:18:41.030Z] STATUS:200 ok:true TIME:522ms
accept-ranges: bytes
age: 0
alt-svc: h3=":443";ma=86400,h3-29=":443";ma=86400,h3-27=":443";ma=86400
connection: keep-alive
content-encoding: br
content-length: 336
content-type: application/json; charset=utf-8
date: Sat, 19 Sep 2026 11:18:40 GMT
server: gunicorn/asgi
strict-transport-security: max-age=300
vary: accept-language, Accept-Encoding
via: 1.1 varnish
x-cache: MISS, MISS
x-cache-hits: 0, 0
x-nominatim-server: vhagar.openstreetmap.org
x-served-by: cache-lin1730040-LIN, cache-lin1730042-LIN
x-timer: S1789816720.800720,VS0,VE427
BODY: [{"place_id":296256487,"licence":"Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright","osm_type":"relation","osm_id":5326784,"lat":"40.4167820","lon":"-3.7035070","class":"boundary","type":"administrative","place_rank":16,"importance":0.8186903991321961,"addresstype":"city","name":"Madrid","display_name":"Madrid, Community of Madrid, Spain","address":{"city":"Madrid","state":"Community of Madrid","ISO3166-2-lvl4":"ES-MD","country":"Spain","country_code":"es"},"boundingbox":["40.3119774","40.6437293","-3.8889539","-3.5183264"]}]

##### LOCAL node-fetch :: Almeria, Spain
[2026-09-19T11:18:43.205Z] STATUS:200 ok:true TIME:965ms
accept-ranges: bytes
age: 0
alt-svc: h3=":443";ma=86400,h3-29=":443";ma=86400,h3-27=":443";ma=86400
connection: keep-alive
content-encoding: br
content-length: 347
content-type: application/json; charset=utf-8
date: Sat, 19 Sep 2026 11:18:42 GMT
server: gunicorn/asgi
strict-transport-security: max-age=300
vary: accept-language, Accept-Encoding
via: 1.1 varnish
x-cache: MISS, MISS
x-cache-hits: 0, 0
x-nominatim-server: poldi.openstreetmap.org
x-served-by: cache-lin1730078-LIN, cache-lin1730042-LIN
x-timer: S1789816722.558679,VS0,VE732
BODY: [{"place_id":292597581,"licence":"Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright","osm_type":"relation","osm_id":347796,"lat":"36.8685739","lon":"-2.3120282","class":"boundary","type":"administrative","place_rank":16,"importance":0.6295518492517769,"addresstype":"city","name":"Almeria","display_name":"Almeria, Andalusia, Spain","address":{"city":"Almeria","province":"Almeria","ISO3166-2-lvl6":"ES-AL","state":"Andalusia","ISO3166-2-lvl4":"ES-AN","country":"Spain","country_code":"es"},"boundingbox":["35.9376398","37.0000125","-3.0372135","-2.2022024"]}]

##### LOCAL node-fetch :: Berlin, Germany
[2026-09-19T11:18:44.830Z] STATUS:200 ok:true TIME:425ms
accept-ranges: bytes
age: 0
alt-svc: h3=":443";ma=86400,h3-29=":443";ma=86400,h3-27=":443";ma=86400
connection: keep-alive
content-encoding: br
content-length: 314
content-type: application/json; charset=utf-8
date: Sat, 19 Sep 2026 11:18:44 GMT
server: gunicorn/asgi
strict-transport-security: max-age=300
vary: accept-language, Accept-Encoding
via: 1.1 varnish
x-cache: MISS, MISS
x-cache-hits: 0, 0
x-nominatim-server: vhagar.openstreetmap.org
x-served-by: cache-lin1730082-LIN, cache-lin1730042-LIN
x-timer: S1789816724.730088,VS0,VE301
BODY: [{"place_id":145205353,"licence":"Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright","osm_type":"relation","osm_id":62422,"lat":"52.5173885","lon":"13.3951309","class":"boundary","type":"administrative","place_rank":8,"importance":0.8522196536088086,"addresstype":"city","name":"Berlin","display_name":"Berlin, Germany","address":{"city":"Berlin","ISO3166-2-lvl4":"DE-BE","country":"Germany","country_code":"de"},"boundingbox":["52.3382448","52.6755087","13.0883450","13.7611609"]}]

##### LOCAL node-fetch :: Fuengirola, Spain
[2026-09-19T11:18:46.250Z] STATUS:200 ok:true TIME:208ms
accept-ranges: bytes
age: 0
alt-svc: h3=":443";ma=86400,h3-29=":443";ma=86400,h3-27=":443";ma=86400
connection: keep-alive
content-encoding: br
content-length: 403
content-type: application/json; charset=utf-8
date: Sat, 19 Sep 2026 11:18:45 GMT
server: gunicorn/asgi
strict-transport-security: max-age=300
vary: accept-language, Accept-Encoding
via: 1.1 varnish
x-cache: MISS, MISS
x-cache-hits: 0, 0
x-nominatim-server: vhagar.openstreetmap.org
x-served-by: cache-lin1730027-LIN, cache-lin1730042-LIN
x-timer: S1789816725.338189,VS0,VE111
BODY: [{"place_id":295472761,"licence":"Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright","osm_type":"relation","osm_id":345414,"lat":"36.5388398","lon":"-4.6233974","class":"boundary","type":"administrative","place_rank":16,"importance":0.5257237258429168,"addresstype":"city","name":"Fuengirola","display_name":"Fuengirola, Costa del Sol Occidental, Malaga, Andalusia, 29640, Spain","address":{"city":"Fuengirola","county":"Costa del Sol Occidental","state_district":"Malaga","ISO3166-2-lvl6":"ES-MA","state":"Andalusia","ISO3166-2-lvl4":"ES-AN","postcode":"29640","country":"Spain","country_code":"es"},"boundingbox":["36.5190239","36.5896933","-4.6366187","-4.5897986"]}]

##### LOCAL node-fetch :: Tétouan, Morocco
[2026-09-19T11:18:47.675Z] STATUS:200 ok:true TIME:215ms
accept-ranges: bytes
age: 0
alt-svc: h3=":443";ma=86400,h3-29=":443";ma=86400,h3-27=":443";ma=86400
connection: keep-alive
content-encoding: br
content-length: 438
content-type: application/json; charset=utf-8
date: Sat, 19 Sep 2026 11:18:46 GMT
server: gunicorn/asgi
strict-transport-security: max-age=300
vary: accept-language, Accept-Encoding
via: 1.1 varnish
x-cache: MISS, MISS
x-cache-hits: 0, 0
x-nominatim-server: vhagar.openstreetmap.org
x-served-by: cache-lin1730043-LIN, cache-lin1730042-LIN
x-timer: S1789816727.765639,VS0,VE109
BODY: [{"place_id":297329172,"licence":"Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright","osm_type":"relation","osm_id":2464649,"lat":"35.5697958","lon":"-5.3746918","class":"boundary","type":"administrative","place_rank":16,"importance":0.5656022813621683,"addresstype":"city","name":"Tétouan تطوان","display_name":"Tétouan تطوان, Pachalik de Tétouan باشوية تطوان, Tetouan Province, Tangier-Tetouan-Al Hoceima, Morocco","address":{"city":"Tétouan تطوان","county":"Pachalik de Tétouan باشوية تطوان","state_district":"Tetouan Province","ISO3166-2-lvl5":"MA-TET","state":"Tangier-Tetouan-Al Hoceima","ISO3166-2-lvl4":"MA-01","country":"Morocco","country_code":"ma"},"boundingbox":["35.5410698","35.6106991","-5.4303242","-5.2611430"]}]

##### LOCAL node-fetch :: Xqzzyvv, Nowhere
[2026-09-19T11:18:49.504Z] STATUS:200 ok:true TIME:622ms
accept-ranges: bytes
age: 0
alt-svc: h3=":443";ma=86400,h3-29=":443";ma=86400,h3-27=":443";ma=86400
connection: keep-alive
content-encoding: br
content-length: 7
content-type: application/json; charset=utf-8
date: Sat, 19 Sep 2026 11:18:48 GMT
server: gunicorn/asgi
strict-transport-security: max-age=300
vary: accept-language, Accept-Encoding
via: 1.1 varnish
x-cache: MISS, MISS
x-cache-hits: 0, 0
x-nominatim-server: poldi.openstreetmap.org
x-served-by: cache-lin1730073-LIN, cache-lin1730042-LIN
x-timer: S1789816728.166831,VS0,VE533
BODY: []

=== 0f CONTROL, direct again 2026-09-19T11:18:50.706Z

>>> [2026-09-19T11:18:50.706Z] curl -sS -i --max-time 30 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -H 'User-Agent: GreenEnergyCalculator/1.0' https://nominatim.openstreetmap.org/search?q=Xqzzyvv%2C%20Nowhere&format=json&limit=1&addressdetails=1&accept-language=en
HTTP/1.1 200 OK
Connection: keep-alive
Content-Length: 2
server: gunicorn/asgi
x-nominatim-server: poldi.openstreetmap.org
content-type: application/json; charset=utf-8
Accept-Ranges: bytes
Age: 0
Date: Sat, 19 Sep 2026 11:18:50 GMT
Via: 1.1 varnish
X-Served-By: cache-mxp6930-MXP, cache-mxp6959-MXP
X-Cache: MISS, MISS
X-Cache-Hits: 0, 0
X-Timer: S1789816730.303761,VS0,VE534
Vary: accept-language, Accept-Encoding
Strict-Transport-Security: max-age=300
alt-svc: h3=":443";ma=86400,h3-29=":443";ma=86400,h3-27=":443";ma=86400

[]
---STATUS:200 TIME:0.842901


=== DONE 2026-09-19T11:18:51.650Z
node v24.18.0
```

## Appendix B — raw output, Tétouan redo (`probe-tetouan.mjs`, 11:20:12Z → 11:20:19Z)

ASCII-escaped JSON body; this is the valid Tétouan measurement. (The first ~1,500 chars per response were shown while working; the appendix is the full file.)

```
=== TETOUAN REDO RENDER START 2026-09-19T11:20:12.284Z

>>> [2026-09-19T11:20:12.292Z] curl -sS -i --max-time 100 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -X POST https://voltura-api.onrender.com/api/calculate -H 'Content-Type: application/json; charset=utf-8' -H 'X-Session-Id: b2step0-probe-0000-4000-8000-000000000001' --data-binary '{"location":"T\u00e9touan, Morocco","energyUsage":5000,"pvWattage":4000,"batteryCapacity":10}'
HTTP/1.1 200 OK
Date: Sat, 19 Sep 2026 11:20:12 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
access-control-allow-origin: https://voltura-web.onrender.com
etag: W/"eb0-UKfYunNl6rcs5Dj8Z1mwKEyloHo"
rndr-id: 063c60b4-3d57-4df3
Server: cloudflare
vary: Origin
vary: Accept-Encoding
x-powered-by: Express
x-render-origin-server: Render
cf-cache-status: DYNAMIC
CF-RAY: a3d83322bc95c8e8-MRS
alt-svc: h3=":443"; ma=86400

{"savingsKwh":3883,"co2Reduction":2109,"annualSavingsEur":970.75,"carbonIntensity":0.543,"avgIrradiance":5.08,"irradianceSource":"nasa-live","recommendation":"Great result! Your system covers 78% of your energy, saving €971/year. A slightly larger battery could push you closer to 100%.","breakdown":{"solar":78,"battery":0,"grid":22},"monthlyData":[{"month":1,"name":"Jan","generationKwh":270.9,"consumptionKwh":573.1,"savingsKwh":266.7,"gridImportKwh":306.3,"co2Kg":144.8},{"month":2,"name":"Feb","generationKwh":316,"consumptionKwh":491.8,"savingsKwh":306.8,"gridImportKwh":185,"co2Kg":166.6},{"month":3,"name":"Mar","generationKwh":441,"consumptionKwh":498.2,"savingsKwh":422.6,"gridImportKwh":75.6,"co2Kg":229.5},{"month":4,"name":"Apr","generationKwh":524.2,"consumptionKwh":415.6,"savingsKwh":413.9,"gridImportKwh":1.7,"co2Kg":224.7},{"month":5,"name":"May","generationKwh":667.4,"consumptionKwh":361.2,"savingsKwh":361.2,"gridImportKwh":0,"co2Kg":196.1},{"month":6,"name":"Jun","generationKwh":697,"consumptionKwh":299.8,"savingsKwh":299.8,"gridImportKwh":0,"co2Kg":162.8},{"month":7,"name":"Jul","generationKwh":726.8,"consumptionKwh":287.4,"savingsKwh":287.4,"gridImportKwh":0,"co2Kg":156.1},{"month":8,"name":"Aug","generationKwh":654.5,"consumptionKwh":303.3,"savingsKwh":303.3,"gridImportKwh":0,"co2Kg":164.7},{"month":9,"name":"Sep","generationKwh":502.6,"consumptionKwh":334.5,"savingsKwh":334.5,"gridImportKwh":0,"co2Kg":181.6},{"month":10,"name":"Oct","generationKwh":395.4,"consumptionKwh":413.6,"savingsKwh":383.4,"gridImportKwh":30.2,"co2Kg":208.2},{"month":11,"name":"Nov","generationKwh":280.2,"consumptionKwh":476.6,"savingsKwh":274,"gridImportKwh":202.6,"co2Kg":148.8},{"month":12,"name":"Dec","generationKwh":232.1,"consumptionKwh":544.9,"savingsKwh":229.4,"gridImportKwh":315.5,"co2Kg":124.6}],"installationCostEur":9800,"paybackYears":9.5,"roiCurve":[{"year":0,"cumulativeSavings":0,"netPosition":-9800},{"year":1,"cumulativeSavings":971,"netPosition":-8829},{"year":2,"cumulativeSavings":1956,"netPosition":-7844},{"year":3,"cumulativeSavings":2956,"netPosition":-6844},{"year":4,"cumulativeSavings":3971,"netPosition":-5829},{"year":5,"cumulativeSavings":5002,"netPosition":-4798},{"year":6,"cumulativeSavings":6047,"netPosition":-3753},{"year":7,"cumulativeSavings":7109,"netPosition":-2691},{"year":8,"cumulativeSavings":8186,"netPosition":-1614},{"year":9,"cumulativeSavings":9280,"netPosition":-520},{"year":10,"cumulativeSavings":10390,"netPosition":590},{"year":11,"cumulativeSavings":11516,"netPosition":1716},{"year":12,"cumulativeSavings":12660,"netPosition":2860},{"year":13,"cumulativeSavings":13820,"netPosition":4020},{"year":14,"cumulativeSavings":14998,"netPosition":5198},{"year":15,"cumulativeSavings":16194,"netPosition":6394},{"year":16,"cumulativeSavings":17408,"netPosition":7608},{"year":17,"cumulativeSavings":18640,"netPosition":8840},{"year":18,"cumulativeSavings":19890,"netPosition":10090},{"year":19,"cumulativeSavings":21159,"netPosition":11359},{"year":20,"cumulativeSavings":22447,"netPosition":12647},{"year":21,"cumulativeSavings":23755,"netPosition":13955},{"year":22,"cumulativeSavings":25082,"netPosition":15282},{"year":23,"cumulativeSavings":26429,"netPosition":16629},{"year":24,"cumulativeSavings":27796,"netPosition":17996},{"year":25,"cumulativeSavings":29184,"netPosition":19384}],"resolution":{"locationInput":"Tétouan, Morocco","geocodeStatus":"resolved","lat":35.5698,"lon":-5.3747,"irradianceSource":"nasa-live","irradiancePeriod":{"start":2019,"end":2023},"nasaHttpStatus":200,"nasaKeysRequested":["201901","201902","201903"],"nasaKeysPresent":["201901","201902","201903"],"irradianceMonthly":[2.8439,3.6724,4.6287,5.6859,7.0049,7.5598,7.6291,6.8699,5.4517,4.1508,3.0391,2.4359]}}
---STATUS:200 TIME:1.093822


>>> [2026-09-19T11:20:13.589Z] curl -sS -i --max-time 100 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -X POST https://voltura-api.onrender.com/api/optimize -H 'Content-Type: application/json; charset=utf-8' --data-binary '{"location":"T\u00e9touan, Morocco","annualUsageKwh":5000,"energyPattern":[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]}'
HTTP/1.1 200 OK
Date: Sat, 19 Sep 2026 11:20:17 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
access-control-allow-origin: https://voltura-web.onrender.com
etag: W/"5ed-cXrq4H+tcVUEkh1dJp3JzYNvTv0"
ratelimit: limit=10, remaining=8, reset=791
ratelimit-policy: 10;w=900
rndr-id: 4644209c-8e9f-4063
Server: cloudflare
vary: Origin
vary: Accept-Encoding
x-powered-by: Express
x-render-origin-server: Render
cf-cache-status: DYNAMIC
CF-RAY: a3d8332a7ca0f4f6-MRS
alt-svc: h3=":443"; ma=86400

{"optimalPv":3371,"optimalBattery":7.13,"explanation":"At the latitude 35.5698 and longitude -5.3747 the mean daily irradiance measured by NASA POWER is 5.08 kWh/m2/day. Using the performance ratio of 0.8 the computed PV size of 3.371 kWp (3371 W) was matched to the metered annual use of 5000 kWh, achieving the coverage target of 100% (1). The average daily use of 13.699 kWh includes 5.137 kWh that must be supplied during the 9 hours when the array produces nothing. A battery rated at 7.13 kWh, with a usable depth of discharge of 0.8 and a round‑trip efficiency of 0.9, provides enough stored energy to meet that 5.137 kWh requirement, ensuring continuous supply. Therefore the recommended array and battery are appropriately sized for the location’s solar resource and the household’s load profile.","sizing":{"pvKwp":3.371,"pvWatts":3371,"batteryKwh":7.13,"annualUsageKwh":5000,"dailyUsageKwh":13.699,"nightUsageKwh":5.137,"nightShare":0.375,"darkHours":9,"irradianceKwhM2Day":5.08,"coverageTarget":1,"performanceRatio":0.8,"roundTripEfficiency":0.9,"usableDepthOfDischarge":0.8,"daysPerYear":365},"resolution":{"locationInput":"Tétouan, Morocco","geocodeStatus":"resolved","lat":35.5698,"lon":-5.3747,"irradianceSource":"nasa-live","irradiancePeriod":{"start":2019,"end":2023},"nasaHttpStatus":200,"nasaKeysRequested":["201901","201902","201903"],"nasaKeysPresent":["201901","201902","201903"],"irradianceMonthly":[2.8439,3.6724,4.6287,5.6859,7.0049,7.5598,7.6291,6.8699,5.4517,4.1508,3.0391,2.4359]}}
---STATUS:200 TIME:4.725606

=== TETOUAN REDO LOCAL START 2026-09-19T11:20:18.456Z

>>> [2026-09-19T11:20:18.456Z] curl -sS -i --max-time 30 -w '
---STATUS:%{http_code} TIME:%{time_total}
' -H 'User-Agent: GreenEnergyCalculator/1.0' https://nominatim.openstreetmap.org/search?q=T%C3%A9touan%2C%20Morocco&format=json&limit=1&addressdetails=1&accept-language=en
HTTP/1.1 200 OK
Connection: keep-alive
Content-Length: 792
server: gunicorn/asgi
x-nominatim-server: poldi.openstreetmap.org
content-type: application/json; charset=utf-8
Accept-Ranges: bytes
Age: 0
Date: Sat, 19 Sep 2026 11:20:18 GMT
Via: 1.1 varnish
X-Served-By: cache-mxp6973-MXP, cache-mxp6969-MXP
X-Cache: MISS, MISS
X-Cache-Hits: 0, 0
X-Timer: S1789816818.101271,VS0,VE621
Vary: accept-language, Accept-Encoding
Strict-Transport-Security: max-age=300
alt-svc: h3=":443";ma=86400,h3-29=":443";ma=86400,h3-27=":443";ma=86400

[{"place_id":294709828,"licence":"Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright","osm_type":"relation","osm_id":2464649,"lat":"35.5697958","lon":"-5.3746918","class":"boundary","type":"administrative","place_rank":16,"importance":0.5656022813621683,"addresstype":"city","name":"Tétouan تطوان","display_name":"Tétouan تطوان, Pachalik de Tétouan باشوية تطوان, Tetouan Province, Tangier-Tetouan-Al Hoceima, Morocco","address":{"city":"Tétouan تطوان","county":"Pachalik de Tétouan باشوية تطوان","state_district":"Tetouan Province","ISO3166-2-lvl5":"MA-TET","state":"Tangier-Tetouan-Al Hoceima","ISO3166-2-lvl4":"MA-01","country":"Morocco","country_code":"ma"},"boundingbox":["35.5410698","35.6106991","-5.4303242","-5.2611430"]}]
---STATUS:200 TIME:0.994533

=== DONE 2026-09-19T11:20:19.537Z
```

## Appendix C — Render deploy history (`list_deploys`, `serviceId srv-d8q8vumgvqtc73a1ik90`)

Fields transcribed from the tool result (commit message bodies omitted; the ones relevant here are quoted verbatim in §2). Times are UTC.

| Deploy id | Commit | Trigger | Started | Finished | Status |
|---|---|---|---|---|---|
| dep-dahtspdg1s2s73d8cj20 | `b1f2c99` | new_commit | 2026-09-11T10:56:37.34112Z | 2026-09-11T10:57:35.614903Z | **live** |
| dep-dahtns91tnps73f1971g | `e165de5` | new_commit | 2026-09-11T10:46:45.270015Z | 2026-09-11T10:47:41.346762Z | deactivated |
| dep-dahtnmtg1s2s73d86mh0 | `3fa864d` | new_commit | 2026-09-11T10:45:47.258873Z | 2026-09-11T10:46:45.010457Z | deactivated |
| dep-dahtklh5efls738esg3g | `4afdf95` | new_commit | 2026-09-11T10:39:18.712437Z | 2026-09-11T10:40:19.878657Z | deactivated |
| dep-dahk5ejm8hqs73c49j9g | `c459b0d` | manual | 2026-09-10T23:52:26.838884Z | 2026-09-10T23:53:28.159727Z | deactivated |
| dep-dahk2k5g1s2s73d06fb0 | `c459b0d` | new_commit | 2026-09-10T23:46:24.378184Z | 2026-09-10T23:47:18.39079Z | deactivated |
| dep-dahjs1ifngtc73a1dfqg | `e69b750` | manual | 2026-09-10T23:32:22.438437Z | 2026-09-10T23:33:24.558563Z | deactivated |
| dep-daheim7avr4c738thnhg | `e69b750` | new_commit | 2026-09-10T17:31:04.121346Z | 2026-09-10T17:32:17.693435Z | deactivated |
| dep-dahefiqjnfac738lb2k0 | `b15e274` | new_commit | 2026-09-10T17:24:27.468727Z | 2026-09-10T17:25:25.514414Z | deactivated |
| dep-dah1j8psrm7s73926qfg | `1ce9199` | new_commit | 2026-09-10T02:44:51.640622Z | 2026-09-10T02:45:56.225033Z | deactivated |

Older entries (2026-08-25, 2026-08-27) exist and are not relevant. Last deploy before now: **2026-09-11T10:57:35Z**. Nothing after it.

## Appendix D — mechanical extraction (`extract.mjs`)

Derived from Appendices A and B by a script, to avoid retyping the tables in §4 and §6. Note the "TETOUAN REDO" block printed nothing because my regex did not match that file's layout; the redo's fields in §4 were read directly with `grep -o '"resolution":{...'` from Appendix B instead.

```
--- RENDER (run 1) key fields ---
RENDER /api/calculate :: Paris, France | ---STATUS:200 | geocodeStatus=resolved lat=48.8535 lon=2.3484 irradianceSource=nasa-live nasaHttpStatus=200 code=- carbonIntensity=0.083
RENDER /api/optimize :: Paris, France | ---STATUS:200 | geocodeStatus=resolved lat=48.8535 lon=2.3484 irradianceSource=nasa-live nasaHttpStatus=200 code=- carbonIntensity=-
RENDER /api/calculate :: Madrid, Spain | ---STATUS:200 | geocodeStatus=resolved lat=40.4168 lon=-3.7035 irradianceSource=nasa-live nasaHttpStatus=200 code=- carbonIntensity=0.244
RENDER /api/optimize :: Madrid, Spain | ---STATUS:200 | geocodeStatus=resolved lat=40.4168 lon=-3.7035 irradianceSource=nasa-live nasaHttpStatus=200 code=- carbonIntensity=-
RENDER /api/calculate :: Almeria, Spain | ---STATUS:200 | geocodeStatus=resolved lat=36.8686 lon=-2.312 irradianceSource=nasa-live nasaHttpStatus=200 code=- carbonIntensity=0.244
RENDER /api/optimize :: Almeria, Spain | ---STATUS:200 | geocodeStatus=resolved lat=36.8686 lon=-2.312 irradianceSource=nasa-live nasaHttpStatus=200 code=- carbonIntensity=-
RENDER /api/calculate :: Berlin, Germany | ---STATUS:200 | geocodeStatus=resolved lat=52.5174 lon=13.3951 irradianceSource=nasa-live nasaHttpStatus=200 code=- carbonIntensity=0.401
RENDER /api/optimize :: Berlin, Germany | ---STATUS:200 | geocodeStatus=resolved lat=52.5174 lon=13.3951 irradianceSource=nasa-live nasaHttpStatus=200 code=- carbonIntensity=-
RENDER /api/calculate :: Fuengirola, Spain | ---STATUS:200 | geocodeStatus=resolved lat=36.5388 lon=-4.6234 irradianceSource=nasa-live nasaHttpStatus=200 code=- carbonIntensity=0.244
RENDER /api/optimize :: Fuengirola, Spain | ---STATUS:200 | geocodeStatus=resolved lat=36.5388 lon=-4.6234 irradianceSource=nasa-live nasaHttpStatus=200 code=- carbonIntensity=-
RENDER /api/calculate :: Tétouan, Morocco | ---STATUS:422 | geocodeStatus=failed lat=null lon=null irradianceSource=not-reached nasaHttpStatus=not-called code=geocode_failed carbonIntensity=-
RENDER /api/optimize :: Tétouan, Morocco | ---STATUS:422 | geocodeStatus=failed lat=null lon=null irradianceSource=not-reached nasaHttpStatus=not-called code=geocode_failed carbonIntensity=-
RENDER /api/calculate :: Xqzzyvv, Nowhere | ---STATUS:422 | geocodeStatus=failed lat=null lon=null irradianceSource=not-reached nasaHttpStatus=not-called code=geocode_failed carbonIntensity=-
RENDER /api/optimize :: Xqzzyvv, Nowhere | ---STATUS:422 | geocodeStatus=failed lat=null lon=null irradianceSource=not-reached nasaHttpStatus=not-called code=geocode_failed carbonIntensity=-
--- TETOUAN REDO ---
--- LOCAL curl (run 1) first result ---
LOCAL curl :: Paris, France | ---STATUS:200 | n=1 lat=48.8534951 lon=2.3483915 country=France place_id=97620444 | nominatim-server vhagar.openstreetmap.org
LOCAL curl :: Madrid, Spain | ---STATUS:200 | n=1 lat=40.4167820 lon=-3.7035070 country=Spain place_id=295969504 | nominatim-server dulcy.openstreetmap.org
LOCAL curl :: Almeria, Spain | ---STATUS:200 | n=1 lat=36.8685739 lon=-2.3120282 country=Spain place_id=295192953 | nominatim-server vhagar.openstreetmap.org
LOCAL curl :: Berlin, Germany | ---STATUS:200 | n=1 lat=52.5173885 lon=13.3951309 country=Germany place_id=145306205 | nominatim-server longma.openstreetmap.org
LOCAL curl :: Fuengirola, Spain | ---STATUS:200 | n=1 lat=36.5388398 lon=-4.6233974 country=Spain place_id=295472761 | nominatim-server vhagar.openstreetmap.org
LOCAL curl :: Tétouan, Morocco | ---STATUS:200 | n=1 lat=35.5697958 lon=-5.3746918 country=Morocco place_id=294709828 | nominatim-server poldi.openstreetmap.org
LOCAL curl :: Xqzzyvv, Nowhere | ---STATUS:200 | n=0 (empty array) | nominatim-server longma.openstreetmap.org
--- LOCAL node-fetch (run 1) ---
LOCAL node-fetch :: Paris, France | 200 true 1228 | n=1 lat=48.8588897 lon=2.3200410 country=France
LOCAL node-fetch :: Madrid, Spain | 200 true 522 | n=1 lat=40.4167820 lon=-3.7035070 country=Spain
LOCAL node-fetch :: Almeria, Spain | 200 true 965 | n=1 lat=36.8685739 lon=-2.3120282 country=Spain
LOCAL node-fetch :: Berlin, Germany | 200 true 425 | n=1 lat=52.5173885 lon=13.3951309 country=Germany
LOCAL node-fetch :: Fuengirola, Spain | 200 true 208 | n=1 lat=36.5388398 lon=-4.6233974 country=Spain
LOCAL node-fetch :: Tétouan, Morocco | 200 true 215 | n=1 lat=35.5697958 lon=-5.3746918 country=Morocco
LOCAL node-fetch :: Xqzzyvv, Nowhere | 200 true 622 | n=0 (empty array)
```
