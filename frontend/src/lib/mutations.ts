import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { toast } from 'sonner'

import { ApiError, errorMessage } from '@/lib/api'

/**
 * Shows a server error to the user: field errors go inline on the form,
 * everything else becomes a toast with the server's message.
 */
export function handleMutationError<T extends FieldValues>(error: unknown, setError?: UseFormSetError<T>) {
  if (error instanceof ApiError && setError && error.fieldErrors.length > 0) {
    for (const fe of error.fieldErrors) {
      setError(fe.field as Path<T>, { type: 'server', message: fe.message })
    }
    toast.error('Please correct the highlighted fields.')
    return
  }
  toast.error(errorMessage(error), {
    description: error instanceof ApiError && error.correlationId ? `Reference: ${error.correlationId}` : undefined,
  })
}

/** Converts empty strings from form inputs to null before sending them to the API. */
export function nullIfBlank<T extends Record<string, unknown>>(values: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(values)) out[k] = typeof v === 'string' && v.trim() === '' ? null : v
  return out as T
}
