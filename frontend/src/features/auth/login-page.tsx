import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import type { z } from 'zod'

import { Logo } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/api'

import { useAuth } from './auth-context'
import { loginSchema } from './schemas'

type LoginValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  const onSubmit = async (values: LoginValues) => {
    setServerError(null)
    try {
      const user = await login(values.email, values.password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(user.mustChangePassword ? '/change-password' : (from ?? '/'), { replace: true })
    } catch (e) {
      setServerError(errorMessage(e))
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-lg font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use the account provided by your administrator.</p>

          {serverError && (
            <div role="alert" className="mt-5 flex gap-2 rounded-md border border-destructive/30 bg-danger-soft px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-5 flex flex-col gap-4" noValidate>
            <FormField label="Email" error={errors.email?.message}>
              <Input type="email" autoComplete="username" autoFocus {...register('email')} />
            </FormField>
            <FormField label="Password" error={errors.password?.message}>
              <Input type="password" autoComplete="current-password" {...register('password')} />
            </FormField>
            <Button type="submit" size="lg" className="mt-1 w-full" loading={isSubmitting}>
              Sign in
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Forgot your password? An administrator can issue a temporary one.
        </p>
      </div>
    </div>
  )
}
