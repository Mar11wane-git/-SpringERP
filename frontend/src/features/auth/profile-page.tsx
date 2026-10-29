import { PageHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { DefinitionList } from '@/components/ui/definition-list'
import { humanize } from '@/lib/format'

import { useAuth } from './auth-context'
import { ChangePasswordForm } from './change-password-form'

export default function ProfilePage() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <>
      <PageHeader title="My account" description="Your profile and sign-in security." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          <CardBody className="space-y-5">
            <DefinitionList
              items={[
                ['Name', user.fullName],
                ['Email', user.email],
                ['Role', humanize(user.role)],
              ]}
            />
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Permissions granted by your role</p>
              <div className="flex flex-wrap gap-1.5">
                {user.permissions.map((p) => (
                  <Badge key={p}>{humanize(p)}</Badge>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Change password" description="Changing it signs out your other sessions." />
          <CardBody>
            <ChangePasswordForm />
          </CardBody>
        </Card>
      </div>
    </>
  )
}
