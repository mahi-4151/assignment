/* eslint-disable @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-unnecessary-condition */
import type { SavedBill, ShippingBillFormValues } from '../model'
import { emptyBill, emptyInvoice } from '../model'
import { getMockData, saveBill } from './mock-database'
import { MockApiError, mockNotFound, mockRequest } from './mock-transport'

/**
 * Shipping Bill mock service — the equivalent of `/api/shipping-bills/*`.
 *
 * Asynchronous, Promise-based, with simulated latency and HTTP-style
 * errors. Reads/writes go through the mock database behind this service;
 * `API_SEED_SHIPPING_BILLS` below stands in for bills that already exist
 * "server-side". A real backend replaces the method bodies with `fetch`
 * calls (see `toHttpShippingBillPayload` for the wire format) — no UI code
 * changes needed.
 */

/**
 * Transforms form values into the payload structure required by POST /api/shipping-bills
 * as defined in shipping_bill.http
 */
export function toHttpShippingBillPayload(values: ShippingBillFormValues) {
  function parseNum(val: unknown) {
    if (val == null || val === '') return undefined
    const parsed = Number(val)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  function parseDate(dateStr?: string) {
    if (!dateStr) return undefined
    // Returns days since Unix Epoch (1970-01-01)
    return Math.floor(new Date(dateStr).getTime() / 86400000)
  }

  const CURRENCY_MAP: Record<string, number> = {
    USD: 840,
    INR: 356,
    EUR: 978,
    AED: 784,
    GBP: 826,
    SGD: 702
  }
  function parseCurrency(c?: string) {
    return c ? CURRENCY_MAP[c] || parseNum(c) || 840 : 840
  }

  return {
    chaId: 1000,
    jobDate: parseDate(values.jobDate),
    exporterId: parseNum(values.exporterId),
    exporterBranchId: parseNum(values.exporterBranchId),
    consigneeId: parseNum(values.consigneeId),
    consigneeAddressId: parseNum(values.consigneeBranchId),
    originStateCode: parseNum(values.originStateCode),
    loadingPort: values.loadingPort,
    finalDestinationPort: values.finalDestinationPort,
    dischargePort: values.dischargePort || values.finalDestinationPort,
    sealType: parseNum(values.sealType),
    natureOfCargo: parseNum(values.natureOfCargo),
    grossWeight: parseNum(values.grossWeight),
    netWeight: parseNum(values.netWeight),
    measurementUnit: values.measurementUnit === 'KG' ? 'KGS' : values.measurementUnit,
    totalPackages: parseNum(values.totalPackages),
    marksAndNumbers: values.marksAndNumbers,
    loosePackets: parseNum(values.loosePackets),
    numberOfContainers: values.containers.length || parseNum(values.numberOfContainers) || 0,
    invoices: (values.invoices || []).map((inv, index) => ({
      serialNumber: index + 1,
      invoiceNumber: inv.invoiceNumber,
      date: parseDate(inv.invoiceDate),
      currency: parseCurrency(inv.currency),
      contractType: parseNum(inv.contractType),
      buyerId: parseNum(inv.buyerSameAsConsignee ? values.consigneeId : inv.buyerId),
      buyerAddressId: parseNum(inv.buyerSameAsConsignee ? values.consigneeBranchId : inv.buyerBranchId),
      freightCurrency: parseCurrency(inv.freightCurrency || inv.currency),
      freightAmount: parseNum(inv.freightAmount) || 0,
      insuranceCurrency: parseCurrency(inv.insuranceCurrency || inv.currency),
      insuranceAmount: parseNum(inv.insuranceAmount) || 0,
      commissionCurrency: parseCurrency(inv.commissionCurrency || inv.currency),
      commissionAmount: parseNum(inv.commissionAmount) || 0,
      discountCurrency: parseCurrency(inv.discountCurrency || inv.currency),
      discountAmount: parseNum(inv.discountAmount) || 0,
      otherDeductionsCurrency: parseCurrency(inv.otherDeductionsCurrency || inv.currency),
      otherDeductionsAmount: parseNum(inv.otherDeductionsAmount) || 0,
      freightInsauranceIncluded: parseNum(inv.freightInsuranceIncluded),
      packingCharges: parseNum(inv.packingCharges) || 0,
      natureOfPayment: parseNum(inv.natureOfPayment),
      periodOfPayment: parseNum(inv.periodOfPayment),
      items: (inv.items || []).map((item, itemIdx) => ({
        itemSerialNumber: itemIdx + 1,
        schemeCode: item.schemeCode,
        ritcCode: item.ritcCode,
        goodsDescription: item.goodsDescription1,
        unitOfMeasurement: item.unitOfMeasurement,
        quantity: parseNum(item.quantity),
        unitPrice: parseNum(item.unitPrice),
        unitOfRate: item.unitOfRate || item.unitOfMeasurement,
        noOfUnits: parseNum(item.numberOfUnits) || 1,
        presentMarketValue: parseNum(item.presentMarketValue),
        thirdParty: Boolean(item.thirdPartyItem),
        rewardItem: Boolean(item.rewardItem),
        totalPackage: parseNum(item.totalPackage),
        endUseOfItem: item.endUseOfItem,
        igstPaymentStatus: parseNum(item.igstPaymentStatus),
        originDistrictCode: parseNum(item.originDistrictCode),
        tradeAgreementsCode: item.tradeAgreementsCode,
        drawbackSerialNumber: item.drawbackSerialNumber,
        drawbackQuantity: parseNum(item.drawbackQuantity)
      }))
    })),
    packgingList: (values.packingRanges || []).map((range) => ({
      packingNumberFrom: parseNum(range.packingNumberFrom),
      packingNumberTo: parseNum(range.packingNumberTo),
      packingCode: range.packingCode
    })),
    documents: (values.documents || []).map((doc, docIdx) => ({
      invoiceSerialNumber: parseNum(doc.invoiceSerialNumber) || 1,
      itemSerialNumber: parseNum(doc.itemSerialNumber) || 1,
      serialNumber: docIdx + 1,
      imageReferenceNumber: doc.imageReferenceNumber,
      documentTypeCode: doc.documentTypeCode,
      documentIssueDate: parseDate(doc.documentIssueDate),
      useDefault: true,
      fileType: parseNum(doc.fileType) || 1
    }))
  }
}

type ApiRecord = Record<string, unknown>

function isApiRecord(value: unknown): value is ApiRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asApiRecord(value: unknown): ApiRecord {
  return isApiRecord(value) ? value : {}
}

function asApiRecords(value: unknown): ApiRecord[] {
  return Array.isArray(value) ? value.filter(isApiRecord) : []
}

function textValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function stringOrEmpty(value: unknown): string {
  return textValue(value)
}

export function normalizeApiBill(raw: unknown): SavedBill {
  const record = asApiRecord(raw)
  if (Object.keys(record).length === 0) {
    return { id: 0, created: '', updated: '', values: emptyBill() }
  }

  function formatIsoString(value: unknown): string {
    if (value == null || value === '') return new Date().toISOString()
    if (typeof value === 'number') {
      const ms = value < 10000000000 ? value * 1000 : value
      const date = new Date(ms)
      return !Number.isNaN(date.getTime()) ? date.toISOString() : new Date().toISOString()
    }
    if (typeof value === 'string') {
      const date = new Date(value)
      return !Number.isNaN(date.getTime()) ? date.toISOString() : new Date().toISOString()
    }
    return new Date().toISOString()
  }

  const rawValues = record.values
  const rawId = numberValue(record.id)
  if (isApiRecord(rawValues) && rawId !== undefined) {
    return {
      id: rawId,
      created: formatIsoString(record.created),
      updated: formatIsoString(record.updated),
      values: rawValues as unknown as ShippingBillFormValues
    }
  }

  function formatEpochDays(value: unknown): string {
    if (typeof value === 'number') {
      const date = new Date(value * 86400000)
      if (!Number.isNaN(date.getTime())) return date.toISOString().split('T')[0]
    }
    return textValue(value)
  }

  const id =
    numberValue(record.id) ??
    numberValue(record.shippingBillId) ??
    numberValue(record.chaId) ??
    Math.floor(Math.random() * 100000)
  const jobDateStr = formatEpochDays(record.jobDate)
  const updated = formatIsoString(record.updatedAt ?? record.updated ?? record.createdAt)
  const created = formatIsoString(record.createdAt ?? record.created ?? updated)
  const rawInvoices = asApiRecords(record.invoices)

  const values: ShippingBillFormValues = {
    ...emptyBill(),
    jobNumber: textValue(record.jobNumber, `JOB-${id}`),
    jobDate: jobDateStr || new Date().toISOString().split('T')[0],
    exporterId: stringOrEmpty(record.exporterId),
    exporterBranchId: stringOrEmpty(record.exporterBranchId),
    exporterName: textValue(record.exporterName),
    consigneeId: stringOrEmpty(record.consigneeId),
    consigneeBranchId: stringOrEmpty(record.consigneeAddressId ?? record.consigneeBranchId),
    consigneeName: textValue(record.consigneeName),
    originStateCode: stringOrEmpty(record.originStateCode),
    loadingPort: textValue(record.loadingPort),
    finalDestinationPort: textValue(record.destinationPort ?? record.finalDestinationPort),
    dischargePort: textValue(record.dischargePort ?? record.destinationPort ?? record.finalDestinationPort),
    sealType: textValue(record.sealType, '3'),
    natureOfCargo: textValue(record.natureOfCargo, '1'),
    grossWeight: stringOrEmpty(record.grossWeight),
    netWeight: stringOrEmpty(record.netWeight),
    measurementUnit: textValue(record.measurementUnit, 'KGS'),
    totalPackages: stringOrEmpty(record.totalPackages),
    marksAndNumbers: textValue(record.marksAndNumbers),
    loosePackets: textValue(record.loosePackets, '0'),
    numberOfContainers: textValue(record.numberOfContainers, '0'),
    containers: Array.isArray(record.containers) ? record.containers : [],
    invoices:
      rawInvoices.length > 0
        ? rawInvoices.map((invoice, index) => {
            const rawItems = asApiRecords(invoice.items)
            return {
              invoiceNumber: textValue(invoice.invoiceNumber, `INV-${index + 1}`),
              invoiceDate:
                formatEpochDays(invoice.date ?? invoice.invoiceDate) || new Date().toISOString().split('T')[0],
              currency:
                typeof invoice.currency === 'number'
                  ? invoice.currency === 840
                    ? 'USD'
                    : invoice.currency === 356
                      ? 'INR'
                      : String(invoice.currency)
                  : textValue(invoice.currency, 'USD'),
              contractType: textValue(invoice.contractType, '1'),
              buyerId: stringOrEmpty(invoice.buyerId),
              buyerBranchId: stringOrEmpty(invoice.buyerAddressId ?? invoice.buyerBranchId),
              buyerSameAsConsignee:
                invoice.buyerId == null || textValue(invoice.buyerId) === textValue(record.consigneeId),
              freightAmount: stringOrEmpty(invoice.freightAmount),
              insuranceAmount: stringOrEmpty(invoice.insuranceAmount),
              items:
                rawItems.length > 0
                  ? rawItems.map((item) => ({
                      schemeCode: textValue(item.schemeCode),
                      ritcCode: textValue(item.ritcCode),
                      goodsDescription1: textValue(item.goodsDescription ?? item.goodsDescription1),
                      quantity: stringOrEmpty(item.quantity),
                      unitOfMeasurement: textValue(item.unitOfMeasurement, 'PCS'),
                      unitPrice: stringOrEmpty(item.unitPrice),
                      unitOfRate: textValue(item.unitOfRate ?? item.unitOfMeasurement, 'PCS'),
                      numberOfUnits: textValue(item.noOfUnits, '1'),
                      presentMarketValue: stringOrEmpty(item.presentMarketValue),
                      thirdPartyItem: Boolean(item.thirdParty),
                      rewardItem: Boolean(item.rewardItem),
                      totalPackage: stringOrEmpty(item.totalPackage),
                      endUseOfItem: textValue(item.endUseOfItem),
                      igstPaymentStatus: textValue(item.igstPaymentStatus, '2'),
                      originDistrictCode: stringOrEmpty(item.originDistrictCode),
                      tradeAgreementsCode: textValue(item.tradeAgreementsCode),
                      drawbackSerialNumber: textValue(item.drawbackSerialNumber),
                      drawbackQuantity: stringOrEmpty(item.drawbackQuantity)
                    }))
                  : []
            }
          })
        : [emptyInvoice()],
    packingRanges: (() => {
      const ranges = Array.isArray(record.packgingList) ? record.packgingList : record.packingRanges
      return asApiRecords(ranges).map((packing) => ({
        packingNumberFrom: stringOrEmpty(packing.packingNumberFrom),
        packingNumberTo: stringOrEmpty(packing.packingNumberTo),
        packingCode: textValue(packing.packingCode, 'CTN')
      }))
    })(),
    documents: asApiRecords(record.documents).map((document) => ({
      invoiceSerialNumber: textValue(document.invoiceSerialNumber, '1'),
      itemSerialNumber: textValue(document.itemSerialNumber, '1'),
      imageReferenceNumber: textValue(document.imageReferenceNumber),
      documentTypeCode: textValue(document.documentTypeCode),
      documentReferenceNumber: textValue(document.documentReferenceNumber),
      documentIssueDate: formatEpochDays(document.documentIssueDate) || new Date().toISOString().split('T')[0],
      fileType: textValue(document.fileType, '1')
    }))
  }

  return { id, created, updated, values }
}

export function normalizeApiBills(raw: unknown): SavedBill[] {
  if (Array.isArray(raw)) return raw.filter(isApiRecord).map(normalizeApiBill)
  const record = asApiRecord(raw)
  const list = record.data ?? record.bills ?? record.shippingBills ?? record.items
  return asApiRecords(list).map(normalizeApiBill)
}

export function generateFlatFileContent(bill: SavedBill): string {
  const v = bill.values
  const lines: string[] = []

  lines.push(`HREC**ZZ*${v.loadingPort || 'INMUN1'}*ZZ*ICEGATE*01*SB*1.0*`)
  lines.push(`<TABLE>SHIPPING_BILL`)
  lines.push(
    `<F>MESSAGE_TYPE^CHA_ID^JOB_NO^JOB_DATE^EXPORTER_ID^EXPORTER_BRANCH^CONSIGNEE_ID^LOADING_PORT^DEST_PORT^DISCHARGE_PORT^SEAL_TYPE^NATURE_OF_CARGO^GROSS_WEIGHT^NET_WEIGHT^UOM^PACKAGES^MARKS`
  )
  lines.push(
    `<R>F^1000^${v.jobNumber || bill.id}^${v.jobDate || ''}^${v.exporterId || ''}^${v.exporterBranchId || ''}^${v.consigneeId || ''}^${v.loadingPort || ''}^${v.finalDestinationPort || ''}^${v.dischargePort || v.finalDestinationPort || ''}^${v.sealType || ''}^${v.natureOfCargo || ''}^${v.grossWeight || ''}^${v.netWeight || ''}^${v.measurementUnit || 'KGS'}^${v.totalPackages || ''}^${(v.marksAndNumbers || '').replace(/[\^\r\n]+/g, ' ')}`
  )

  if (v.invoices && v.invoices.length > 0) {
    lines.push(`<TABLE>INVOICE`)
    lines.push(`<F>INVOICE_SN^INVOICE_NO^INVOICE_DATE^CURRENCY^CONTRACT_TYPE^BUYER_ID^FREIGHT_AMOUNT^INSURANCE_AMOUNT`)
    v.invoices.forEach((inv, idx) => {
      lines.push(
        `<R>${idx + 1}^${inv.invoiceNumber}^${inv.invoiceDate || ''}^${inv.currency || 'USD'}^${inv.contractType || '1'}^${inv.buyerId || v.consigneeId || ''}^${inv.freightAmount || 0}^${inv.insuranceAmount || 0}`
      )
    })

    lines.push(`<TABLE>ITEM`)
    lines.push(`<F>INVOICE_SN^ITEM_SN^RITC_CODE^DESCRIPTION^QUANTITY^UOM^UNIT_PRICE^LINE_TOTAL^SCHEME_CODE`)
    v.invoices.forEach((inv, invIdx) => {
      ;(inv.items || []).forEach((item, itemIdx) => {
        const total = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
        lines.push(
          `<R>${invIdx + 1}^${itemIdx + 1}^${item.ritcCode || ''}^${(item.goodsDescription1 || '').replace(/[\^\r\n]+/g, ' ')}^${item.quantity || ''}^${item.unitOfMeasurement || 'PCS'}^${item.unitPrice || ''}^${total.toFixed(2)}^${item.schemeCode || ''}`
        )
      })
    })
  }

  if (v.packingRanges && v.packingRanges.length > 0) {
    lines.push(`<TABLE>PACKING`)
    lines.push(`<F>FROM_PKG^TO_PKG^PKG_CODE`)
    v.packingRanges.forEach((pkg) => {
      lines.push(`<R>${pkg.packingNumberFrom}^${pkg.packingNumberTo}^${pkg.packingCode || 'CTN'}`)
    })
  }

  lines.push(`TREC**ZZ*${v.loadingPort || 'INMUN1'}*ZZ*ICEGATE*01*SB*1.0*`)

  return lines.join('\r\n')
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

export const API_SEED_SHIPPING_BILLS = [
  {
    id: 1000,
    jobNumber: 150011,
    jobDate: 20728,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'KRBUS',
    destinationPort: 'KRBUS',
    updated: 1790967817
  },
  {
    id: 1001,
    jobNumber: 150012,
    jobDate: 20728,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'KRBUS',
    destinationPort: 'KRBUS',
    updated: 1790968385
  },
  {
    id: 1002,
    jobNumber: 150013,
    jobDate: 20728,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'KRBUS',
    destinationPort: 'KRBUS',
    updated: 1790969061
  },
  {
    id: 1003,
    jobNumber: 150014,
    jobDate: 20728,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'KRBUS',
    destinationPort: 'KRBUS',
    updated: 1790969592
  },
  {
    id: 1004,
    jobNumber: 150015,
    jobDate: 20728,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'KRBUS',
    destinationPort: 'KRBUS',
    updated: 1791003787
  },
  {
    id: 1005,
    jobNumber: 150016,
    jobDate: 20728,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'KRBUS',
    destinationPort: 'KRBUS',
    updated: 1791010527
  },
  {
    id: 1006,
    jobNumber: 150017,
    jobDate: 20728,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'KRBUS',
    destinationPort: 'KRBUS',
    updated: 1791138507
  },
  {
    id: 1007,
    jobNumber: 150018,
    jobDate: 20728,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'KRBUS',
    destinationPort: 'KRBUS',
    updated: 1791139137
  },
  {
    id: 1008,
    jobNumber: 150019,
    jobDate: 20728,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'KRBUS',
    destinationPort: 'KRBUS',
    updated: 1791139150
  },
  {
    id: 1009,
    jobNumber: 150020,
    jobDate: 20728,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'KRBUS',
    destinationPort: 'KRBUS',
    updated: 1791139885
  },
  {
    id: 1010,
    jobNumber: 150021,
    jobDate: 20728,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'KRBUS',
    destinationPort: 'KRBUS',
    updated: 1791140799
  },
  {
    id: 1011,
    jobNumber: 150022,
    jobDate: 20728,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'KRBUS',
    destinationPort: 'KRBUS',
    updated: 1791140811
  },
  {
    id: 1012,
    jobNumber: 150023,
    jobDate: 20728,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'KRBUS',
    destinationPort: 'KRBUS',
    updated: 1791141353
  },
  {
    id: 1013,
    jobNumber: 150024,
    jobDate: 20728,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'KRBUS',
    destinationPort: 'KRBUS',
    updated: 1791141776
  },
  {
    id: 1014,
    jobNumber: 150025,
    jobDate: 20728,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'KRBUS',
    destinationPort: 'KRBUS',
    updated: 1791143087
  },
  {
    id: 1021,
    jobNumber: 150026,
    jobDate: 20714,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'INMUN1',
    destinationPort: 'USMSY',
    updated: 1791183194
  },
  {
    id: 1023,
    jobNumber: 150028,
    jobDate: 20714,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'INMUN1',
    destinationPort: 'USMSY',
    updated: 1791449123
  },
  {
    id: 1024,
    jobNumber: 150029,
    jobDate: 20714,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'INMUN1',
    destinationPort: 'USMSY',
    updated: 1791449142
  },
  {
    id: 1025,
    jobNumber: 150030,
    jobDate: 20714,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'INMUN1',
    destinationPort: 'USMSY',
    updated: 1791449171
  },
  {
    id: 1026,
    jobNumber: 150031,
    jobDate: 20714,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'INMUN1',
    destinationPort: 'USMSY',
    updated: 1791449252
  },
  {
    id: 1027,
    jobNumber: 150032,
    jobDate: 20714,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'INMUN1',
    destinationPort: 'USMSY',
    updated: 1791449308
  },
  {
    id: 1028,
    jobNumber: 150033,
    jobDate: 20714,
    exporterName: 'Amit Exports',
    consigneeName: 'H&M HENNES & MAURITZ LTD',
    loadingPort: 'INMUN1',
    dischargePort: 'INMUN1',
    destinationPort: 'USMSY',
    updated: 1791452556
  }
]

const internalBills: SavedBill[] = normalizeApiBills(API_SEED_SHIPPING_BILLS)

function allBills(): SavedBill[] {
  const local = getMockData().bills
  const localIds = new Set(local.map((bill) => bill.id))
  return [...local, ...internalBills.filter((bill) => !localIds.has(bill.id))]
}

function findBill(id: string | number): SavedBill | undefined {
  return allBills().find((bill) => String(bill.id) === String(id))
}

export const shippingBillService = {
  /** Equivalent of `GET /api/shipping-bills`. Empty array when there are no bills. */
  async listShippingBills(): Promise<SavedBill[]> {
    return mockRequest('bills', () => allBills(), 300)
  },

  /** Equivalent of `GET /api/shipping-bills/:id`. Rejects 404 when unknown. */
  async getShippingBill(id: string | number): Promise<SavedBill> {
    return mockRequest(
      'bills',
      () => {
        const bill = findBill(id)
        if (!bill) throw mockNotFound('Shipping bill', id)
        return bill
      },
      200
    )
  },

  /**
   * Equivalent of `POST /api/shipping-bills` (submit for filing).
   * The mock "server" re-checks the essentials and rejects with 422, then
   * persists through the mock database.
   */
  async submitShippingBill(values: ShippingBillFormValues, id?: number): Promise<SavedBill> {
    return mockRequest(
      'submit',
      () => {
        if (values.invoices.length === 0) {
          throw new MockApiError('A shipping bill needs at least one invoice', 422, 'VALIDATION')
        }
        const numbers = values.invoices.map((invoice) => invoice.invoiceNumber.trim().toLowerCase()).filter(Boolean)
        if (new Set(numbers).size !== numbers.length) {
          throw new MockApiError('Invoice numbers must be unique on a shipping bill', 422, 'VALIDATION')
        }
        return saveBill(values, id)
      },
      450
    )
  },

  /** Equivalent of `PUT /api/shipping-bills/:id/draft` — incomplete bills are allowed. */
  async saveDraft(values: ShippingBillFormValues, id?: number): Promise<SavedBill> {
    return mockRequest('bills', () => saveBill(values, id), 200)
  },

  /** Equivalent of `GET /api/shipping-bills/:id/flat-file` (ICEGATE .sb text). */
  async getFlatFile(id: string | number): Promise<string> {
    return mockRequest(
      'bills',
      () => {
        const bill = findBill(id)
        if (!bill) throw mockNotFound('Shipping bill', id)
        return generateFlatFileContent(bill)
      },
      200
    )
  },

  /** Downloads the .sb flat file in the browser, generated from mock data. */
  async downloadFlatFile(id: string | number, billData?: SavedBill): Promise<{ source: 'local' }> {
    return mockRequest(
      'bills',
      () => {
        const bill = billData ?? findBill(id)
        if (!bill) throw mockNotFound('Shipping bill', id)
        const blob = new Blob([generateFlatFileContent(bill)], { type: 'text/plain;charset=utf-8' })
        triggerBlobDownload(blob, `shipping_bill_${bill.values.jobNumber ? bill.values.jobNumber : bill.id}.sb`)
        return { source: 'local' as const }
      },
      200
    )
  }
}
