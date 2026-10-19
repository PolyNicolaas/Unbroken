// Unbroken · web app · notes.js
// The suggestion box: one line at the bottom of every tab for ideas, bugs and notes, and the list of them.
// On the published page the notes are kept in the page's own database (shared, durable, and readable by Claude, so
// they can be triaged into ROADMAP.md); anywhere else (opened from disk or a local server) they stay in this browser.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

// A note: { text, kind ("bug" | "idea" | "note"), status ("open" | "done"), at (ISO time), where: { tab, source } }.
// "bug: …" or "idea: …" at the start of the line sets the kind; the prefix is kept out of the text.
const NOTES_LOCAL = storeKey("notes"); // localStorage key when there is no database
let notesDB = null,
  notesList = []; // notesDB: the "notes" collection, or null (this browser only)

function noteKind(t) {
  const m = t.match(/^\s*(bug|idea|note)\s*[:\-–]\s*/i);
  return m
    ? { kind: m[1].toLowerCase(), text: t.slice(m[0].length).trim() }
    : { kind: /\b(bug|broken|wrong|crash|error|doesn'?t|can'?t)\b/i.test(t) ? "bug" : "idea", text: t.trim() };
}
const noteWhere = () => ({ tab: document.body.dataset.view, source: document.body.dataset.src || "image" });

function loadLocalNotes() {
  try {
    return JSON.parse(localStorage.getItem(NOTES_LOCAL) || "[]");
  } catch {
    return [];
  }
}
function saveLocalNotes(list) {
  try {
    localStorage.setItem(NOTES_LOCAL, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

function renderNotes() {
  const open = notesList.filter((n) => n.status !== "done"),
    ul = $("noteList");
  $("notesCount").textContent = open.length ? `${open.length} open` : "none open";
  ul.textContent = "";
  for (const n of [...notesList].sort(
    (a, b) => (a.status === "done") - (b.status === "done") || String(b.at).localeCompare(String(a.at))
  )) {
    const li = document.createElement("li");
    li.className = n.status === "done" ? "done" : "";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = n.status === "done";
    box.title = "Done";
    box.addEventListener("change", () => setNoteStatus(n, box.checked ? "done" : "open"));
    const tag = document.createElement("span");
    tag.className = "tag " + n.kind;
    tag.textContent = n.kind;
    const txt = document.createElement("span");
    txt.className = "txt";
    txt.textContent = n.text;
    const when = document.createElement("small");
    when.textContent = `${String(n.at || "").slice(0, 10)}${n.where && n.where.tab ? ` · ${n.where.tab === "design" ? "Trace" : n.where.tab === "choc" ? "3D" : "2D"}` : ""}`;
    li.append(box, tag, txt, when);
    ul.appendChild(li);
  }
}

async function addNote(line) {
  const { kind, text } = noteKind(line);
  if (!text) return;
  const n = { text, kind, status: "open", at: new Date().toISOString(), where: noteWhere() };
  if (notesDB) {
    try {
      await notesDB.add(n);
      setStatus($("noteMsg"), "ok", "Saved.");
    } catch (e) {
      // the live list updates from the database
      setStatus($("noteMsg"), "bad", `Couldn't save: ${(e && e.message) || e}`);
      return false;
    }
  } else {
    n.id = "l" + Date.now() + Math.random().toString(36).slice(2, 6);
    notesList = loadLocalNotes().concat(n); // re-read first: another open tab may have added notes
    const kept = saveLocalNotes(notesList);
    setStatus(
      $("noteMsg"),
      kept ? "ok" : "bad",
      kept ? "Saved in this browser." : "This browser won't keep it (storage blocked); copy it somewhere."
    );
    renderNotes();
  }
  return true;
}
async function setNoteStatus(n, status) {
  if (notesDB && n.id) {
    try {
      await notesDB.doc(n.id).update({ status });
    } catch (e) {
      toast(`Couldn't update the note: ${(e && e.message) || e}`, true);
    }
    return;
  }
  notesList = loadLocalNotes();
  const it = notesList.find((x) => x.id === n.id);
  if (it) it.status = status; // re-read, then change only this note
  saveLocalNotes(notesList);
  renderNotes();
}

$("noteForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const el = $("noteIn"),
    v = el.value;
  if (!v.trim()) return;
  el.disabled = true;
  if (await addNote(v)) el.value = "";
  el.disabled = false;
  el.focus();
});
$("notesCopy").addEventListener("click", async () => {
  // every open note as plain lines, to paste into a chat
  const t = notesList
    .filter((n) => n.status !== "done")
    .map((n) => `- [${n.kind}] ${n.text} (${String(n.at).slice(0, 10)})`)
    .join("\n");
  try {
    await navigator.clipboard.writeText(t || "(no open notes)");
    toast("Open notes copied");
  } catch {
    toast("The browser blocked copying", true);
  }
});

// another tab of this page changed the notes in this browser: show them
window.addEventListener("storage", (e) => {
  if (!notesDB && e.key === NOTES_LOCAL) {
    notesList = loadLocalNotes();
    renderNotes();
  }
});

// start: this browser's notes now; the page's database when it answers (only on the published page)
notesList = loadLocalNotes();
renderNotes();
(async () => {
  const db = window.claude && window.claude.use ? await window.claude.use("db").catch(() => null) : null;
  if (!db) {
    $("notesWhere").textContent = "kept in this browser";
    return;
  }
  notesDB = db.collection("notes");
  $("notesWhere").textContent = "kept with the published page";
  notesDB
    .orderBy("at", "desc")
    .limit(500)
    .onSnapshot(
      (snap) => {
        notesList = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        renderNotes();
      },
      () => {
        notesDB = null;
        $("notesWhere").textContent = "kept in this browser (the page's database stopped answering)";
        notesList = loadLocalNotes();
        renderNotes();
      }
    );
})();
