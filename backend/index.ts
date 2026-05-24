type UrlMeta = {
  title: string
  description: string
  excerpt: string
  statusCode: number
}

const hitsByClient = new Map<string, number[]>()

function json(value: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init?.headers,
    },
  })
}

function extractMeta(html: string): Omit<UrlMeta, "statusCode"> {
  const tag = (pattern: RegExp) => {
    const match = html.match(pattern)
    return match
      ? match[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim()
      : ""
  }

  const title =
    tag(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ||
    tag(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i) ||
    tag(/<title[^>]*>([^<]{1,200})<\/title>/i)

  const description =
    tag(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i) ||
    tag(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i) ||
    tag(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i) ||
    tag(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i)

  const excerpt = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600)

  return { title: title.slice(0, 200), description: description.slice(0, 400), excerpt }
}

function isBlockedHost(rawUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return true
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (host === "localhost" || host === "metadata.google.internal") return true
  if (host === "::1" || host === "0:0:0:0:0:0:0:1") return true
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!ipv4) return false

  const [a, b, c] = [Number(ipv4[1]), Number(ipv4[2]), Number(ipv4[3])]
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a === 203 && b === 0 && c === 113) return true
  return a >= 224
}

function isSameOrigin(request: Request) {
  const host = (request.headers.get("host") || new URL(request.url).host).split(":")[0]
  const origin = request.headers.get("origin") || ""
  const referer = request.headers.get("referer") || ""

  const strictHostMatch = (value: string) => {
    try {
      return new URL(value).hostname === host
    } catch {
      return false
    }
  }

  const header = origin || referer
  const isLocalhost = strictHostMatch(header)
    ? ["localhost", "127.0.0.1"].includes(new URL(header).hostname)
    : (origin + referer).includes("localhost")

  return isLocalhost || strictHostMatch(origin) || strictHostMatch(referer)
}

function isRateLimited(request: Request, path: string) {
  const now = Date.now()
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  const key = `${ip}:${path}`
  const hits = (hitsByClient.get(key) || []).filter((timestamp) => now - timestamp < 60_000)
  if (hits.length >= 30) return true
  hits.push(now)
  hitsByClient.set(key, hits)
  return false
}

async function fetchUrlMeta(url: string): Promise<UrlMeta | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "nodepad/1.0 (+https://guerrerocarlos.w7s.cloud/notepad/)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    })

    const statusCode = response.status
    if (!response.ok) return { title: "", description: "", excerpt: "", statusCode }

    const contentType = response.headers.get("content-type") || ""
    if (!contentType.includes("text/html")) {
      const kind = contentType.split(";")[0].trim()
      return { title: "", description: `Non-HTML resource: ${kind}`, excerpt: "", statusCode }
    }

    const html = await response.text()
    return { ...extractMeta(html), statusCode }
  } catch {
    return null
  }
}

async function handleFetchUrl(request: Request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 })
  }

  if (!isSameOrigin(request)) {
    return json({ error: "Forbidden" }, { status: 403 })
  }

  const path = new URL(request.url).pathname
  if (isRateLimited(request, path)) {
    return json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "retry-after": "60" } },
    )
  }

  try {
    const { url } = (await request.json()) as { url?: unknown }
    const urlString = String(url || "")
    if (!urlString || !/^https?:\/\//i.test(urlString)) {
      return json({ error: "Invalid URL" }, { status: 400 })
    }
    if (isBlockedHost(urlString)) {
      return json({ error: "Blocked URL" }, { status: 400 })
    }

    return json(await fetchUrlMeta(urlString))
  } catch {
    return json(null)
  }
}

export default {
  fetch(request: Request) {
    const path = new URL(request.url).pathname
    if (path === "/api/fetch-url") return handleFetchUrl(request)
    return new Response("Not found.", { status: 404 })
  },
}
