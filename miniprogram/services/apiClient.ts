import { API_BASE_URL, AUTH_STORAGE_KEYS } from '../config/env'

export class ApiError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload?: unknown) {
    super(message)
    this.status = status
    this.payload = payload
  }
}

function getToken(): string {
  try {
    return wx.getStorageSync(AUTH_STORAGE_KEYS.token) || ''
  } catch {
    return ''
  }
}

function parseResponseBody(data: unknown): unknown {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return data
    }
  }
  return data
}

export function requestRaw<T>(options: {
  path: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: unknown
  auth?: boolean
}): Promise<{ statusCode: number; body: T }> {
  const { path, method = 'GET', data, auth = true } = options
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (auth) {
    const token = getToken()
    if (token) header.Authorization = `Bearer ${token}`
  }

  return new Promise((resolve, reject) => {
    const req: WechatMiniprogram.RequestOption = {
      url: `${API_BASE_URL}${path}`,
      method,
      header,
      // 传入 object，由基础库按 application/json 序列化；避免手动 stringify 在部分安卓机二次编码
      success(res) {
        resolve({
          statusCode: res.statusCode,
          body: parseResponseBody(res.data) as T,
        })
      },
      fail(err) {
        reject(new ApiError(err.errMsg || '网络异常', 0, err))
      },
    }
    if (data !== undefined) {
      req.data = data as WechatMiniprogram.IAnyObject
    }
    wx.request(req)
  })
}

export async function request<T>(options: {
  path: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: unknown
  auth?: boolean
}): Promise<T> {
  const { statusCode, body } = await requestRaw<{
    ok?: boolean
    message?: string
    data?: T
  }>(options)

  if (statusCode >= 200 && statusCode < 300 && body && body.ok !== false) {
    if (body.data !== undefined) return body.data
    return body as unknown as T
  }

  const message = (body && body.message) || `请求失败(${statusCode})`
  throw new ApiError(String(message), statusCode, body)
}
