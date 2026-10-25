import { CrudPage } from './AdminShared'
import { Badge } from '../../components/common/Feedback'
import { adminApi } from '../../api/adminApi'
import { money } from '../../utils/format'

const yn = (v, a = 'Active', b = 'Inactive') => <Badge tone={v ? 'green' : 'slate'}>{v ? a : b}</Badge>
const RULES = [['PROPERTY_BASE', 'Base rate by property type'], ['LOADING', 'Loading & unloading labour'], ['PACKING', 'Packing by property type'], ['PER_KM', 'Distance charge per km'], ['VEHICLE', 'Vehicle category surcharge'], ['FLOOR', 'Floor access (per floor, no lift)'], ['ADDON', 'Optional service']].map(([value, label]) => ({ value, label }))

export function ServicesPage() {
  return <CrudPage title="Services" subtitle="Service categories shown on the public site." noun="service" api={adminApi.services} defaults={{ is_active: true, icon: 'truck', sort_order: 0 }}
    columns={[{ key: 'name', header: 'Name', render: (r) => <b>{r.name}</b> }, { key: 'summary', header: 'Summary', hideOnMobile: true }, { key: 'sort_order', header: 'Order' }, { key: 'is_active', header: 'Status', render: (r) => yn(r.is_active) }]}
    fields={[{ name: 'name', label: 'Name', required: true, half: true }, { name: 'slug', label: 'Slug', required: true, half: true, hint: 'lowercase-with-dashes' }, { name: 'summary', label: 'Short summary', required: true }, { name: 'description', label: 'Description', type: 'textarea', required: true },
      { name: 'icon', label: 'Icon name', half: true, hint: 'e.g. truck, home, building, package' }, { name: 'sort_order', label: 'Sort order', type: 'number', half: true }, { name: 'is_active', label: 'Visible on website', type: 'checkbox' }]} />
}

export function AreasPage() {
  return <CrudPage title="Service areas" subtitle="Cities you serve. Anything not listed is shown as not serviceable." noun="area" api={adminApi.areas} defaults={{ is_active: true, coverage: 'SERVICEABLE' }}
    columns={[{ key: 'city', header: 'City', render: (r) => <b>{r.city}</b> }, { key: 'state', header: 'State', hideOnMobile: true }, { key: 'coverage', header: 'Coverage', render: (r) => <Badge tone={r.coverage === 'SERVICEABLE' ? 'green' : 'amber'}>{r.coverage.toLowerCase()}</Badge> }, { key: 'is_active', header: 'Status', render: (r) => yn(r.is_active) }]}
    fields={[{ name: 'city', label: 'City', required: true, half: true }, { name: 'state', label: 'State', half: true }, { name: 'coverage', label: 'Coverage', type: 'select', options: ['SERVICEABLE', 'ON_REQUEST'], half: true }, { name: 'note', label: 'Note' }, { name: 'is_active', label: 'Active', type: 'checkbox' }]} />
}

export function PricingPage() {
  return <CrudPage title="Pricing rules" subtitle="These drive estimates and quotations. Nothing is priced unless a rule exists." noun="rule" api={adminApi.pricing} defaults={{ is_active: true, key: 'default' }}
    columns={[{ key: 'rule_type', header: 'Type', render: (r) => RULES.find((x) => x.value === r.rule_type)?.label || r.rule_type }, { key: 'label', header: 'Label', render: (r) => <b>{r.label}</b> }, { key: 'key', header: 'Key', hideOnMobile: true }, { key: 'amount', header: 'Amount', className: 'tabular-nums', render: (r) => money(r.amount) }, { key: 'is_active', header: 'Status', render: (r) => yn(r.is_active) }]}
    fields={[{ name: 'rule_type', label: 'Rule type', type: 'select', options: RULES, required: true }, { name: 'key', label: 'Key', required: true, half: true, hint: "Property type (e.g. 2BHK), vehicle category (MINI…), add-on code, or 'default'" }, { name: 'label', label: 'Label', required: true, half: true }, { name: 'amount', label: 'Amount (₹)', type: 'number', required: true, half: true }, { name: 'is_active', label: 'Active', type: 'checkbox' }]} />
}

