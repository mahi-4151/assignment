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
  sealTypes,
  weightUnits
} from '@/data/types'
import { countries, ports } from '../model'
import { mockRequest } from './mock-transport'

/**
 * Reference-data (form options) mock service — the equivalent of
 * `GET /api/reference-data/*` endpoints.
 *
 * All static option lists that the Shipping Bill form needs are served from
 * here as Promises. Components must not import the underlying `src/data/*`
 * arrays directly; they consume `useFormOptions()` (or the search methods
 * below), so swapping in real HTTP endpoints later changes only this file.
 * The `src/data/*` modules act as the mock database tables behind it.
 */

export interface SelectOption {
  value: string | number
  label: string
}

export type SchemeCodeOption = (typeof schemeCodes)[number]

export interface FormOptionsBundle {
  states: SelectOption[]
  ports: SelectOption[]
  countries: SelectOption[]
  currencies: SelectOption[]
  cargoTypes: SelectOption[]
  sealTypes: SelectOption[]
  weightUnits: SelectOption[]
  contractTypes: SelectOption[]
  paymentTypes: SelectOption[]
  priceInclusionTypes: SelectOption[]
  quantityCodes: SelectOption[]
  schemeCodes: SchemeCodeOption[]
  tradeAgreements: SelectOption[]
  nfeiCategories: SelectOption[]
  containerSizes: SelectOption[]
  containerSealTypes: SelectOption[]
  igstStatuses: SelectOption[]
  accessoryStatuses: SelectOption[]
  licenceSources: SelectOption[]
  exporterClasses: SelectOption[]
  exporterTypes: SelectOption[]
  fileTypes: SelectOption[]
}

export interface MarksAndNumbersOption {
  value: string
  label: string
}

const marksByExporter: Record<string, MarksAndNumbersOption[]> = {
  '1000': [
    { value: 'AARAV TEXTILES / MADE IN INDIA', label: 'AARAV TEXTILES / MADE IN INDIA' },
    { value: 'ATPL / LOT NO. ______', label: 'ATPL / LOT NO. ______' }
  ],
  '1002': [
    { value: 'BLUE HARBOR EXPORTS / INDIA', label: 'BLUE HARBOR EXPORTS / INDIA' },
    { value: 'BHE / SHIPPING MARKS AS PER INVOICE', label: 'BHE / SHIPPING MARKS AS PER INVOICE' }
  ]
}

function buildBundle(): FormOptionsBundle {
  return {
    states: stateOptions,
    ports: ports.map((port) => ({ value: port.code, label: `${port.name} · ${port.code}` })),
    countries,
    currencies: currencyOptions,
    cargoTypes: cargoOptions,
    sealTypes,
    weightUnits,
    contractTypes,
    paymentTypes,
    priceInclusionTypes,
    quantityCodes,
    schemeCodes,
    tradeAgreements: Trades,
    nfeiCategories: [
      { value: '01', label: 'Free trade sample' },
      { value: '02', label: 'Diplomatic goods' },
      { value: '03', label: 'Warranty replacement' },
      { value: '07', label: 'Gift parcel' },
      { value: '08', label: 'Other' }
    ],
    containerSizes: [
      { value: '20', label: '20 ft' },
      { value: '40', label: '40 ft' },
      { value: '45', label: '45 ft' }
    ],
    containerSealTypes: [
      { value: 1, label: 'BTSL - Bottle Seal' },
      { value: 2, label: 'ESEAL - Electronic Seal' },
      { value: 3, label: 'RFID - Radio Frequency Identifier' }
    ],
    igstStatuses: [
      { value: 'NA', label: 'Not applicable' },
      { value: 'LUT', label: 'Under LUT / bond' },
      { value: 'P', label: 'Against payment' }
    ],
    accessoryStatuses: [
      { value: '0', label: 'No accessory' },
      { value: '1', label: 'Included free of cost' },
      { value: '2', label: 'Entered separately' }
    ],
    licenceSources: [
      { value: 'I', label: 'Imported' },
      { value: 'D', label: 'Indigenous' }
    ],
    exporterClasses: [
      { value: 'F', label: 'Manufacturer' },
      { value: 'R', label: 'Merchant' },
      { value: 'C', label: 'Merchant courier' },
      { value: 'D', label: 'Manufacturer courier' }
    ],
    exporterTypes: [
      { value: 'P', label: 'Private' },
      { value: 'G', label: 'Government' },
      { value: 'W', label: 'Warehouse' }
    ],
    fileTypes: [{ value: 'pdf', label: 'PDF' }]
  }
}

export const referenceDataService = {
  /** Equivalent of `GET /api/reference-data/form-options`. */
  async getFormOptions(): Promise<FormOptionsBundle> {
    return mockRequest('options', buildBundle, 300)
  },

  /** Equivalent of `GET /api/reference-data/document-codes?q=`. */
  async searchDocumentCodes(query: string): Promise<{ value: string; label: string }[]> {
    const q = query.toLowerCase().trim()
    return mockRequest(
      'options',
      () =>
        documentCodes
          .filter((doc) => doc.label.toLowerCase().includes(q) || doc.value.toLowerCase().includes(q))
          .map((doc) => ({ value: doc.value, label: doc.label })),
      150
    )
  },

  async getDocumentCodeLabel(value: string): Promise<string> {
    return mockRequest('options', () => documentCodes.find((doc) => doc.value === value)?.label ?? value, 50)
  },

  /** Equivalent of `GET /api/reference-data/file-types?q=`. */
  async searchFileTypes(query: string): Promise<{ value: string; label: string }[]> {
    const q = query.toLowerCase().trim()
    const options = buildBundle().fileTypes
    return mockRequest(
      'options',
      () =>
        options
          .filter((doc) => doc.label.toLowerCase().includes(q) || String(doc.value).includes(q))
          .map((doc) => ({ value: String(doc.value), label: doc.label })),
      150
    )
  },

  /** Equivalent of `GET /api/exporters/:id/marks-and-numbers`. Empty for unknown exporters. */
  async getMarksAndNumbers(exporterId: string): Promise<MarksAndNumbersOption[]> {
    return mockRequest('marks', () => marksByExporter[exporterId] ?? [], 200)
  }
}
