export const publicAssetUrl = (path) => {
  if (!path || /^(?:https?:|data:|blob:)/i.test(path)) return path

  const baseUrl = import.meta.env.BASE_URL || '/'
  if (path.startsWith(baseUrl)) return path

  return `${baseUrl}${path.replace(/^\.?\//, '')}`
}
