(() => {
  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(location.search);
  const SLUG = qs.get("r") || qs.get("slug") || "el-atun-demo";
  const SOURCE = ["instagram", "google_link"].includes(qs.get("source")) ? qs.get("source") : "widget";
  if (qs.get("embed") === "1") document.body.classList.add("embedded");

  const S = { cfg: null, lang: "es", party: 2, date: null, area: null, slot: null, req: 0, sending: false };
  const t = (k, v) => fmt((I18N[S.lang] && I18N[S.lang][k]) || I18N.es[k] || k, v);

  // ---------- daty w strefie czasowej lokalu ----------
  const tz = () => (S.cfg && S.cfg.timezone) || "Europe/Madrid";
  const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: tz() }).format(new Date());
  const addDays = (iso, n) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
  };
  const isoToDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
  const fmtDay = (iso, opts) => new Intl.DateTimeFormat(S.lang, { timeZone: "UTC", ...opts }).format(isoToDate(iso));
  const fmtTime = (ts) => new Intl.DateTimeFormat(S.lang, { hour: "2-digit", minute: "2-digit", timeZone: tz() }).format(new Date(ts));
  const fmtWhen = (ts) =>
    new Intl.DateTimeFormat(S.lang, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: tz() })
      .format(new Date(ts));
  const partyLabel = (n) => (n === 1 ? t("person") : t("people", { n }));
  const money = (cents) => new Intl.NumberFormat(S.lang, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);

  // ---------- API ----------
  async function api(params, body) {
    const url = API + (body ? "" : "?" + new URLSearchParams(params));
    const res = await fetch(url, body
      ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...params, ...body }) }
      : {});
    let data = {};
    try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, data };
  }

  // ---------- teksty ----------
  function renderTexts() {
    document.documentElement.lang = S.lang;
    const set = (id, k, v) => { const el = $(id); if (el) el.textContent = t(k, v); };
    set("title", "title"); set("lblGuests", "guests"); set("lblDate", "date"); set("lblOther", "pickDate");
    set("lblArea", "area"); set("lblTimes", "times"); set("lblDetails", "yourDetails"); set("back", "change");
    set("lblName", "name"); set("lblEmail", "email"); set("lblPhone", "phone"); set("lblPhoneHint", "phoneHint");
    set("lblNote", "note"); set("lblHealth", "healthConsent"); set("lblMarketing", "marketing");
    set("lblCardTitle", "cardTitle"); set("lblPolicy", "policy"); set("lblPrivacy", "privacy");
    set("submit", S.sending ? "sending" : "confirm"); set("again", "another");
    $("fNote").placeholder = t("notePh");
    document.title = (S.cfg ? S.cfg.name + " · " : "") + t("title");
    const langs = (S.cfg && S.cfg.languages) || ["es", "en", "de", "fr"];
    $("langs").innerHTML = "";
    langs.filter((l) => I18N[l]).forEach((l) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = l; b.setAttribute("aria-pressed", String(l === S.lang));
      b.onclick = () => { S.lang = l; renderAll(); };
      $("langs").appendChild(b);
    });
  }

  function renderParty() {
    const max = (S.cfg && S.cfg.max_party_online) || 12;
    $("partyOut").textContent = partyLabel(S.party);
    $("minus").disabled = S.party <= 1;
    $("plus").disabled = S.party >= max;
    $("largeGroup").hidden = S.party < max;
    $("largeGroup").textContent = t("largeGroup", { n: max });
  }

  function renderDays() {
    const box = $("days");
    box.innerHTML = "";
    const start = todayISO();
    for (let i = 0; i < 14; i++) {
      const iso = addDays(start, i);
      const b = document.createElement("button");
      b.type = "button"; b.className = "day";
      b.setAttribute("aria-pressed", String(iso === S.date));
      b.innerHTML = `<span class="dow"></span><span class="num"></span><span class="mon"></span>`;
      b.children[0].textContent = fmtDay(iso, { weekday: "short" });
      b.children[1].textContent = fmtDay(iso, { day: "numeric" });
      b.children[2].textContent = fmtDay(iso, { month: "short" });
      b.onclick = () => setDate(iso);
      box.appendChild(b);
    }
    const inp = $("dateInput");
    inp.min = start;
    inp.max = addDays(start, (S.cfg && S.cfg.booking_window_days) || 60);
    inp.value = S.date || "";
  }

  function renderAreas() {
    const areas = (S.cfg && S.cfg.areas) || [];
    $("areaSection").hidden = areas.length < 2;
    const box = $("areas");
    box.innerHTML = "";
    [{ id: null, name: t("anyArea") }, ...areas].forEach((a) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = a.name;
      b.setAttribute("aria-pressed", String(a.id === S.area));
      b.onclick = () => { S.area = a.id; renderAreas(); loadSlots(); };
      box.appendChild(b);
    });
  }

  function setDate(iso) {
    S.date = iso;
    renderDays();
    loadSlots();
    const sel = $("days").querySelector('[aria-pressed="true"]');
    if (sel) sel.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }

  // ---------- sloty ----------
  async function loadSlots() {
    const box = $("slots");
    const my = ++S.req;
    box.innerHTML = `<p class="msg">${t("loading")}</p>`;
    const { ok, status, data } = await api({ action: "availability", slug: SLUG, date: S.date, party: S.party, ...(S.area ? { area: S.area } : {}) });
    if (my !== S.req) return; // nowsze zapytanie w drodze
    if (!ok) { box.innerHTML = `<p class="msg err">${status === 429 ? t("errTooMany") : t("errGeneric")}</p>`; return; }
    const slots = data.slots || [];
    if (!slots.length) { box.innerHTML = `<p class="msg">${t("closed")}</p>`; return; }
    const free = slots.filter((s) => s.available);
    if (!free.length) { box.innerHTML = `<p class="msg">${t("noTimes")}</p>`; return; }
    box.innerHTML = "";
    const byService = {};
    free.forEach((s) => (byService[s.service] = byService[s.service] || []).push(s));
    Object.entries(byService).forEach(([name, list]) => {
      const wrap = document.createElement("div");
      wrap.className = "service";
      wrap.innerHTML = `<div class="service-name"></div><div class="slots"></div>`;
      wrap.firstChild.textContent = name;
      list.forEach((s) => wrap.lastChild.appendChild(slotButton(s.time)));
      box.appendChild(wrap);
    });
  }

  function slotButton(time) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "slot"; b.textContent = fmtTime(time);
    b.onclick = () => chooseSlot(time);
    return b;
  }

  // ---------- formularz ----------
  function cardNeeded() {
    const p = (S.cfg && S.cfg.card_policy) || {};
    const month = Number(S.date.slice(5, 7));
    return (p.min_party != null && S.party >= p.min_party) || (p.months || []).includes(month);
  }

  function chooseSlot(time) {
    S.slot = time;
    $("stepPick").hidden = true;
    $("stepForm").hidden = false;
    $("formErr").hidden = true;
    $("alts").hidden = true;
    renderForm();
    $("fName").focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }

  function renderForm() {
    if (!S.slot) return;
    $("sumWhen").textContent = fmtWhen(S.slot);
    $("sumParty").textContent = partyLabel(S.party);
    const card = cardNeeded();
    $("cardNotice").hidden = !card;
    if (card) {
      const p = S.cfg.card_policy;
      $("lblCardText").textContent = t("cardText", { h: p.cancel_hours, fee: money(p.fee_per_cover_cents * S.party) });
    }
    $("healthWrap").hidden = !$("fNote").value.trim();
  }

  function showError(msg) { $("formErr").textContent = msg; $("formErr").hidden = false; }

  async function submit(e) {
    e.preventDefault();
    if (S.sending) return;
    $("formErr").hidden = true; $("alts").hidden = true;
    const name = $("fName").value.trim(), email = $("fEmail").value.trim(), note = $("fNote").value.trim();
    if (!name) return showError(t("errName"));
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return showError(t("errEmail"));
    if (note && !$("fHealth").checked) return showError(t("errHealth"));
    const card = cardNeeded();
    if (card && !$("fPolicy").checked) return showError(t("errPolicy"));

    S.sending = true; $("submit").disabled = true; $("submit").textContent = t("sending");
    const { ok, status, data } = await api({ action: "reserve" }, {
      slug: SLUG, starts_at: S.slot, party: S.party, area: S.area, language: S.lang, source: SOURCE,
      name, email, phone: $("fPhone").value.trim(), note,
      health_consent: $("fHealth").checked, marketing_consent: $("fMarketing").checked,
      policy_accepted: card ? $("fPolicy").checked : false, website: $("fWebsite").value,
    });
    S.sending = false; $("submit").disabled = false; $("submit").textContent = t("confirm");

    if (ok) return showDone(data);
    if (status === 429) return showError(t("errTooMany"));
    if (status === 409) {
      const alts = data.alternatives || [];
      showError(alts.length ? t("taken") : t("noTimes"));
      const box = $("alts"); box.innerHTML = "";
      alts.forEach((a) => box.appendChild(slotButton(a)));
      box.hidden = !alts.length;
      return;
    }
    if (data.error === "invalid_email") return showError(t("errEmail"));
    if (data.error === "invalid_name") return showError(t("errName"));
    if (data.error === "policy_not_accepted") return showError(t("errPolicy"));
    showError(t("errGeneric"));
  }

  function showDone(data) {
    const pending = data.status === "pending";
    $("stepForm").hidden = true;
    $("stepDone").hidden = false;
    $("stepDone").classList.toggle("pending", pending);
    $("doneIcon").textContent = pending ? "⏱" : "✓";
    $("doneTitle").textContent = t(pending ? "pendingTitle" : "doneTitle");
    $("doneText").textContent = t(pending ? "pendingText" : "doneText");
    $("doneWhen").textContent = `${fmtWhen(S.slot)} · ${partyLabel(S.party)}`;
    window.scrollTo({ top: 0 });
    window.parent !== window && window.parent.postMessage({ type: "reservas:booked", status: data.status }, "*");
  }

  function reset() {
    S.slot = null;
    ["fNote", "fWebsite"].forEach((id) => ($(id).value = ""));
    ["fHealth", "fPolicy", "fMarketing"].forEach((id) => ($(id).checked = false));
    $("stepDone").hidden = true; $("stepForm").hidden = true; $("stepPick").hidden = false;
    loadSlots();
  }

  function renderAll() {
    renderTexts(); renderParty(); renderDays(); renderAreas();
    if ($("stepPick").hidden === false && S.date) loadSlots();
    renderForm();
  }

  // ---------- zdarzenia ----------
  $("minus").onclick = () => { if (S.party > 1) { S.party--; renderParty(); loadSlots(); } };
  $("plus").onclick = () => { S.party++; renderParty(); loadSlots(); };
  $("dateInput").onchange = (e) => e.target.value && setDate(e.target.value);
  $("back").onclick = () => { $("stepForm").hidden = true; $("stepPick").hidden = false; loadSlots(); };
  $("fNote").oninput = () => ($("healthWrap").hidden = !$("fNote").value.trim());
  $("stepForm").onsubmit = submit;
  $("again").onclick = reset;

  // ---------- start ----------
  (async () => {
    S.lang = pickLang(["es", "en", "de", "fr"]);
    renderTexts();
    const { ok, data } = await api({ action: "config", slug: SLUG });
    if (!ok) { $("slots").innerHTML = `<p class="msg err">${t("errGeneric")}</p>`; return; }
    S.cfg = data;
    S.lang = pickLang(data.languages || ["es"]);
    $("restName").textContent = data.name;
    S.date = todayISO();
    renderAll();
  })();
})();