export function InventoryItemsPage() {
  return <CrudPage title="Inventory catalogue" subtitle="Items customers can pick when listing belongings." noun="item" api={adminApi.inventoryItems} defaults={{ is_active: true }}
    columns={[{ key: 'name', header: 'Item', render: (r) => <b>{r.name}</b> }, { key: 'room', header: 'Room' }, { key: 'is_fragile', header: 'Fragile', render: (r) => (r.is_fragile ? <Badge tone="amber">Fragile</Badge> : '-') }, { key: 'is_active', header: 'Status', render: (r) => yn(r.is_active) }]}
    fields={[{ name: 'name', label: 'Item name', required: true, half: true }, { name: 'room', label: 'Room', required: true, half: true }, { name: 'is_fragile', label: 'Fragile', type: 'checkbox' }, { name: 'is_active', label: 'Active', type: 'checkbox' }]} />
}

export function FaqsPage() {
  return <CrudPage title="FAQs" subtitle="Shown on the public FAQ section." noun="FAQ" api={adminApi.faqs} defaults={{ is_published: true, category: 'General', sort_order: 0 }}
    columns={[{ key: 'question', header: 'Question', render: (r) => <b>{r.question}</b> }, { key: 'category', header: 'Category', hideOnMobile: true }, { key: 'is_published', header: 'Status', render: (r) => yn(r.is_published, 'Published', 'Hidden') }]}
    fields={[{ name: 'question', label: 'Question', required: true }, { name: 'answer', label: 'Answer', type: 'textarea', required: true }, { name: 'category', label: 'Category', half: true }, { name: 'sort_order', label: 'Order', type: 'number', half: true }, { name: 'is_published', label: 'Published', type: 'checkbox' }]} />
}

export function ContentPage() {
  return <CrudPage title="Pages & policies" subtitle="Keys used by the site: about, privacy, terms, refund-policy, cancellation-policy." noun="page" api={adminApi.content} defaults={{ is_published: true }}
    columns={[{ key: 'key', header: 'Key', render: (r) => <b>{r.key}</b> }, { key: 'title', header: 'Title' }, { key: 'is_published', header: 'Status', render: (r) => yn(r.is_published, 'Published', 'Hidden') }]}
    fields={[{ name: 'key', label: 'Key', required: true, half: true }, { name: 'title', label: 'Title', required: true, half: true }, { name: 'body', label: 'Content', type: 'textarea', hint: 'Plain text. Blank lines separate paragraphs.' }, { name: 'is_published', label: 'Published', type: 'checkbox' }]} />
}

export function ConfigPage() {
  return <CrudPage title="Business settings" subtitle="Key/value settings. Common keys: gst_percent, advance_percent, quote_validity_days, free_cancellation_hours, daily_capacity, social, stats, time_slots, announcement." noun="setting" api={adminApi.config} defaults={{ is_public: false, value: {} }}
    columns={[{ key: 'key', header: 'Key', render: (r) => <b>{r.key}</b> }, { key: 'value', header: 'Value', render: (r) => <code className="text-xs">{JSON.stringify(r.value).slice(0, 70)}</code> }, { key: 'is_public', header: 'Visibility', render: (r) => <Badge tone={r.is_public ? 'blue' : 'slate'}>{r.is_public ? 'Public' : 'Private'}</Badge> }]}
    fields={[{ name: 'key', label: 'Key', required: true }, { name: 'value', label: 'Value (JSON)', type: 'json', hint: 'Numbers, text, lists and objects are all valid JSON.' }, { name: 'is_public', label: 'Expose on the public site', type: 'checkbox' }]} />
}
