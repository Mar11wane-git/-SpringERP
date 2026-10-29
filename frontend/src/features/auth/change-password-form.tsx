import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { z } from 'zod'

import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { handleMutationError } from '@/lib/mutations'
import type { TokenResponse } from '@/types/api'

import { useAuth } from './auth-context'
import { changePasswordSchema } from './schemas'

type Values = z.infer<typeof changePasswordSchema>

export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const { acceptTokens } = useAuth()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const onSubmit = async (values: Values) => {
    try {
      const res = await api.post<TokenResponse>('/api/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      acceptTokens(res)
      reset()
      toast.success('Password changed. Other sessions were signed out.')
      onDone?.()
    } catch (e) {
      handleMutationError(e, setError)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <FormField label="Current password" error={errors.currentPassword?.message} required>
        <Input type="password" autoComplete="current-password" {...register('currentPassword')} />
      </FormField>
      <FormField
        label="New password"
        error={errors.newPassword?.message}
        hint="At least 10 characters, with letters and digits."
        required
      >
        <Input type="password" autoComplete="new-password" {...register('newPassword')} />
      </FormField>
      <FormField label="Confirm new password" error={errors.confirmPassword?.message} required>
        <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
      </FormField>
      <div>
        <Button type="submit" loading={isSubmitting}>
          Update password
        </Button>
      </div>
    </form>
  )
}
