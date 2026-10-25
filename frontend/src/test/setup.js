import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => cleanup())

if (!window.matchMedia) {
  window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false } })
}
class IO { observe() {} unobserve() {} disconnect() {} }
window.IntersectionObserver = window.IntersectionObserver || IO
window.ResizeObserver = window.ResizeObserver || IO
window.scrollTo = vi.fn()
