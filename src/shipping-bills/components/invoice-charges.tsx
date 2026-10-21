import { Input } from 'ui/inputs/input'
import { Select } from 'ui/inputs/select'
import type { BillFormContext, InvoiceAddBranchHandler, InvoiceQuickAddHandler } from '../form-types'
import type { BillInvoiceForm, Business, ShippingBillFormValues } from '../model'
import { useFormOptions } from '../use-form-options'
import { PartyFields } from './form-controls'

interface InvoiceChargesProps {
  formCtx: BillFormContext
  index: number
  invoice: BillInvoiceForm
  businesses: Business[]
  onQuickAdd: InvoiceQuickAddHandler
  onAddBranch: InvoiceAddBranchHandler
}

export function InvoiceCharges({ formCtx, index, invoice, businesses, onQuickAdd, onAddBranch }: InvoiceChargesProps) {
  const { register, watch } = formCtx.hooks
  const { options } = useFormOptions()
  const invoiceValues = watch(`invoices.${index}`)
  const thirdPartyOptions = businesses.filter(
    (business) => business.isThirdParty || business.id === Number(invoice.thirdPartyId)
  )

  return (
    <div className="space-y-4">
      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 divide-y divide-gray-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div className="p-2">
            <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
              <span className="w-28 shrink-0 font-medium text-gray-900">Freight</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  {...register(`invoices.${index}.freightRate`)}
                  className="text-right"
                  disabled={invoiceValues.freightAmount !== '' && invoiceValues.freightAmount != null}
                  placeholder="Rate"
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
              <Input
                type="number"
                {...register(`invoices.${index}.freightAmount`)}
                className="py-1 text-right"
                disabled={invoiceValues.freightRate !== '' && invoiceValues.freightRate != null}
                placeholder="Amount"
              />
              <Select<ShippingBillFormValues>
                name={`invoices.${index}.freightCurrency`}
                options={options?.currencies ?? []}
                placeholder={invoice.currency}
              />
            </div>
          </div>
          <div className="p-2">
            <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
              <span className="w-28 shrink-0 font-medium text-gray-900">Insurance</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  {...register(`invoices.${index}.insuranceRate`)}
                  className="text-right"
                  disabled={invoiceValues.insuranceAmount !== '' && invoiceValues.insuranceAmount != null}
                  placeholder="Rate"
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
              <Input
                type="number"
                {...register(`invoices.${index}.insuranceAmount`)}
                className="py-1 text-right"
                disabled={invoiceValues.insuranceRate !== '' && invoiceValues.insuranceRate != null}
                placeholder="Amount"
              />
              <Select<ShippingBillFormValues>
                name={`invoices.${index}.insuranceCurrency`}
                options={options?.currencies ?? []}
                placeholder={invoice.currency}
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 divide-y divide-gray-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div className="p-2">
            <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
              <span className="w-28 shrink-0 font-medium text-gray-900">Commission</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  {...register(`invoices.${index}.commissionRate`)}
                  className="text-right"
                  disabled={invoiceValues.commissionAmount !== '' && invoiceValues.commissionAmount != null}
                  placeholder="Rate"
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
              <Input
                type="number"
                {...register(`invoices.${index}.commissionAmount`)}
                className="py-1 text-right"
                disabled={invoiceValues.commissionRate !== '' && invoiceValues.commissionRate != null}
                placeholder="Amount"
              />
              <Select<ShippingBillFormValues>
                name={`invoices.${index}.commissionCurrency`}
                options={options?.currencies ?? []}
                placeholder={invoice.currency}
              />
            </div>
          </div>
          <div className="p-2">
            <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
              <span className="w-28 shrink-0 font-medium text-gray-900">Discount</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  {...register(`invoices.${index}.discountRate`)}
                  className="text-right"
                  disabled={invoiceValues.discountAmount !== '' && invoiceValues.discountAmount != null}
                  placeholder="Rate"
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
              <Input
                type="number"
                {...register(`invoices.${index}.discountAmount`)}
                className="py-1 text-right"
                disabled={invoiceValues.discountRate !== '' && invoiceValues.discountRate != null}
                placeholder="Amount"
              />
              <Select<ShippingBillFormValues>
                name={`invoices.${index}.discountCurrency`}
                options={options?.currencies ?? []}
                placeholder={invoice.currency}
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 divide-y divide-gray-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div className="p-2">
            <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
              <span className="w-28 shrink-0 font-medium text-gray-900">Other Deductions</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  {...register(`invoices.${index}.otherDeductionsRate`)}
                  className="text-right"
                  disabled={invoiceValues.otherDeductionsAmount !== '' && invoiceValues.otherDeductionsAmount != null}
                  placeholder="Rate"
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
              <Input
                type="number"
                {...register(`invoices.${index}.otherDeductionsAmount`)}
                className="py-1 text-right"
                disabled={invoiceValues.otherDeductionsRate !== '' && invoiceValues.otherDeductionsRate != null}
                placeholder="Amount"
              />
              <Select<ShippingBillFormValues>
                name={`invoices.${index}.otherDeductionsCurrency`}
                options={options?.currencies ?? []}
                placeholder={invoice.currency}
              />
            </div>
          </div>
          <div className="p-2">
            <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
              <span className="w-28 shrink-0 font-medium text-gray-900">Packing Charges</span>
              <Input
                type="number"
                {...register(`invoices.${index}.packingCharges`)}
                className="py-1 text-right"
                placeholder="Amount"
              />
              <span className="w-14 text-sm text-gray-500">—</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Select<ShippingBillFormValues>
          label="Price includes"
          name={`invoices.${index}.freightInsuranceIncluded`}
          options={options?.priceInclusionTypes ?? []}
          placeholder="Select if applicable"
        />
        <Input label="Contract / order number" {...register(`invoices.${index}.contractNumber`)} />
        <Select<ShippingBillFormValues>
          label="Payment type"
          name={`invoices.${index}.natureOfPayment`}
          options={options?.paymentTypes ?? []}
          placeholder="Select if applicable"
        />
        <Input label="Payment period (days)" type="number" {...register(`invoices.${index}.periodOfPayment`)} />
      </div>
      <PartyFields
        formCtx={formCtx}
        ownerName={`invoices.${index}.thirdPartyId`}
        branchName={`invoices.${index}.thirdPartyBranchId`}
        label="Third party (optional)"
        kind="business"
        parties={thirdPartyOptions}
        required={false}
        onQuickAdd={() => onQuickAdd('thirdParty', index)}
        onAddBranch={(ownerId) => onAddBranch(ownerId, `invoices.${index}.thirdPartyBranchId`)}
      />
    </div>
  )
}
