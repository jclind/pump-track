// toast.error renders its argument, and React can't render an Error object.
export const errorMessage = (error: unknown): string => {
  const message = (error as { message?: unknown } | null)?.message
  if (typeof message === 'string' && message) return message
  if (typeof error === 'string' && error) return error
  return 'Something went wrong'
}
