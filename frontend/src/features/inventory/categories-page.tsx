import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ListTree, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { FormField } from '@/components/ui/form-field'
import { Input, Textarea } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { handleMutationError } from '@/lib/mutations'
import type { Category } from '@/types/api'

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().max(500),
})
type Values = z.infer<typeof schema>

function CategoryDialog({ category, trigger }: { category?: Category; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset, setError, formState } = useForm<Values>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (open) reset({ name: category?.name ?? '', description: category?.description ?? '' })
  }, [open, category, reset])

  const save = async (v: Values) => {
    try {
      const body = { ...v, description: v.description || null, version: category?.version ?? null }
      await (category ? api.put(`/api/categories/${category.id}`, body) : api.post('/api/categories', body))
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success(category ? 'Category updated' : 'Category created')
      setOpen(false)
    } catch (e) {
      handleMutationError(e, setError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span className="contents" onClick={() => setOpen(true)}>
        {trigger}
      </span>
      <DialogContent
        title={category ? 'Edit category' : 'New category'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="category-form" loading={formState.isSubmitting}>
              Save
            </Button>
          </>
        }
      >
        <form id="category-form" onSubmit={handleSubmit(save)} noValidate className="flex flex-col gap-4">
          <FormField label="Name" error={formState.errors.name?.message} required>
            <Input autoFocus {...register('name')} />
          </FormField>
          <FormField label="Description" error={formState.errors.description?.message}>
            <Textarea rows={3} {...register('description')} />
          </FormField>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function CategoriesPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/api/categories') })
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/api/categories/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category deleted')
    },
    onError: (e) => handleMutationError(e),
  })
  const editable = can('INVENTORY_WRITE')

  return (
    <>
      <PageHeader
        title="Categories"
        description="Group products for filtering and reporting."
        actions={
          editable && (
            <CategoryDialog
              trigger={
                <Button>
                  <Plus />
                  New category
                </Button>
              }
            />
          )
        }
      />
      <Card>
        {isLoading && (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        )}
        {error && <ErrorState error={error} onRetry={() => void refetch()} />}
        {data?.length === 0 && <EmptyState icon={ListTree} title="No categories yet" description="Create one to organize your catalog." />}
        {data && data.length > 0 && (
          <ul>
            {data.map((c) => (
              <li key={c.id} className="flex items-center gap-4 border-b border-border px-5 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{c.name}</p>
                  {c.description && <p className="truncate text-xs text-muted-foreground">{c.description}</p>}
                </div>
                <span className="text-xs text-muted-foreground tabular">{formatNumber(c.productCount)} products</span>
                {editable && (
                  <div className="flex gap-1">
                    <CategoryDialog
                      category={c}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.name}`}>
                          <Pencil />
                        </Button>
                      }
                    />
                    <ConfirmDialog
                      title={`Delete “${c.name}”?`}
                      description={c.productCount > 0 ? 'This category still has products; move them first.' : 'The category will be removed permanently.'}
                      confirmLabel="Delete"
                      destructive
                      onConfirm={() => remove.mutateAsync(c.id)}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${c.name}`} disabled={c.productCount > 0}>
                          <Trash2 />
                        </Button>
                      }
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
