import { contractTypes } from '@/data/types'
import { Button } from 'ui/basic/button'
import { Card, CardContent, CardHeader } from 'ui/basic/card'
import { Checkbox } from 'ui/inputs/checkbox'
import { Input } from 'ui/inputs/input'
import { Select } from 'ui/inputs/select'
import { currencyOptions, dateType } from '../form-options'
import type { BillFormContext, InvoiceAddBranchHandler, InvoiceQuickAddHandler } from '../form-types'
import type { BillInvoiceForm, Business, ShippingBillFormValues } from '../model'
import { PartyFields } from './form-controls'
import { InvoiceCharges } from './invoice-charges'
import { InvoiceGoodsEditor } from './invoice-goods-editor'

interface InvoiceEditorProps {
  formCtx: BillFormContext
  index: number
  invoice: BillInvoiceForm
  businesses: Business[]
  onQuickAdd: InvoiceQuickAddHandler
  onAddBranch: InvoiceAddBranchHandler
  onRemove: () => void
  canRemove: boolean
}

export function InvoiceEditor({
  formCtx,
  index,
  invoice,
  businesses,
  onQuickAdd,
  onAddBranch,
  onRemove,
  canRemove
}: InvoiceEditorProps) {
  const { register } = formCtx.hooks
  const buyerSame = formCtx.hooks.watch(`invoices.${index}.buyerSameAsConsignee`)
  const buyerOptions = businesses.filter((business) => business.isBuyer || business.id === Number(invoice.buyerId))

  return (
    <Card className="mb-4">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Invoice {index + 1}</h3>
        </div>
        {canRemove && (
          <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
            Remove invoice
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Invoice number" {...register(`invoices.${index}.invoiceNumber`)} />
          <Input label="Invoice date" type={dateType} {...register(`invoices.${index}.invoiceDate`)} />
          <div className="flex gap-2">
            <div className="w-[100px] shrink-0">
              <Select<ShippingBillFormValues>
                label="Currency"
                name={`invoices.${index}.currency`}
                options={currencyOptions}
                rules={{ required: true }}
              />
            </div>
            <div className="flex-1">
              <Input
                label="Total"
                type="number"
                min={0}
                {...register(`invoices.${index}.invoiceTotal`)}
                placeholder="0.00"
              />
            </div>
          </div>
          <Select<ShippingBillFormValues>
            label="Contract"
            name={`invoices.${index}.contractType`}
            options={contractTypes}
            rules={{ required: true }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox {...register(`invoices.${index}.buyerSameAsConsignee`)} />
          Buyer & consignee are same
        </label>
        {!buyerSame && (
          <PartyFields
            formCtx={formCtx}
            ownerName={`invoices.${index}.buyerId`}
            branchName={`invoices.${index}.buyerBranchId`}
            label="Buyer"
            kind="business"
            parties={buyerOptions}
            onQuickAdd={() => onQuickAdd('buyer', index)}
            onAddBranch={(ownerId) => onAddBranch(ownerId, `invoices.${index}.buyerBranchId`)}
          />
        )}
        <InvoiceCharges
          formCtx={formCtx}
          index={index}
          invoice={invoice}
          businesses={businesses}
          onQuickAdd={onQuickAdd}
          onAddBranch={onAddBranch}
        />
        <InvoiceGoodsEditor
          formCtx={formCtx}
          index={index}
          invoice={invoice}
          businesses={businesses}
          onQuickAdd={onQuickAdd}
          onAddBranch={onAddBranch}
        />
      </CardContent>
    </Card>
  )
}
