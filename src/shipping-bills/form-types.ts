import { useForm } from 'core/form'
import type { ShippingBillFormValues } from './model'

export type BillFormContext = ReturnType<typeof useForm<ShippingBillFormValues>>

export type PartyOwnerPath =
  | 'exporterId'
  | 'consigneeId'
  | `invoices.${number}.buyerId`
  | `invoices.${number}.thirdPartyId`
  | `invoices.${number}.items.${number}.itemThirdPartyId`

export type BranchPath =
  | 'exporterBranchId'
  | 'consigneeBranchId'
  | `invoices.${number}.buyerBranchId`
  | `invoices.${number}.thirdPartyBranchId`
  | `invoices.${number}.items.${number}.itemThirdPartyBranchId`

export interface QuickAdd {
  kind: 'exporter' | 'business'
  role?: 'consignee' | 'buyer' | 'thirdParty' | 'itemThirdParty'
  invoiceIndex?: number
  itemIndex?: number
}

export interface QuickBranch {
  kind: 'exporter' | 'business'
  ownerId: number
  branchName: BranchPath
}

export type InvoiceQuickAddRole = 'buyer' | 'thirdParty' | 'itemThirdParty'

export type InvoiceQuickAddHandler = (role: InvoiceQuickAddRole, invoiceIndex: number, itemIndex?: number) => void

export type InvoiceAddBranchHandler = (ownerId: number, branchName: BranchPath) => void
