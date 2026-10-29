import { useNavigate } from 'react-router-dom'

import { Logo } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'

import { useAuth } from './auth-context'
import { ChangePasswordForm } from './change-password-form'

/** Shown after signing in with a temporary password; the API blocks everything else until done. */
export default function ChangePasswordPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-lg font-semibold">Choose a new password</h1>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            {user?.email} is using a temporary password. Set your own to continue.
          </p>
          <ChangePasswordForm onDone={() => navigate('/', { replace: true })} />
        </div>
        <div className="mt-4 text-center">
          <Button variant="link" size="sm" onClick={() => void logout().then(() => navigate('/login'))}>
            Sign out instead
          </Button>
        </div>
      </div>
    </div>
  )
}
