import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import Button from '../../components/common/Button'
import { Field, Input, Select, Textarea, Checkbox } from '../../components/common/Field'
import { Modal, ConfirmDialog } from '../../components/common/Modal'
import DataTable, { Pagination, SearchBox } from '../../components/common/DataTable'
import { PageHeader } from '../../components/common/Layout'
import { useApi } from '../../hooks/useApi'
import { useDebounce } from '../../hooks/useDebounce'
import { applyFieldErrors, errorMessage } from '../../utils/format'

/**
 * Generic admin CRUD page driven by a config.
 * fields: [{name,label,type:'text'|'number'|'textarea'|'select'|'checkbox'|'date'|'password',options?,required?,hint?,half?}]
 */
export function CrudPage({ title, subtitle, api, columns, fields, defaults = {}, searchable = true, noun = 'record', canDelete = true, transform, paged = true, rowActions, canCreate = true, initialSearch = '' }) {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState(initialSearch)
  const dq = useDebounce(q)
  const [edit, setEdit] = useState(null) // null | {} (new) | row
  const [del, setDel] = useState(null)
  const { data, loading, error, reload } = useApi(() => api.list({ page, search: dq || undefined, page_size: 20 }), [page, dq])
  const rows = Array.isArray(data) ? data : data?.results
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm()
  const isNew = edit && !edit.id

  const openEdit = (row) => {
    const v = { ...defaults, ...(row || {}) }
    fields.forEach((f) => { if (f.type === 'json') v[f.name] = JSON.stringify(v[f.name] ?? {}, null, 2) })
    reset(v); setEdit(row || {})
  }
  const submit = async (v) => {
    let body = { ...v }
    try {
      fields.forEach((f) => {
        if (f.type === 'json') body[f.name] = JSON.parse(v[f.name] || '{}')
        if (f.type === 'number' && v[f.name] === '') body[f.name] = null
        if (f.type === 'password' && !v[f.name]) delete body[f.name]
      })
    } catch { setError(fields.find((f) => f.type === 'json').name, { message: 'Enter valid JSON.' }); return }
    if (transform) body = transform(body, isNew)
    try {
      if (isNew) await api.create(body); else await api.update(edit.id, body)
      toast.success(`${noun[0].toUpperCase() + noun.slice(1)} saved.`); setEdit(null); reload(true)
    } catch (e) { if (!applyFieldErrors(e, setError, fields.map((f) => f.name))) toast.error(errorMessage(e)) }
  }
  const cols = [...columns, { key: '_a', header: '', className: 'text-right', render: (r) => (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {rowActions?.(r, () => reload(true))}
      <button aria-label={`Edit ${noun}`} onClick={() => openEdit(r)} className="rounded-lg p-2 text-navy-400 hover:bg-navy-100 dark:hover:bg-navy-800"><Pencil className="h-4 w-4" /></button>
      {canDelete && <button aria-label={`Delete ${noun}`} onClick={() => setDel(r)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>}
    </div>) }]
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={canCreate ? <Button icon={Plus} onClick={() => openEdit(null)}>Add {noun}</Button> : null} />
      {searchable && <div className="mb-4 max-w-sm"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder={`Search ${title.toLowerCase()}`} /></div>}
      <DataTable columns={cols} rows={rows} loading={loading} error={error} onRetry={reload} onRowClick={openEdit} />
      {paged && data?.count != null && <Pagination page={page} count={data.count} onPage={setPage} />}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={isNew ? `Add ${noun}` : `Edit ${noun}`}
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" form="crud" loading={isSubmitting}>Save</Button></>}>
        <form id="crud" onSubmit={handleSubmit(submit)} noValidate className="grid gap-4 sm:grid-cols-2">
          {fields.map((f, i) => {
            const err = errors[f.name]?.message
            const wide = f.type === 'textarea' || f.type === 'json' || f.type === 'checkbox' || !f.half
            const cls = wide ? 'sm:col-span-2' : ''
            if (f.hideOnEdit && !isNew) return null
            const reg = register(f.name, { required: f.required ? `${f.label} is required` : false })
            return (
              <div key={f.name} className={cls}>
                {f.type === 'checkbox' ? <Checkbox label={f.label} {...reg} /> : (
                  <Field label={f.label} error={err} hint={f.hint} required={f.required}>{(a) => (
                    f.type === 'textarea' || f.type === 'json' ? <Textarea {...a} rows={f.type === 'json' ? 5 : 4} className={f.type === 'json' ? 'font-mono text-xs' : ''} {...reg} />
                    : f.type === 'select' ? <Select {...a} {...reg}><option value="">Select…</option>{f.options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}</Select>
                    : <Input {...a} type={f.type || 'text'} step={f.type === 'number' ? 'any' : undefined} autoComplete={f.type === 'password' ? 'new-password' : 'off'} data-autofocus={i === 0 ? true : undefined} {...reg} />)}</Field>)}
              </div>)
          })}
        </form>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title={`Delete this ${noun}?`} message="This cannot be undone." confirmLabel="Delete"
        onConfirm={async () => { try { await api.remove(del.id); toast.success('Deleted.'); setDel(null); reload(true) } catch (e) { toast.error(errorMessage(e, 'Could not delete. It may be in use; deactivate it instead.')); setDel(null) } }} />
    </div>
  )
}
