import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { paymentApi } from '../../api/paymentApi'
import { errorMessage } from '../../utils/format'

let scriptPromise = null
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://checkout.razorpay.com/v1/checkout.js'
      s.onload = resolve
      s.onerror = () => { scriptPromise = null; reject(new Error('Could not load the payment window. Check your connection.')) }
      document.body.appendChild(s)
    })
  }
  return scriptPromise
}

/**
 * Starts a checkout. The browser callback only forwards the provider's signature to OUR server;
 * the booking is marked paid only after the backend verifies it (and/or the webhook arrives).
 */
export function usePayment(onDone) {
  const [busy, setBusy] = useState(false)
  const pay = useCallback(async (booking, kind, user) => {
    setBusy(true)
    try {
      const order = await paymentApi.createOrder(booking.id, kind)
      await loadRazorpay()
      await new Promise((resolve) => {
        const rz = new window.Razorpay({
          key: order.key_id, order_id: order.order_id, currency: order.currency, amount: Math.round(Number(order.amount) * 100),
          name: 'Kumari Packers and Movers', description: `Booking ${order.booking_reference}`,
          prefill: { name: user?.full_name, email: user?.email, contact: user?.phone },
          theme: { color: '#FF6B35' },
          handler: async (resp) => {
            try {
              const v = await paymentApi.verify({ order_id: resp.razorpay_order_id, payment_id: resp.razorpay_payment_id, signature: resp.razorpay_signature })
              toast.success(v.status === 'SUCCESS' ? 'Payment received and verified.' : 'Payment is being processed.')
            } catch (e) { toast.error(errorMessage(e, 'We could not verify this payment yet. If money was deducted it will reflect shortly.')) }
            resolve()
          },
          modal: { ondismiss: resolve },
        })
        rz.on('payment.failed', (r) => toast.error(r?.error?.description || 'Payment failed. You can try again.'))
        rz.open()
      })
      onDone?.()
    } catch (e) { toast.error(errorMessage(e, e.message)) } finally { setBusy(false) }
  }, [onDone])
  return { pay, busy }
}
