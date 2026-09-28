import cloudbase from '@cloudbase/js-sdk'

export const CLOUD_BASE_ENV_ID = 'tea-spirit-web-d8g3tqcm207d21843'

export const cloudbaseApp = cloudbase.init({
  env: CLOUD_BASE_ENV_ID,
  region: 'ap-shanghai',
})
export const cloudbaseAuth = cloudbaseApp.auth({ persistence: 'local' })
export const cloudbaseDb = cloudbaseApp.rdb()

export const assertCloudResult = (result, operation) => {
  if (result?.error) {
    const error = new Error(`${operation} failed: ${result.error.message || 'unknown error'}`)
    error.code = result.error.code
    throw error
  }
  return result?.data
}
