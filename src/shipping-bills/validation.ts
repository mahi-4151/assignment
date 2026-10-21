import { documentCodes } from '@/data/e-sanchit-codes'
import { quantityCodes } from '@/data/quantity-code'
import schemeCodes from '@/data/scheme-codes'
import { stateOptions } from '@/data/states'
import { Trades } from '@/data/trade-agrements'
import {
  cargoOptions,
  contractTypes,
  currencyOptions,
  paymentTypes,
  priceInclusionTypes,
  weightUnits
} from '@/data/types'
import { s } from 'core/form'
import type { ShippingBillFormValues } from './model'
import { invoiceTotal } from './model'

/**
 * Domain (customs) validation for the Shipping Bill form.
 *
 * Two layers, deliberately kept out of the UI components:
 *
 * 1. `shippingBillSchema` — leaf-level rules used by the fe-zen-arch form
 *    wrapper. The wrapper resolves nested react-hook-form paths by their final
 *    segment (see `getNestedSchema`), so every key here is a leaf field name
 *    and the same leaf name must carry the same rule wherever it appears.
 * 2. `validateShippingBill` — cross-field / cross-row rules that a single
 *    leaf cannot express (net vs gross weight, contract type vs charges,
 *    scheme code vs drawback/licence details, serial references, duplicate
 *    invoice or container numbers, ...). It is a pure function of the form
 *    values and returns one message per field path, so it can be unit
 *    checked without rendering the form and reused by a future API layer.
 *
 * Assumptions are intentionally conservative: a rule only blocks saving when
 * the entered data is internally inconsistent or a customs-mandatory detail
 * is missing for an option the user explicitly selected. Fields that are not
 * rendered by the UI are never required here.
 */

export interface DomainError {
  path: string
  message: string
}

function blank(value: unknown) {
  return value == null || (typeof value === 'string' && value.trim() === '')
}

