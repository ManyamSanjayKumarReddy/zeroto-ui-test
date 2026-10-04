import "./style.css"

// Values fixed while the site is BUILT. On ZeroTo add them in the Variables tab with "Used by: Build",
// then redeploy (a website can't read variables at runtime).
const SITE_NAME = import.meta.env.VITE_SITE_NAME || "ZeroTo UI test"
const API = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "")
const BUILT_AT = __BUILT_AT__

const app = document.getElementById("app")

/** Builds an element. Text goes in as text (never as HTML), so nothing a user types can inject markup. */
function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue
    if (key.startsWith("on")) node.addEventListener(key.slice(2), value)
    else if (key === "class") node.className = value
    else node.setAttribute(key, value === true ? "" : value)
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue
    node.append(child instanceof Node ? child : document.createTextNode(String(child)))
  }
  return node
}

const formatTime = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })

// ── the API (the zeroto-test-app deployment) ───────────────────────────────

async function api(path, options) {
  if (!API) throw Object.assign(new Error("VITE_API_URL isn't set for this build"), { code: "NO_API" })
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...options?.headers },
  })
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text.slice(0, 200) }
  }
  if (!res.ok) {
    const reason = body?.hint ?? body?.error ?? body?.raw ?? res.statusText
    throw Object.assign(new Error(`${res.status}: ${reason}`), { status: res.status, body })
  }
  return body
}

function setupNotice() {
  return h(
    "div",
    { class: "notice" },
    h("strong", {}, "No API configured. "),
    "Add a build variable ",
    h("code", {}, "VITE_API_URL"),
    " (the address of your zeroto-test-app deployment, e.g. ",
    h("code", {}, "https://zeroto-test-app-ab12cd.example.com"),
    ") and redeploy this site. It is read while the site is built.",
  )
}

// ── pages ──────────────────────────────────────────────────────────────────

function statusPill(state, label) {
  return h("span", { class: `pill ${state}` }, label)
}

function homePage() {
  const page = h("section", {})
  const apiBox = h("dl", { class: "kv" })
  const refresh = async () => {
    apiBox.replaceChildren(h("dt", {}, "API"), h("dd", {}, API || "not set"))
    if (!API) return
    const rows = []
    try {
      const root = await api("/")
      rows.push(["App", statusPill("ok", "reachable")], ["Message", root.message], ["Database", root.database])
    } catch (err) {
      rows.push(["App", statusPill("bad", "unreachable")], ["Why", err.message])
    }
    try {
      const db = await api("/db")
      rows.push(["Connected to", `${db.database} as ${db.user}`], ["Postgres", db.version.split(",")[0]])
    } catch (err) {
      rows.push(["Database", statusPill(err.status === 503 ? "warn" : "bad", err.status === 503 ? "not available" : "error")], ["Detail", err.message])
    }
    apiBox.append(...rows.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]))
  }
  refresh()

  page.append(
    h("h1", {}, SITE_NAME),
    h("p", { class: "lead" }, "A static site built by ZeroTo — plain files served by the platform, no container. It talks to your test app and its database."),
    h(
      "div",
      { class: "grid" },
      h(
        "div",
        { class: "card" },
        h("h2", {}, "This build"),
        h(
          "dl",
          { class: "kv" },
          h("dt", {}, "Site name"),
          h("dd", {}, SITE_NAME),
          h("dt", {}, "Built at"),
          h("dd", {}, formatTime(BUILT_AT)),
          h("dt", {}, "Address"),
          h("dd", { class: "mono" }, location.origin),
          h("dt", {}, "Route"),
          h("dd", { class: "mono" }, location.pathname),
        ),
      ),
      h("div", { class: "card" }, h("h2", {}, "The API"), apiBox, h("p", {}, h("button", { class: "ghost", onclick: refresh }, "Check again"))),
    ),
    !API && h("div", { style: "margin-top:18px" }, setupNotice()),
    h("footer", {}, "Reload this page on any route (try /notes): a single-page app opens the same site. Sources are not served — only the built files."),
  )
  return page
}

