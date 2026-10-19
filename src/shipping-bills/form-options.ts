import { ports } from './model'

export const portOptions = ports.map((port) => ({ value: port.code, label: `${port.name} · ${port.code}` }))
export const currencyOptions = ['USD', 'EUR', 'INR', 'AED', 'GBP', 'SGD'].map((value) => ({ value, label: value }))
export const dateType = 'date' as 'text'