function text(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function num(value: unknown) {
  return blank(value) ? NaN : Number(value)
}

function isPositive(value: unknown) {
  return Number.isFinite(num(value)) && num(value) > 0
}

function isNonNegative(value: unknown) {
  return Number.isFinite(num(value)) && num(value) >= 0
}

function isPositiveInt(value: unknown) {
  return Number.isInteger(num(value)) && num(value) >= 1
}

function isNonNegativeInt(value: unknown) {
  return Number.isInteger(num(value)) && num(value) >= 0
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/** Strict `yyyy-mm-dd` check (rejects rollover dates such as 2026-02-31). */
export function isValidIsoDate(value: unknown): boolean {
  const raw = text(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false
  const [year, month, day] = raw.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

const portCodePattern = /^[A-Z]{2}[A-Z0-9]{3,4}$/

export function isValidPortCode(value: unknown) {
  return portCodePattern.test(text(value).toUpperCase())
}

const currencyCodes = new Set(currencyOptions.map((option) => option.value))
const stateCodes = new Set(stateOptions.map((option) => String(option.value)))
const weightUnitCodes = new Set(weightUnits.map((option) => option.value))
const cargoCodes = new Set(cargoOptions.map((option) => option.value))
const contractCodes = new Set(contractTypes.map((option) => option.value))
const paymentCodes = new Set(paymentTypes.map((option) => option.value))
const priceInclusionCodes = new Set(priceInclusionTypes.map((option) => option.value))
const quantityCodeSet = new Set(quantityCodes.map((option) => option.value))
const documentCodeSet = new Set(documentCodes.map((option) => option.value))
const tradeAgreementCodes = new Set(Trades.map((option) => option.value))
const schemeByCode = new Map(schemeCodes.map((scheme) => [scheme.value, scheme]))

// UQCs that count discrete pieces, so a fractional quantity makes no sense.
const integerQuantityCodes = new Set([
  'AMP',
  'BAG',
  'BOX',
  'BTL',
  'CAN',
  'CTN',
  'DOZ',
  'DRM',
  'NOS',
  'PAC',
  'PCS',
  'PRS',
  'SET',
  'TBS',
  'TUB',
  'UNT',
  'VLS'
])

const containerLetterValues: Record<string, number> = {
  A: 10,
  B: 12,
  C: 13,
  D: 14,
  E: 15,
  F: 16,
  G: 17,
  H: 18,
  I: 19,
  J: 20,
  K: 21,
  L: 23,
  M: 24,
  N: 25,
  O: 26,
  P: 27,
  Q: 28,
  R: 29,
  S: 30,
  T: 31,
  U: 32,
  V: 34,
  W: 35,
  X: 36,
  Y: 37,
  Z: 38
}

/**
 * ISO 6346 container number: 3 owner letters + category letter (U/J/Z) +
 * 6 serial digits + 1 check digit. The check digit is the weighted sum
 * (weights 1, 2, 4, ... 512) of the first 10 characters modulo 11, where a
 * remainder of 10 is written as 0.
 */
export function isValidContainerNumber(value: unknown): boolean {
  const code = text(value).toUpperCase().replace(/[\s-]/g, '')
  if (!/^[A-Z]{3}[UJZ]\d{7}$/.test(code)) return false
  let sum = 0
  for (let index = 0; index < 10; index++) {
    const char = code[index]
    const charValue = char >= '0' && char <= '9' ? Number(char) : containerLetterValues[char]
    sum += charValue * 2 ** index
  }
  const remainder = sum % 11
  return (remainder === 10 ? 0 : remainder) === Number(code[10])
}

/** Master air waybill: 11 digits (3-digit airline prefix + 8-digit serial), dashes/spaces ignored. */
export function isValidMawbNumber(value: unknown) {
  return /^\d{11}$/.test(text(value).replace(/[\s-]/g, ''))
}

/** Schemes whose goods are exported against a licence/authorization on file. */
function schemeNeedsLicence(schemeCode?: string): boolean {
  if (blank(schemeCode)) return false
  const scheme = schemeByCode.get(text(schemeCode))
  if (!scheme) return false
  const label = scheme.label.toLowerCase()
  return (
    scheme.value === '04' ||
    scheme.value === '16' ||
    label.includes('advance licen') ||
    label.includes('epcg') ||
    label.includes('dfia') ||
    label.includes('duty free import') ||
    label.includes('diamond imprest') ||
    label.includes('replenishment') ||
    label.includes('deec')
  )
}

// ---------------------------------------------------------------------------
// Party / branch master-data formats (used by the party and branch dialogs)
// ---------------------------------------------------------------------------

/** IEC: PAN-style 10 characters, or the older 10-digit DGFT number. */
export function isValidIec(value: unknown) {
  return /^([A-Z]{5}[0-9]{4}[A-Z]|[0-9]{10})$/.test(text(value).toUpperCase())
}

export function isValidPan(value: unknown) {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(text(value).toUpperCase())
}

export function isValidTan(value: unknown) {
  return /^[A-Z]{4}[0-9]{5}[A-Z]$/.test(text(value).toUpperCase())
}

export function isValidGstin(value: unknown): boolean {
  const gstin = text(value).toUpperCase()
  if (!/^\d{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return false
  return stateCodes.has(String(Number(gstin.slice(0, 2))))
}

export function isValidIfsc(value: unknown) {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(text(value).toUpperCase())
}

/** Bank AD (Authorised Dealer) code issued for customs/FEMA reporting. */
export function isValidAdCode(value: unknown) {
  return /^\d{14}$/.test(text(value))
}

export function isValidIndianPin(value: unknown) {
  return /^[1-9]\d{5}$/.test(text(value))
}

export function isValidEmail(value: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value))
}

export function isValidMobile(value: unknown) {
  return /^\+?\d{10,15}$/.test(text(value).replace(/[\s-]/g, ''))
}

// ---------------------------------------------------------------------------
// Layer 1: leaf schema
// ---------------------------------------------------------------------------

const positive = s
  .string()
  .refine((value) => (blank(value) || isPositive(value) ? undefined : 'Enter a number above zero'))

const optionalPositive = s
  .string()
  .optional()
  .refine((value) => (blank(value) || isPositive(value) ? undefined : 'Enter a number above zero'))

const optionalNonNegative = s
  .string()
  .optional()
  .refine((value) => (blank(value) || isNonNegative(value) ? undefined : 'Cannot be negative'))

const optionalRate = s
  .string()
  .optional()
  .refine((value) =>
    blank(value) || (isPositive(value) && num(value) <= 100) ? undefined : 'Enter a rate between 0 and 100'
  )

const optionalDateNotFuture = s
  .string()
  .optional()
  .refine((value) => {
    if (blank(value)) return undefined
    if (!isValidIsoDate(value)) return 'Enter a valid date'
    return text(value) > todayIso() ? 'Date cannot be in the future' : undefined
  })

export const shippingBillSchema = s.object({
  jobNumber: s.string().optional(),
  jobDate: s.string().refine((value) => {
    if (blank(value)) return undefined
    if (!isValidIsoDate(value)) return 'Enter a valid date'
    return text(value) > todayIso() ? 'Job date cannot be in the future' : undefined
  }),
  exporterId: s.string(),
  exporterBranchId: s.string(),
  consigneeId: s.string(),
  consigneeBranchId: s.string(),
  loadingPort: s
    .string()
    .refine((value) =>
      blank(value) || /^IN[A-Z0-9]{4}$/.test(text(value).toUpperCase())
        ? undefined
        : 'Enter an Indian port code (e.g. INNSA1)'
    ),
  finalDestinationPort: s.string().refine((value) => {
    if (blank(value)) return undefined
    const code = text(value).toUpperCase()
    if (!isValidPortCode(code)) return 'Enter a valid port code (e.g. USLAX)'
    return code.startsWith('IN') ? 'Destination port must be outside India for an export' : undefined
  }),
  dischargePort: s
    .string()
    .optional()
    .refine((value, formData) => {
      if (blank(value)) return undefined
      const code = text(value).toUpperCase()
      if (!isValidPortCode(code)) return 'Enter a valid port code'
      return code === text(formData?.loadingPort).toUpperCase()
        ? 'Discharge port cannot be the loading port'
        : undefined
    }),
  originStateCode: s
    .string()
    .optional()
    .refine((value) =>
      blank(value) || stateCodes.has(String(Number(value))) ? undefined : 'Select a valid Indian state'
    ),
  nfeiCategory: s
    .string()
    .optional()
    .refine((value, formData) => {
      const formInvoices = (formData?.invoices ?? []) as { items?: { schemeCode?: string }[] }[]
      const needsNfei = formInvoices.some((invoice) =>
        (invoice.items ?? []).some((item) => text(item.schemeCode) === '99')
      )
      if (needsNfei && blank(value)) return 'Required when an item uses the NFEI scheme (99)'
      if (!blank(value) && !['01', '02', '03', '07', '08'].includes(text(value))) return 'Select a valid NFEI category'
      return undefined
    }),
  rbiWaiverNumber: s
    .string()
    .optional()
    .refine((value) =>
      blank(value) || /^[A-Za-z0-9/-]+$/.test(text(value)) ? undefined : 'Invalid RBI waiver number'
    ),
  rbiWaiverDate: s
    .string()
    .optional()
    .refine((value, formData) => {
      if (blank(value)) return text(formData?.rbiWaiverNumber) ? 'Enter the RBI waiver date' : undefined
      if (!isValidIsoDate(value)) return 'Enter a valid date'
      if (text(value) > todayIso()) return 'Date cannot be in the future'
      return text(formData?.jobDate) && text(value) > text(formData.jobDate)
        ? 'Cannot be after the job date'
        : undefined
    }),
  sealType: s.string().optional(),
  numberOfContainers: s
    .string()
    .optional()
    .refine((value) => (blank(value) || isNonNegativeInt(value) ? undefined : 'Enter a whole number of containers')),
  natureOfCargo: s
    .string()
    .refine((value) => (blank(value) || cargoCodes.has(text(value)) ? undefined : 'Select the nature of cargo')),
  grossWeight: positive,
  netWeight: s.string().refine((value, formData) => {
    if (blank(value)) return undefined
    if (!isPositive(value)) return 'Enter a number above zero'
    return isPositive(formData?.grossWeight) && num(value) > num(formData.grossWeight)
      ? 'Net weight cannot exceed gross weight'
      : undefined
  }),
  measurementUnit: s
    .string()
    .refine((value) => (blank(value) || weightUnitCodes.has(text(value)) ? undefined : 'Select a weight unit')),
  totalPackages: s
    .string()
    .refine((value) => (blank(value) || isPositiveInt(value) ? undefined : 'Enter a whole number above zero')),
  marksAndNumbers: s
    .string()
    .optional()
    .refine((value, formData) => {
      const bulk = ['LB', 'DB'].includes(text(formData?.natureOfCargo))
      return bulk || !blank(value) ? undefined : 'Marks and numbers are required for packaged cargo'
    }),
  loosePackets: s
    .string()
    .optional()
    .refine((value, formData) => {
      if (blank(value)) return undefined
      if (!isNonNegativeInt(value)) return 'Enter a whole number'
      return isPositiveInt(formData?.totalPackages) && num(value) > num(formData.totalPackages)
        ? 'Loose packets cannot exceed total packages'
        : undefined
    }),
  mawbNumber: s
    .string()
    .optional()
    .refine((value) =>
      blank(value) || isValidMawbNumber(value) ? undefined : 'MAWB must be 11 digits (e.g. 125-12345678)'
    ),
  hawbNumber: s
    .string()
    .optional()
    .refine((value, formData) => {
      if (blank(value)) return undefined
      if (!/^[A-Za-z0-9-]{6,20}$/.test(text(value))) return 'Invalid HAWB number'
      return blank(formData?.mawbNumber) ? 'Enter the MAWB number before the HAWB number' : undefined
    }),
  invoiceNumber: s
    .string()
    .refine((value) =>
      blank(value) || /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(text(value)) ? undefined : 'Invalid invoice number format'
    ),
  invoiceDate: s.string().refine((value, formData) => {
    if (blank(value)) return undefined
    if (!isValidIsoDate(value)) return 'Enter a valid date'
    if (text(value) > todayIso()) return 'Invoice date cannot be in the future'
    return text(formData?.jobDate) && text(value) > text(formData.jobDate)
      ? 'Invoice date cannot be after the job date'
      : undefined
  }),
  currency: s
    .string()
    .refine((value) =>
      blank(value) || currencyCodes.has(text(value).toUpperCase()) ? undefined : 'Select a valid currency'
    ),
  invoiceTotal: optionalNonNegative,
  contractType: s
    .string()
    .refine((value) => (blank(value) || contractCodes.has(text(value)) ? undefined : 'Select a contract type')),
  buyerId: s.string().optional(),
  buyerBranchId: s.string().optional(),
  thirdPartyId: s.string().optional(),
  thirdPartyBranchId: s.string().optional(),
  freightRate: optionalRate,
  insuranceRate: optionalRate,
  commissionRate: optionalRate,
  discountRate: optionalRate,
  otherDeductionsRate: optionalRate,
  freightAmount: optionalPositive,
  insuranceAmount: optionalPositive,
  commissionAmount: optionalPositive,
  discountAmount: optionalPositive,
  otherDeductionsAmount: optionalPositive,
  freightCurrency: s
    .string()
    .optional()
    .refine((value) =>
      blank(value) || currencyCodes.has(text(value).toUpperCase()) ? undefined : 'Select a valid currency'
    ),
  insuranceCurrency: s
    .string()
    .optional()
    .refine((value) =>
      blank(value) || currencyCodes.has(text(value).toUpperCase()) ? undefined : 'Select a valid currency'
    ),
  commissionCurrency: s
    .string()
    .optional()
    .refine((value) =>
      blank(value) || currencyCodes.has(text(value).toUpperCase()) ? undefined : 'Select a valid currency'
    ),
  discountCurrency: s
    .string()
    .optional()
    .refine((value) =>
      blank(value) || currencyCodes.has(text(value).toUpperCase()) ? undefined : 'Select a valid currency'
    ),
  otherDeductionsCurrency: s
    .string()
    .optional()
    .refine((value) =>
      blank(value) || currencyCodes.has(text(value).toUpperCase()) ? undefined : 'Select a valid currency'
    ),
  packingCharges: optionalPositive,
  freightInsuranceIncluded: s
    .string()
    .optional()
    .refine((value) => (blank(value) || priceInclusionCodes.has(text(value)) ? undefined : 'Select a valid option')),
  contractNumber: s.string().optional(),
  natureOfPayment: s
    .string()
    .optional()
    .refine((value) => (blank(value) || paymentCodes.has(text(value)) ? undefined : 'Select a valid payment type')),
  periodOfPayment: s
    .string()
    .optional()
    .refine((value) => (blank(value) || isNonNegativeInt(value) ? undefined : 'Enter payment period in whole days')),
  ritcCode: s
    .string()
    .refine((value) => (blank(value) || /^\d{8}$/.test(text(value)) ? undefined : 'RITC / HS code must be 8 digits')),
  schemeCode: s
    .string()
    .refine((value) => (blank(value) || schemeByCode.has(text(value)) ? undefined : 'Select a valid scheme code')),
  goodsDescription1: s.string().minVal(3).maxVal(120),
  goodsDescription2: s.string().optional().maxVal(120),
  goodsDescription3: s.string().optional().maxVal(120),
  accessoriesDescription: s.string().optional().maxVal(120),
  quantity: positive,
  unitOfMeasurement: s
    .string()
    .refine((value) =>
      blank(value) || quantityCodeSet.has(text(value).toUpperCase()) ? undefined : 'Select a valid unit (UQC)'
    ),
  unitPrice: positive,
  unitOfRate: s
    .string()
    .optional()
    .refine((value) =>
      blank(value) || quantityCodeSet.has(text(value).toUpperCase()) ? undefined : 'Select a valid unit (UQC)'
    ),
  presentMarketValue: optionalPositive,
  numberOfUnits: optionalPositive,
  lineTotal: optionalNonNegative,
  accessoryStatus: s
    .string()
    .optional()
    .refine((value) =>
      blank(value) || ['0', '1', '2'].includes(text(value)) ? undefined : 'Select a valid accessory status'
    ),
  itemThirdPartyId: s.string().optional(),
  itemThirdPartyBranchId: s.string().optional(),
  ar4Number: s
    .string()
    .optional()
    .refine((value) => (blank(value) || /^[A-Za-z0-9/-]+$/.test(text(value)) ? undefined : 'Invalid AR4 number')),
  ar4Date: optionalDateNotFuture,
  igstPaymentStatus: s
    .string()
    .optional()
    .refine((value) =>
      blank(value) || ['NA', 'LUT', 'P'].includes(text(value)) ? undefined : 'Select a valid IGST status'
    ),
  taxableValue: optionalPositive,
  igstAmount: optionalPositive,
  drawbackSerialNumber: s
    .string()
    .optional()
    .refine((value) =>
      blank(value) || /^[A-Za-z0-9]{4,10}$/.test(text(value)) ? undefined : 'Drawback serial must be 4-10 characters'
    ),
  drawbackUnit: s
    .string()
    .optional()
    .refine((value) =>
      blank(value) || quantityCodeSet.has(text(value).toUpperCase()) ? undefined : 'Select a valid unit (UQC)'
    ),
  drawbackQuantity: optionalPositive,
  cess: optionalNonNegative,
  originDistrictCode: s
    .string()
    .optional()
    .refine((value) => (blank(value) || /^\d{1,4}$/.test(text(value)) ? undefined : 'District code must be numeric')),
  tradeAgreementsCode: s
    .string()
    .optional()
    .refine((value) =>
      blank(value) || tradeAgreementCodes.has(text(value)) ? undefined : 'Select a valid trade agreement'
    ),
  endUseOfItem: s
    .string()
    .optional()
    .refine((value) => (blank(value) || /^[A-Za-z0-9]+$/.test(text(value)) ? undefined : 'Invalid end use code')),
  totalPackage: s
    .string()
    .optional()
    .refine((value) => (blank(value) || isPositiveInt(value) ? undefined : 'Enter a whole number above zero')),
  containerNumber: s.string().refine((value) => {
    if (blank(value)) return undefined
    const code = text(value).toUpperCase().replace(/[\s-]/g, '')
    if (!/^[A-Z]{3}[UJZ]\d{7}$/.test(code)) return 'Format: 4 letters + 7 digits (e.g. CSQU3054383)'
    return isValidContainerNumber(code) ? undefined : 'Invalid container check digit (ISO 6346)'
  }),
  containerSize: s.string(),
  exciseSealNumber: s.string().optional(),
  sealDate: optionalDateNotFuture,
  sealDeviceId: s.string().optional(),
  movementDocumentType: s.string().optional(),
  movementDocumentNumber: s.string().optional(),
  packingNumberFrom: s
    .string()
    .refine((value) => (blank(value) || isPositiveInt(value) ? undefined : 'Enter a whole number above zero')),
  packingNumberTo: s
    .string()
    .refine((value) => (blank(value) || isPositiveInt(value) ? undefined : 'Enter a whole number above zero')),
  packingCode: s.string().optional(),
  documentTypeCode: s
    .string()
    .refine((value) =>
      blank(value) || documentCodeSet.has(text(value)) ? undefined : 'Select a valid e-Sanchit document type'
    ),
  documentReferenceNumber: s.string().minVal(3),
  imageReferenceNumber: s
    .string()
    .optional()
    .refine((value) => (blank(value) || text(value).length >= 8 ? undefined : 'e-Sanchit IRN looks too short')),
  documentIssueDate: optionalDateNotFuture,
  documentExpiryDate: optionalDateNotFuture,
  invoiceSerialNumber: s
    .string()
    .optional()
    .refine((value) => (blank(value) || isPositiveInt(value) ? undefined : 'Enter a valid invoice serial number')),
  itemSerialNumber: s
    .string()
    .optional()
    .refine((value) => (blank(value) || isPositiveInt(value) ? undefined : 'Enter a valid item serial number')),
  registrationNumber: s
    .string()
    .refine((value) =>
      blank(value) || /^[A-Za-z0-9/-]{5,}$/.test(text(value)) ? undefined : 'Invalid licence registration number'
    ),
  registrationDate: optionalDateNotFuture,
  licenseSerialNumber: s
    .string()
    .optional()
    .refine((value) => (blank(value) || isPositiveInt(value) ? undefined : 'Enter a valid licence serial number')),
  itemSerialNumberPartE: s
    .string()
    .optional()
    .refine((value) => (blank(value) || isPositiveInt(value) ? undefined : 'Enter a valid item serial number')),
  itemSerialNumberPartC: s
    .string()
    .optional()
    .refine((value) => (blank(value) || isPositiveInt(value) ? undefined : 'Enter a valid item serial number')),
  licenseQuantity: optionalPositive,
  licenseExportQuantity: optionalPositive,
  indigenousOrImported: s
    .string()
    .optional()
    .refine((value) =>
      blank(value) || ['I', 'D'].includes(text(value)) ? undefined : 'Select imported or indigenous'
    ),
  exchangeRate: optionalPositive
})

// ---------------------------------------------------------------------------
// Layer 2: cross-field domain validation
// ---------------------------------------------------------------------------

export function validateShippingBill(values: ShippingBillFormValues): DomainError[] {
  const errors = new Map<string, string>()
  function add(path: string, message: string) {
    if (!errors.has(path)) errors.set(path, message)
  }

  const jobDate = text(values.jobDate)
  const jobDateValid = isValidIsoDate(jobDate)
  function checkDate(path: string, value: unknown, label: string) {
    if (blank(value)) return
    if (!isValidIsoDate(value)) add(path, `Enter a valid ${label} date`)
    else if (text(value) > todayIso()) add(path, `${label} date cannot be in the future`)
    else if (jobDateValid && text(value) > jobDate) add(path, `${label} date cannot be after the job date`)
  }

  // -- Header: route ---------------------------------------------------------
  const loadingPort = text(values.loadingPort).toUpperCase()
  const destinationPort = text(values.finalDestinationPort).toUpperCase()
  if (loadingPort && destinationPort && loadingPort === destinationPort)
    add('finalDestinationPort', 'Destination port cannot be the same as the loading port')

  // -- Header: single-field basics (duplicated from the leaf schema so this
  // function is also correct when used without the form) --------------------
  if (!jobDateValid) add('jobDate', 'Enter a valid job date')
  else if (jobDate > todayIso()) add('jobDate', 'Job date cannot be in the future')
  if (!isPositive(values.grossWeight)) add('grossWeight', 'Enter the gross weight above zero')
  if (!isPositive(values.netWeight)) add('netWeight', 'Enter the net weight above zero')
  if (isPositive(values.grossWeight) && isPositive(values.netWeight) && num(values.netWeight) > num(values.grossWeight))
    add('netWeight', 'Net weight cannot exceed gross weight')
  if (!isPositiveInt(values.totalPackages)) add('totalPackages', 'Enter the total number of packages above zero')

  // -- Header: cargo, weights and packages -----------------------------------
  const nature = text(values.natureOfCargo)
  const bulkCargo = nature === 'LB' || nature === 'DB'
  const containerized = nature === 'C' || nature === 'CP'
  const containers = values.containers
  if (containerized && containers.length === 0 && !isPositive(values.numberOfContainers))
    add('numberOfContainers', 'Containerized cargo needs at least one container (add containers or enter the count)')
  if (bulkCargo && containers.length > 0) add('containers', 'Bulk cargo cannot have container details')
  if (bulkCargo && isPositive(values.numberOfContainers)) add('numberOfContainers', 'Bulk cargo cannot have containers')

  // -- Header: RBI waiver pair ------------------------------------------------
  if (!blank(values.rbiWaiverNumber) && blank(values.rbiWaiverDate)) add('rbiWaiverDate', 'Enter the RBI waiver date')
  if (!blank(values.rbiWaiverDate) && blank(values.rbiWaiverNumber))
    add('rbiWaiverNumber', 'Enter the RBI waiver number for this waiver date')
  checkDate('rbiWaiverDate', values.rbiWaiverDate, 'RBI waiver')

  // -- Invoices and items ------------------------------------------------------
  const invoices = values.invoices
  if (invoices.length === 0) add('invoices', 'Add at least one invoice')

  const seenInvoiceNumbers = new Map<string, number>()
  invoices.forEach((invoice, index) => {
    const invoiceNumberKey = text(invoice.invoiceNumber).toUpperCase()
    if (invoiceNumberKey) {
      const firstIndex = seenInvoiceNumbers.get(invoiceNumberKey)
      if (firstIndex != null)
        add(`invoices.${index}.invoiceNumber`, `Same invoice number as invoice ${firstIndex + 1} on this bill`)
      else seenInvoiceNumbers.set(invoiceNumberKey, index)
    }

    checkDate(`invoices.${index}.invoiceDate`, invoice.invoiceDate, 'Invoice')

    if (blank(invoice.currency) || !currencyCodes.has(text(invoice.currency).toUpperCase()))
      add(`invoices.${index}.currency`, 'Select a valid currency')
    if (blank(invoice.contractType) || !contractCodes.has(text(invoice.contractType)))
      add(`invoices.${index}.contractType`, 'Select a valid contract type')

    // Buyer is the consignee unless the user explicitly separates them.
    if (!invoice.buyerSameAsConsignee) {
      if (blank(invoice.buyerId)) add(`invoices.${index}.buyerId`, 'Select the buyer')
      if (blank(invoice.buyerBranchId)) add(`invoices.${index}.buyerBranchId`, 'Select the buyer branch / address')
    }
    // A selected third party is meaningless without its address branch.
    if (!blank(invoice.thirdPartyId) && blank(invoice.thirdPartyBranchId))
      add(`invoices.${index}.thirdPartyBranchId`, 'Select the third party branch / address')
    if (blank(invoice.thirdPartyId) && !blank(invoice.thirdPartyBranchId))
      add(`invoices.${index}.thirdPartyId`, 'Select the third party for this branch')

    // Charges: a rate (%) and an amount are two ways of stating the same
    // charge, so exactly one of them may be filled per charge.
    const charges = [
      {
        label: 'Freight',
        rate: invoice.freightRate,
        amount: invoice.freightAmount,
        amountPath: `invoices.${index}.freightAmount`
      },
      {
        label: 'Insurance',
        rate: invoice.insuranceRate,
        amount: invoice.insuranceAmount,
        amountPath: `invoices.${index}.insuranceAmount`
      },
      {
        label: 'Commission',
        rate: invoice.commissionRate,
        amount: invoice.commissionAmount,
        amountPath: `invoices.${index}.commissionAmount`
      },
      {
        label: 'Discount',
        rate: invoice.discountRate,
        amount: invoice.discountAmount,
        amountPath: `invoices.${index}.discountAmount`
      },
      {
        label: 'Other deductions',
        rate: invoice.otherDeductionsRate,
        amount: invoice.otherDeductionsAmount,
        amountPath: `invoices.${index}.otherDeductionsAmount`
      }
    ]
    function hasCharge(label: string) {
      const charge = charges.find((entry) => entry.label === label)
      return charge != null && (!blank(charge.rate) || !blank(charge.amount))
    }
    charges.forEach((charge) => {
      if (!blank(charge.rate) && !blank(charge.amount))
        add(charge.amountPath, `Enter the ${charge.label.toLowerCase()} rate or the amount, not both`)
    })

    // Contract type states which charges are inside the invoice price.
    const contract = text(invoice.contractType)
    if ((contract === 'CIF' || contract === 'CF') && !hasCharge('Freight'))
      add(`invoices.${index}.freightAmount`, `${contract} price includes freight - enter the freight rate or amount`)
    if ((contract === 'CIF' || contract === 'CI') && !hasCharge('Insurance'))
      add(
        `invoices.${index}.insuranceAmount`,
        `${contract} price includes insurance - enter the insurance rate or amount`
      )

    // "Price includes" must agree with the charges actually entered.
    const inclusion = text(invoice.freightInsuranceIncluded)
    if (inclusion === 'B' && (!hasCharge('Freight') || !hasCharge('Insurance')))
      add(
        `invoices.${index}.freightInsuranceIncluded`,
        'Price is marked as including freight and insurance - enter both charges'
      )
    if (inclusion === 'F' && !hasCharge('Freight'))
      add(
        `invoices.${index}.freightInsuranceIncluded`,
        'Price is marked as including freight - enter the freight charge'
      )
    if (inclusion === 'F' && hasCharge('Insurance'))
      add(`invoices.${index}.insuranceAmount`, 'Price includes freight only, but an insurance charge is entered')
    if (inclusion === 'I' && !hasCharge('Insurance'))
      add(
        `invoices.${index}.freightInsuranceIncluded`,
        'Price is marked as including insurance - enter the insurance charge'
      )
    if (inclusion === 'I' && hasCharge('Freight'))
      add(`invoices.${index}.freightAmount`, 'Price includes insurance only, but a freight charge is entered')
    if (inclusion === 'N' && (hasCharge('Freight') || hasCharge('Insurance')))
      add(
        `invoices.${index}.freightInsuranceIncluded`,
        'Price is marked as including neither freight nor insurance, but a charge is entered'
      )

    if (text(invoice.natureOfPayment) === 'AP' && isPositive(invoice.periodOfPayment))
      add(
        `invoices.${index}.periodOfPayment`,
        'Advance payment has no payment period - clear this or change the payment type'
      )

    // A typed-in invoice total must reconcile with the goods lines.
    if (!blank(invoice.invoiceTotal) && invoice.items.length > 0) {
      const computed = invoiceTotal(invoice)
      const entered = num(invoice.invoiceTotal)
      const tolerance = Math.max(0.5, Math.abs(computed) * 0.01)
      if (Number.isFinite(entered) && Math.abs(entered - computed) > tolerance)
        add(
          `invoices.${index}.invoiceTotal`,
          `Invoice total does not match the goods total (${invoice.currency || 'amount'} ${computed.toLocaleString(undefined, { maximumFractionDigits: 2 })})`
        )
    }

    if (invoice.items.length === 0) add(`invoices.${index}.items`, 'Add at least one goods item to this invoice')

    invoice.items.forEach((item, itemIndex) => {
      const base = `invoices.${index}.items.${itemIndex}`

      if (!/^\d{8}$/.test(text(item.ritcCode))) add(`${base}.ritcCode`, 'RITC / HS code must be 8 digits')
      if (text(item.goodsDescription1).length < 3)
        add(`${base}.goodsDescription1`, 'Describe the goods (at least 3 characters)')
      if (!isPositive(item.quantity)) add(`${base}.quantity`, 'Enter a quantity above zero')
      if (!isPositive(item.unitPrice)) add(`${base}.unitPrice`, 'Enter a unit price above zero')
      if (blank(item.schemeCode) || !schemeByCode.has(text(item.schemeCode)))
        add(`${base}.schemeCode`, 'Select a valid scheme code')
      if (blank(item.unitOfMeasurement) || !quantityCodeSet.has(text(item.unitOfMeasurement).toUpperCase()))
        add(`${base}.unitOfMeasurement`, 'Select a valid unit (UQC)')

      if (
        !blank(item.quantity) &&
        integerQuantityCodes.has(text(item.unitOfMeasurement).toUpperCase()) &&
        !Number.isInteger(num(item.quantity))
      )
        add(`${base}.quantity`, 'Quantity must be a whole number for this unit')

      if (!blank(item.lineTotal) && isPositive(item.quantity) && isPositive(item.unitPrice)) {
        const expected = num(item.quantity) * num(item.unitPrice)
        const tolerance = Math.max(0.5, Math.abs(expected) * 0.01)
        if (Math.abs(num(item.lineTotal) - expected) > tolerance)
          add(`${base}.lineTotal`, 'Item total does not match quantity × unit price')
      }

      // Scheme-driven requirements (drawback / licence / NFEI).
      const scheme = schemeByCode.get(text(item.schemeCode))
      if (scheme?.drawback) {
        if (blank(item.drawbackSerialNumber))
          add(`${base}.drawbackSerialNumber`, 'Required for drawback schemes - enter the drawback serial number')
        if (blank(item.drawbackUnit))
          add(`${base}.drawbackUnit`, 'Required for drawback schemes - enter the drawback unit')
        if (blank(item.drawbackQuantity)) {
          add(`${base}.drawbackQuantity`, 'Required for drawback schemes - enter the drawback quantity')
        } else if (isPositive(item.quantity) && num(item.drawbackQuantity) > num(item.quantity)) {
          add(`${base}.drawbackQuantity`, 'Drawback quantity cannot exceed the item quantity')
        }
      }
      if (schemeNeedsLicence(item.schemeCode)) {
        const covered = values.licenses.some((license) => {
          const licenseInvoice = blank(license.invoiceSerialNumber) ? null : num(license.invoiceSerialNumber)
          const licenseItem = blank(license.itemSerialNumber) ? null : num(license.itemSerialNumber)
          return (
            (licenseInvoice == null || licenseInvoice === index + 1) &&
            (licenseItem == null || licenseItem === itemIndex + 1)
          )
        })
        if (!covered)
          add(
            `${base}.schemeCode`,
            'This scheme needs a licence - add it under Others → Licences for this invoice/item'
          )
      }

      // IGST paid on the item needs the tax breakup; LUT/NA need nothing.
      if (text(item.igstPaymentStatus) === 'P') {
        if (blank(item.taxableValue))
          add(`${base}.taxableValue`, 'Required when IGST is paid - enter the taxable value')
        if (blank(item.igstAmount)) {
          add(`${base}.igstAmount`, 'Required when IGST is paid - enter the IGST amount')
        } else if (isPositive(item.taxableValue) && num(item.igstAmount) > num(item.taxableValue)) {
          add(`${base}.igstAmount`, 'IGST amount cannot exceed the taxable value')
        }
      }

      if (item.thirdPartyItem) {
        if (blank(item.itemThirdPartyId)) add(`${base}.itemThirdPartyId`, 'Select the item third party')
        if (blank(item.itemThirdPartyBranchId))
          add(`${base}.itemThirdPartyBranchId`, 'Select the item third party branch / address')
      }

      // AR4 (excise) details travel as a pair.
      if (!blank(item.ar4Number) && blank(item.ar4Date)) add(`${base}.ar4Date`, 'Enter the AR4 date')
      if (!blank(item.ar4Date) && blank(item.ar4Number)) add(`${base}.ar4Number`, 'Enter the AR4 number for this date')
      checkDate(`${base}.ar4Date`, item.ar4Date, 'AR4')

      // Accessories entered separately / free of cost must be described.
      if (['1', '2'].includes(text(item.accessoryStatus)) && blank(item.accessoriesDescription))
        add(`${base}.accessoriesDescription`, 'Describe the accessories for the selected accessory status')
      if (!blank(item.accessoriesDescription) && blank(item.accessoryStatus))
        add(`${base}.accessoryStatus`, 'Select the accessory status for this description')
    })
  })

  // NFEI shipments (scheme 99) must state why no foreign exchange is involved,
  // and an NFEI category without an NFEI item is contradictory.
  const hasNfeiItem = invoices.some((invoice) => invoice.items.some((item) => text(item.schemeCode) === '99'))
  if (hasNfeiItem && blank(values.nfeiCategory))
    add(
      'nfeiCategory',
      'Required when an item uses the NFEI scheme (99) - select it under Regulatory and route exceptions'
    )
  if (!hasNfeiItem && !blank(values.nfeiCategory))
    add('nfeiCategory', 'NFEI category is selected but no item uses the NFEI scheme (99)')

  // Header total packages must reconcile with per-item packages when every
  // item declares them, and with the packing list ranges when present.
  const allItemsHavePackages =
    invoices.length > 0 && invoices.every((invoice) => invoice.items.every((item) => !blank(item.totalPackage)))
  if (allItemsHavePackages && isPositiveInt(values.totalPackages)) {
    const itemPackages = invoices.reduce(
      (sum, invoice) => sum + invoice.items.reduce((itemSum, item) => itemSum + num(item.totalPackage), 0),
      0
    )
    if (itemPackages !== num(values.totalPackages))
      add('totalPackages', 'Total packages does not match the sum of packages declared on the goods items')
  }

  // -- Containers --------------------------------------------------------------
  const seenContainers = new Map<string, number>()
  containers.forEach((container, index) => {
    const base = `containers.${index}`
    const containerKey = text(container.containerNumber).toUpperCase().replace(/[\s-]/g, '')
    if (containerKey) {
      const firstIndex = seenContainers.get(containerKey)
      if (firstIndex != null) add(`${base}.containerNumber`, `Same container number as container ${firstIndex + 1}`)
      else seenContainers.set(containerKey, index)
    }
    if (!isValidContainerNumber(container.containerNumber))
      add(`${base}.containerNumber`, 'Enter a valid ISO 6346 container number (e.g. CSQU3054383)')
    if (blank(container.containerSize)) add(`${base}.containerSize`, 'Select the container size')

    if (!blank(container.exciseSealNumber) && blank(container.sealDate))
      add(`${base}.sealDate`, 'Enter the seal date for this seal number')
    if (!blank(container.sealDate) && blank(container.exciseSealNumber))
      add(`${base}.exciseSealNumber`, 'Enter the seal number for this seal date')
    checkDate(`${base}.sealDate`, container.sealDate, 'Seal')

    // Electronic / RFID seals are identified by their device.
    const sealType = text(container.sealType)
    if ((sealType === '2' || sealType === '3') && blank(container.sealDeviceId))
      add(`${base}.sealDeviceId`, 'Enter the seal device ID for electronic / RFID seals')
    if (!blank(container.sealDeviceId) && sealType !== '2' && sealType !== '3')
      add(`${base}.sealType`, 'Select the electronic / RFID seal type for this device ID')

    if (blank(container.movementDocumentType) !== blank(container.movementDocumentNumber))
      add(
        `${base}.${blank(container.movementDocumentType) ? 'movementDocumentType' : 'movementDocumentNumber'}`,
        'Enter the movement document type and number together'
      )
  })

  // -- Packing list ranges -------------------------------------------------------
  const ranges = values.packingRanges.map((range, index) => ({
    index,
    from: num(range.packingNumberFrom),
    to: num(range.packingNumberTo)
  }))
  ranges.forEach((range) => {
    if (Number.isFinite(range.from) && Number.isFinite(range.to) && range.from > range.to)
      add(`packingRanges.${range.index}.packingNumberTo`, 'Package to cannot be before package from')
  })
  const sortedRanges = ranges
    .filter((range) => Number.isInteger(range.from) && Number.isInteger(range.to) && range.from <= range.to)
    .sort((a, b) => a.from - b.from)
  for (let position = 1; position < sortedRanges.length; position++) {
    if (sortedRanges[position].from <= sortedRanges[position - 1].to)
      add(`packingRanges.${sortedRanges[position].index}.packingNumberFrom`, 'Packing ranges cannot overlap')
  }
  if (sortedRanges.length > 0 && isPositiveInt(values.totalPackages)) {
    const rangedPackages = sortedRanges.reduce((sum, range) => sum + (range.to - range.from + 1), 0)
    if (rangedPackages !== num(values.totalPackages))
      add('totalPackages', 'Total packages does not match the packing list ranges')
  }

  // -- Supporting documents (e-Sanchit) ------------------------------------------
  function checkSerialReferences(pathPrefix: string, invoiceSerial: unknown, itemSerial: unknown) {
    if (!blank(itemSerial) && blank(invoiceSerial))
      add(`${pathPrefix}.invoiceSerialNumber`, 'Enter the invoice serial number for this item serial number')
    if (blank(invoiceSerial) || !Number.isInteger(num(invoiceSerial))) return
    const invoiceIndex = num(invoiceSerial) - 1
    if (invoiceIndex < 0 || invoiceIndex >= invoices.length) {
      add(`${pathPrefix}.invoiceSerialNumber`, `There is no invoice ${num(invoiceSerial)} on this bill`)
      return
    }
    if (!blank(itemSerial) && Number.isInteger(num(itemSerial))) {
      const itemIndex = num(itemSerial) - 1
      if (itemIndex < 0 || itemIndex >= invoices[invoiceIndex].items.length)
        add(`${pathPrefix}.itemSerialNumber`, `Invoice ${num(invoiceSerial)} has no item ${num(itemSerial)}`)
    }
  }
  values.documents.forEach((document, index) => {
    const base = `documents.${index}`
    if (blank(document.documentTypeCode) || !documentCodeSet.has(text(document.documentTypeCode)))
      add(`${base}.documentTypeCode`, 'Select a valid e-Sanchit document type')
    checkSerialReferences(base, document.invoiceSerialNumber, document.itemSerialNumber)
    checkDate(`${base}.documentIssueDate`, document.documentIssueDate, 'Document issue')
    if (!blank(document.documentExpiryDate)) {
      if (blank(document.documentIssueDate))
        add(`${base}.documentIssueDate`, 'Enter the issue date for this expiry date')
      else if (isValidIsoDate(document.documentIssueDate) && isValidIsoDate(document.documentExpiryDate)) {
        if (text(document.documentExpiryDate) <= text(document.documentIssueDate))
          add(`${base}.documentExpiryDate`, 'Expiry date must be after the issue date')
        else if (jobDateValid && text(document.documentExpiryDate) < jobDate)
          add(`${base}.documentExpiryDate`, 'This document has expired before the job date')
      }
    }
    if (!blank(document.icegateId) && blank(document.imageReferenceNumber))
      add(`${base}.imageReferenceNumber`, 'Enter the e-Sanchit image reference (IRN) for this ICEGATE ID')
  })

  // -- Licences ---------------------------------------------------------------------
  const seenLicences = new Map<string, number>()
  values.licenses.forEach((license, index) => {
    const base = `licenses.${index}`
    checkSerialReferences(base, license.invoiceSerialNumber, license.itemSerialNumber)
    checkDate(`${base}.registrationDate`, license.registrationDate, 'Licence registration')

    const licenceKey = `${text(license.registrationNumber).toUpperCase()}|${text(license.licenseSerialNumber)}`
    if (!blank(license.registrationNumber)) {
      const firstIndex = seenLicences.get(licenceKey)
      if (firstIndex != null) add(`${base}.registrationNumber`, `Same licence as licence ${firstIndex + 1}`)
      else seenLicences.set(licenceKey, index)
    }

    if (blank(license.licenseQuantity) !== blank(license.licenseExportQuantity))
      add(
        `${base}.${blank(license.licenseQuantity) ? 'licenseQuantity' : 'licenseExportQuantity'}`,
        'Enter the licence quantity and the export quantity together'
      )
    if (
      isPositive(license.licenseQuantity) &&
      isPositive(license.licenseExportQuantity) &&
      num(license.licenseExportQuantity) > num(license.licenseQuantity)
    )
      add(`${base}.licenseExportQuantity`, 'Export quantity cannot exceed the licence quantity')
    if (!blank(license.licenseQuantity) && blank(license.indigenousOrImported))
      add(`${base}.indigenousOrImported`, 'Select whether the licensed goods are imported or indigenous')
  })

  return [...errors.entries()].map(([path, message]) => ({ path, message }))
}
