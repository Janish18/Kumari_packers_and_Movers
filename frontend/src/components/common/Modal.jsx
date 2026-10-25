import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { X } from 'lucide-react'
import Button from './Button'

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'

function useOverlay(open, onClose, panelRef) {
  useEffect(() => {
    if (!open) return undefined
    const prev = document.activeElement
    const scrollY = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => { (panelRef.current?.querySelector('[data-autofocus]') || panelRef.current?.querySelector(FOCUSABLE))?.focus() }, 30)
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key === 'Tab' && panelRef.current) {
        const els = [...panelRef.current.querySelectorAll(FOCUSABLE)]
        if (!els.length) return
        const first = els[0], last = els[els.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); document.body.style.overflow = scrollY; prev?.focus?.() }
  }, [open, onClose, panelRef])
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const ref = useRef(null)
  const id = useId()
  useOverlay(open, onClose, ref)
  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size]
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div ref={ref} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={description ? `${id}-d` : undefined}
            initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.97 }} transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className={clsx('relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-lift dark:bg-navy-900 sm:rounded-3xl', width)}>
            <div className="flex items-start justify-between gap-4 border-b border-navy-100 px-6 py-4 dark:border-navy-800">
              <div><h2 id={`${id}-t`} className="text-lg font-bold">{title}</h2>{description && <p id={`${id}-d`} className="mt-0.5 text-sm text-navy-400">{description}</p>}</div>
              <button onClick={onClose} aria-label="Close dialog" className="rounded-lg p-1.5 text-navy-400 transition hover:rotate-90 hover:bg-navy-50 hover:text-navy-800 dark:hover:bg-navy-800"><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-y-auto px-6 py-5">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-3 border-t border-navy-100 bg-navy-50/50 px-6 py-4 dark:border-navy-800 dark:bg-navy-950/40">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function Drawer({ open, onClose, title, children, side = 'right' }) {
  const ref = useRef(null)
  const id = useId()
  useOverlay(open, onClose, ref)
  const from = side === 'right' ? '100%' : '-100%'
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100]">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.aside ref={ref} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} initial={{ x: from }} animate={{ x: 0 }} exit={{ x: from }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={clsx('absolute top-0 flex h-full w-[min(92vw,26rem)] flex-col bg-white shadow-lift dark:bg-navy-900', side === 'right' ? 'right-0' : 'left-0')}>
            <div className="flex items-center justify-between border-b border-navy-100 px-5 py-4 dark:border-navy-800">
              <h2 id={`${id}-t`} className="text-lg font-bold">{title}</h2>
              <button onClick={onClose} aria-label="Close panel" className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false, loading = false, children }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<><Button variant="ghost" onClick={onClose} disabled={loading}>Go back</Button><Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm} data-autofocus>{confirmLabel}</Button></>}>
      {message && <p className="text-sm text-navy-500 dark:text-navy-300">{message}</p>}
      {children}
    </Modal>
  )
}
