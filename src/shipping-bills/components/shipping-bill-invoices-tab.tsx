import { useFieldArray } from 'core/form'
import { Button } from 'ui/basic/button'
import type { BillFormContext, QuickAdd, QuickBranch } from '../form-types'
import type { Business } from '../model'
import { emptyInvoice } from '../model'
import { PersistentTab } from './form-controls'
import { InvoiceEditor } from './invoice-editor'

interface ShippingBillInvoicesTabProps {
  formCtx: BillFormContext
  activeTab: string
  businesses: Business[]
  onQuickAdd: (request: QuickAdd) => void
  onAddBranch: (request: QuickBranch) => void
}

export function ShippingBillInvoicesTab({
  formCtx,
  activeTab,
  businesses,
  onQuickAdd,
  onAddBranch
}: ShippingBillInvoicesTabProps) {
  const { control, watch } = formCtx.hooks
  const { fields: invoices, append: addInvoice, remove: removeInvoice } = useFieldArray({ control, name: 'invoices' })
  const values = watch()

  return (
    <PersistentTab value="invoices" activeTab={activeTab} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Invoices & goods</h2>
          <p className="text-sm text-gray-500">One invoice and one item are ready to fill in.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => addInvoice(emptyInvoice())}>
          + Add invoice
        </Button>
      </div>
      {invoices.map((field, index) => (
        <InvoiceEditor
          key={field.id}
          formCtx={formCtx}
          index={index}
          invoice={values.invoices[index] ?? emptyInvoice()}
          businesses={businesses}
          onQuickAdd={(role, invoiceIndex, itemIndex) =>
            onQuickAdd({ kind: 'business', role, invoiceIndex, itemIndex })
          }
          onAddBranch={(ownerId, branchName) => onAddBranch({ kind: 'business', ownerId, branchName })}
          onRemove={() => removeInvoice(index)}
          canRemove={invoices.length > 1}
        />
      ))}
    </PersistentTab>
  )
}