function notesPage() {
  const page = h("section", {})
  const list = h("ul", { class: "notes" })
  const status = h("div", {})
  const input = h("input", { type: "text", name: "text", placeholder: "Write a note…", maxlength: "200", required: true, "aria-label": "New note", autocomplete: "off" })
  const submit = h("button", { type: "submit" }, "Add note")

  const show = (err) => status.replaceChildren(err ? h("div", { class: `notice ${err.status === 503 ? "" : "bad"}` }, err.message) : "")

  const render = (notes) => {
    list.replaceChildren(
      ...(notes.length === 0
        ? [h("li", { class: "empty" }, "No notes yet. Add one — it is stored in your managed database.")]
        : notes.map((n) =>
            h(
              "li",
              {},
              h("span", { class: "text" }, n.text),
              h("time", { datetime: n.created_at }, formatTime(n.created_at)),
              h(
                "button",
                {
                  class: "ghost",
                  "aria-label": `Delete note: ${n.text}`,
                  onclick: async () => {
                    try {
                      await api(`/notes/${n.id}`, { method: "DELETE" })
                      load()
                    } catch (err) {
                      show(err)
                    }
                  },
                },
                "Delete",
              ),
            ),
          )),
    )
  }

  async function load() {
    if (!API) return show(Object.assign(new Error("Set VITE_API_URL for this build to use the notes."), { status: 503 }))
    try {
      render((await api("/notes")).notes)
      show(null)
    } catch (err) {
      list.replaceChildren()
      show(err)
    }
  }

  const form = h(
    "form",
    {
      onsubmit: async (event) => {
        event.preventDefault()
        submit.disabled = true
        try {
          await api("/notes", { method: "POST", body: JSON.stringify({ text: input.value }) })
          input.value = ""
          await load()
        } catch (err) {
          show(err)
        } finally {
          submit.disabled = false
          input.focus()
        }
      },
    },
    input,
    submit,
  )

  page.append(
    h("h1", {}, "Notes"),
    h("p", { class: "lead" }, "Saved by your zeroto-test-app in the managed database you linked to it. Pause the database and this page tells you; start it and the notes are back."),
    !API && setupNotice(),
    form,
    status,
    list,
  )
  load()
  return page
}

function aboutPage() {
  return h(
    "section",
    {},
    h("h1", {}, "How this site is served"),
    h("p", { class: "lead" }, "ZeroTo built this repository with Railpack, copied the finished files out, and keeps a copy of every version in storage. A server only holds the version it is showing."),
    h(
      "div",
      { class: "grid" },
      h("div", { class: "card" }, h("h2", {}, "Try"), h("ul", {}, h("li", {}, "Reload this page — it still opens (single-page routing)."), h("li", {}, "Roll back to an earlier release in ZeroTo and reload."), h("li", {}, "Change ", h("code", {}, "VITE_SITE_NAME"), " (Used by: Build) and redeploy."))),
      h("div", { class: "card" }, h("h2", {}, "Check with curl"), h("pre", { class: "mono", style: "margin:0;white-space:pre-wrap" }, `curl -I ${location.origin}/\ncurl -I ${location.origin}/assets/<file>.js`)),
    ),
  )
}

function notFoundPage() {
  return h("section", {}, h("h1", {}, "Page not found"), h("p", { class: "lead" }, `There is no page at ${location.pathname}. This message comes from the site itself, not the server.`), h("a", { href: "/", "data-link": true }, "Go home"))
}

// ── tiny router ────────────────────────────────────────────────────────────

const routes = {
  "/": { title: "Home", page: homePage },
  "/notes": { title: "Notes", page: notesPage },
  "/about": { title: "About", page: aboutPage },
}

function layout(content, active) {
  const link = (href, label) => h("a", { href, "data-link": true, "aria-current": href === active ? "page" : false }, label)
  return [
    h("header", {}, h("div", { class: "bar" }, h("span", { class: "brand" }, h("img", { src: "/favicon.svg", alt: "" }), SITE_NAME), h("nav", { "aria-label": "Main" }, link("/", "Home"), link("/notes", "Notes"), link("/about", "About")))),
    h("main", {}, content),
  ]
}

function render() {
  const path = location.pathname.replace(/\/+$/, "") || "/"
  const route = routes[path]
  document.title = `${route ? route.title : "Not found"} — ${SITE_NAME}`
  app.replaceChildren(...layout(route ? route.page() : notFoundPage(), route ? path : null))
}

document.addEventListener("click", (event) => {
  const a = event.target.closest?.("a[data-link]")
  if (!a || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
  event.preventDefault()
  history.pushState({}, "", a.getAttribute("href"))
  render()
  window.scrollTo(0, 0)
})
window.addEventListener("popstate", render)
render()
