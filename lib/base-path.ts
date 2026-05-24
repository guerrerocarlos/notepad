const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH || ""

export const basePath = rawBasePath.replace(/\/+$/, "")

export function withBasePath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${basePath}${normalizedPath}`
}
