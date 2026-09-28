const cloudbase = require('@cloudbase/node-sdk')
const tencentcloud = require('tencentcloud-sdk-nodejs')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const database = app.rdb()
const SmsClient = tencentcloud.sms.v20210111.Client
const REQUIRED_SMS_CONFIG = ['SMS_SDK_APP_ID', 'SMS_SIGN_NAME', 'SMS_TEMPLATE_ID', 'PUBLIC_APP_URL']

const getCredentials = () => ({
  secretId: process.env.TENCENTCLOUD_SECRETID || process.env.TENCENTCLOUD_SECRET_ID,
  secretKey: process.env.TENCENTCLOUD_SECRETKEY || process.env.TENCENTCLOUD_SECRET_KEY,
  token: process.env.TENCENTCLOUD_SESSIONTOKEN,
})

const maskPhone = (phone = '') => `*******${String(phone).slice(-4)}`

const normalizePhone = (phone) => {
  const normalized = String(phone || '').replace(/[\s-]/g, '')
  if (/^\+\d{8,15}$/.test(normalized)) return normalized
  if (/^86\d{11}$/.test(normalized)) return `+${normalized}`
  if (/^1\d{10}$/.test(normalized)) return `+86${normalized}`
  throw Object.assign(new Error('Recipient is not a valid E.164 phone number'), { code: 'INVALID_RECIPIENT' })
}

const createDeepLink = (job) => {
  const baseUrl = new URL(process.env.PUBLIC_APP_URL)
  const target = new URL(job.deep_link || `/?letter=${job.letter_id}`, baseUrl)
  if (target.origin !== baseUrl.origin) {
    throw Object.assign(new Error('Notification deep link origin is not allowed'), { code: 'INVALID_DEEP_LINK' })
  }
  return target.toString()
}

const createTemplateParams = (job, deepLink) => {
  const configured = job.template_params?.values
  const values = Array.isArray(configured) && configured.length ? configured : ['{{deep_link}}']
  return values.map((value) => String(value).replaceAll('{{deep_link}}', deepLink))
}

const sanitizeError = (error) => {
  const code = String(error?.code || 'SMS_SEND_FAILED').slice(0, 100)
  const message = String(error?.message || 'Unknown SMS error')
    .replace(/\+?86?1\d{10}/g, '[PHONE_REDACTED]')
    .slice(0, 800)
  return { code, message, stored: `${code}: ${message}` }
}

const assertDatabaseResult = (result, operation) => {
  if (result?.error) {
    throw Object.assign(new Error(`${operation}: ${result.error.message || 'database error'}`), {
      code: result.error.code || 'DATABASE_ERROR',
    })
  }
  return result?.data
}

exports.main = async () => {
  const missing = REQUIRED_SMS_CONFIG.filter((key) => !process.env[key])
  if (missing.length) return { ok: false, code: 'SMS_NOT_CONFIGURED', missing }

  const credential = getCredentials()
  if (!credential.secretId || !credential.secretKey) {
    return { ok: false, code: 'CLOUD_CREDENTIALS_UNAVAILABLE' }
  }

  const client = new SmsClient({
    credential,
    region: process.env.TENCENTCLOUD_REGION || 'ap-guangzhou',
    profile: { httpProfile: { endpoint: 'sms.tencentcloudapi.com' } },
  })
  const jobs = assertDatabaseResult(
    await database.rpc('claim_notification_jobs', { p_limit: 10 }),
    'claim_notification_jobs',
  ) || []
  const summary = { ok: true, claimed: jobs.length, sent: 0, retried: 0, failed: 0 }

  for (const job of jobs) {
    try {
      const recipient = normalizePhone(job.recipient)
      const deepLink = createDeepLink(job)
      console.log('[Notification] sending', { id: job.id, recipient: maskPhone(recipient), type: job.type })
      const response = await client.SendSms({
        SmsSdkAppId: process.env.SMS_SDK_APP_ID,
        SignName: process.env.SMS_SIGN_NAME,
        TemplateId: job.template_id || process.env.SMS_TEMPLATE_ID,
        TemplateParamSet: createTemplateParams(job, deepLink),
        PhoneNumberSet: [recipient],
      })
      const result = response?.SendStatusSet?.[0]
      if (!result || result.Code !== 'Ok') {
        throw Object.assign(new Error(result?.Message || 'Tencent SMS did not accept the message'), {
          code: result?.Code || 'SMS_NOT_ACCEPTED',
        })
      }
      assertDatabaseResult(await database.rpc('mark_notification_job_sent', {
        p_job_id: job.id,
        p_provider_message_id: result.SerialNo || response.RequestId || null,
      }), 'mark_notification_job_sent')
      summary.sent += 1
    } catch (error) {
      const safeError = sanitizeError(error)
      console.error('[Notification] failed', { id: job.id, code: safeError.code, message: safeError.message })
      assertDatabaseResult(await database.rpc('fail_notification_job', {
        p_job_id: job.id,
        p_error: safeError.stored,
        p_retry_delay_seconds: 300,
      }), 'fail_notification_job')
      if (Number(job.attempt_count) < Number(job.max_attempts)) summary.retried += 1
      else summary.failed += 1
    }
  }
  return summary
}
