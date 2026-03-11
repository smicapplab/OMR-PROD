const API_URL = process.env.NEXT_PUBLIC_API_URL as string

let accessToken: string | null = null
let refreshing: Promise<string | null> | null = null

export function setAccessToken(token: string | null) {
    accessToken = token
}

export function getAccessToken() {
    return accessToken
}

async function refreshAccessToken(): Promise<string | null> {
    if (!refreshing) {
        refreshing = (async () => {
            const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
            })

            if (!res.ok) {
                setAccessToken(null)
                return null
            }

            const data = (await res.json()) as { accessToken: string }
            setAccessToken(data.accessToken)
            return data.accessToken
        })().finally(() => {
            refreshing = null
        })
    }

    return refreshing
}

async function parseError(res: Response): Promise<string> {
    let body = ''
    try {
        body = await res.text()
    } catch {
        return `Request failed: ${res.status}`
    }

    if (body) {
        try {
            const json = JSON.parse(body) as { message?: string }
            if (json?.message) return json.message
        } catch { }
    }

    return `Request failed: ${res.status}`
}

function buildHeaders(base?: HeadersInit, token?: string | null, hasBody?: boolean): Headers {
    const headers = new Headers(base)
    if (token) headers.set('Authorization', `Bearer ${token}`)
    if (hasBody && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    return headers
}

export async function apiFetch<T>(
    path: string,
    init: RequestInit & { retry?: boolean; params?: Record<string, string | number | boolean | undefined> } = {},
): Promise<T> {
    let url = `${API_URL}${path}`

    if (init.params) {
        const query = new URLSearchParams()
        Object.entries(init.params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                query.append(key, String(value))
            }
        })
        const queryString = query.toString()
        if (queryString) {
            url += `${url.includes('?') ? '&' : '?'}${queryString}`
        }
    }

    const headers = buildHeaders(init.headers, accessToken, !!init.body)

    const res = await fetch(url, {
        ...init,
        headers,
        credentials: 'include',
    })

    if (res.status === 401 && init.retry !== false) {
        const newToken = await refreshAccessToken()
        if (!newToken) throw new Error('Unauthorized')

        const retryHeaders = buildHeaders(init.headers, newToken, !!init.body)
        const retryRes = await fetch(`${API_URL}${path}`, {
            ...init,
            headers: retryHeaders,
            credentials: 'include',
        })

        if (!retryRes.ok) throw new Error(await parseError(retryRes))
        if (retryRes.status === 204) return undefined as T
        return retryRes.json() as Promise<T>
    }

    if (!res.ok) throw new Error(await parseError(res))
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
}
