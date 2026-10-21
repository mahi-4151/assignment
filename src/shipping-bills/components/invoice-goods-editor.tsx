import { useFieldArray } from 'core/form'
import { Button } from 'ui/basic/button'
import { Checkbox } from 'ui/inputs/checkbox'
import { Input } from 'ui/inputs/input'
import { Select } from 'ui/inputs/select'
import { dateType } from '../form-options'
import type { BillFormContext, InvoiceAddBranchHandler, InvoiceQuickAddHandler } from '../form-types'
import type { BillInvoiceForm, Business, ShippingBillFormValues } from '../model'
import { emptyItem, invoiceTotal, lineTotal } from '../model'
import { useFormOptions } from '../use-form-options'
import { Advanced, PartyFields, SectionHeading } from './form-controls'

interface InvoiceGoodsEditorProps {
  formCtx: BillFormContext
  index: number
  invoice: BillInvoiceForm
  businesses: Business[]
  onQuickAdd: InvoiceQuickAddHandler
  onAddBranch: InvoiceAddBranchHandler
}

export function InvoiceGoodsEditor({
  formCtx,
  index,
  invoice,
  businesses,
  onQuickAdd,
  onAddBranch
}: InvoiceGoodsEditorProps) {
  const { control, register } = formCtx.hooks
  const { options } = useFormOptions()
  const schemeCodes = options?.schemeCodes ?? []
  const {
    fields: items,
    append: addItem,
    remove: removeItem
  } = useFieldArray({
    control,
    name: `invoices.${index}.items`
  })

  return (
    <>
      <div className="border-t border-gray-200 pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionHeading title="Goods" />
          <Button type="button" size="sm" variant="outline" onClick={() => addItem(emptyItem())}>
            + Add item
          </Button>
        </div>
        <div className="space-y-4">
          {items.map((field, itemIndex) => {
            const item = invoice.items[itemIndex] ?? emptyItem()
            return (
              <div key={field.id} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Item {itemIndex + 1}</h4>
                  {items.length > 1 && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(itemIndex)}>
                      Remove
                    </Button>
                  )}
                </div>
                <div className="mb-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                  <Input
                    label="RITC / HS code"
                    {...register(`invoices.${index}.items.${itemIndex}.ritcCode`)}
                    placeholder="e.g. 61091000"
                  />
                  <Select<ShippingBillFormValues>
                    label="Scheme code"
                    name={`invoices.${index}.items.${itemIndex}.schemeCode`}
                    options={schemeCodes}
                    placeholder="Select scheme"
                    rules={{ required: true }}
                  />
                  <Input
                    label="Goods description"
                    {...register(`invoices.${index}.items.${itemIndex}.goodsDescription1`)}
                    wrapClass="lg:col-span-4"
                    placeholder="e.g. Cotton T-shirts"
                  />
                  <Input
                    label="Quantity"
                    type="number"
                    {...register(`invoices.${index}.items.${itemIndex}.quantity`)}
                  />
                  <Select<ShippingBillFormValues>
                    label="Unit"
                    name={`invoices.${index}.items.${itemIndex}.unitOfMeasurement`}
                    options={options?.quantityCodes ?? []}
                    rules={{ required: true }}
                  />
                  <Input
                    label={`Unit price (${invoice.currency || 'currency'})`}
                    type="number"
                    {...register(`invoices.${index}.items.${itemIndex}.unitPrice`)}
                  />
                  <Input
                    label="Item Total"
                    type="number"
                    placeholder={`${invoice.currency} ${lineTotal(item).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}

                    {...register(`invoices.${index}.items.${itemIndex}.lineTotal`)}
                  />
                  <Select<ShippingBillFormValues>
                    label="IGST payment"
                    name={`invoices.${index}.items.${itemIndex}.igstPaymentStatus`}
                    options={options?.igstStatuses ?? []}
                    placeholder="Select if applicable"
                  />
                </div>
                {/* Row 3: drawback inputs (conditional) + checkboxes */}
                <div className="mb-3 flex flex-wrap items-end gap-4">
                  {(() => {
                    const selectedScheme = schemeCodes.find((s) => s.value === item.schemeCode)
                    const showDrawback = Boolean(
                      selectedScheme && (selectedScheme.drawback || selectedScheme.RODTEP || selectedScheme.ROSCTL)
                    )
                    return showDrawback ? (
                      <>
                        <div className="w-36">
                          <Input
                            label="Drawback Serial no."
                            {...register(`invoices.${index}.items.${itemIndex}.drawbackSerialNumber`)}
                          />
                        </div>
                        <div className="w-32">
                          <Input
                            label="Drawback Unit"
                            {...register(`invoices.${index}.items.${itemIndex}.drawbackUnit`)}
                          />
                        </div>
                        <div className="w-36">
                          <Input
                            label="Drawback Quantity"
                            type="number"
                            {...register(`invoices.${index}.items.${itemIndex}.drawbackQuantity`)}
                          />
                        </div>
                      </>
                    ) : null
                  })()}
                  <label className="flex items-center gap-2 pb-1 text-sm">
                    <Checkbox {...register(`invoices.${index}.items.${itemIndex}.rewardItem`)} />
                    Claim reward
                  </label>
                  <label className="flex items-center gap-2 pb-1 text-sm">
                    <Checkbox {...register(`invoices.${index}.items.${itemIndex}.thirdPartyItem`)} />
                    Third-party item
                  </label>
                </div>
                {item.thirdPartyItem && (
                  <div className="my-4">
                    <PartyFields
                      formCtx={formCtx}
                      ownerName={`invoices.${index}.items.${itemIndex}.itemThirdPartyId`}
                      branchName={`invoices.${index}.items.${itemIndex}.itemThirdPartyBranchId`}
                      label="Item third party"
                      kind="business"
                      parties={businesses.filter(
                        (business) => business.isThirdParty || business.id === Number(item.itemThirdPartyId)
                      )}
                      onQuickAdd={() => onQuickAdd('itemThirdParty', index, itemIndex)}
                      onAddBranch={(ownerId) =>
                        onAddBranch(ownerId, `invoices.${index}.items.${itemIndex}.itemThirdPartyBranchId`)
                      }
                    />
                  </div>
                )}
                <Advanced title="Item customs, taxes and incentives">
                  <div className="mb-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Select<ShippingBillFormValues>
                      label="Unit of rate"
                      {...register(`invoices.${index}.items.${itemIndex}.unitOfRate`)}
                      options={options?.quantityCodes ?? []}
                      placeholder={invoice.items[index].unitOfMeasurement}
                    />
                    <Input
                      label="Per Unit (Rate)"
                      type="number"
                      placeholder="1"
                      {...register(`invoices.${index}.items.${itemIndex}.numberOfUnits`)}
                    />
                    <Input
                      label="Present market value"
                      type="number"
                      {...register(`invoices.${index}.items.${itemIndex}.presentMarketValue`)}
                    />
                    <Input label="GCess" type="number" {...register(`invoices.${index}.items.${itemIndex}.cess`)} />
                    <Input
                      label="Accessories description"
                      wrapClass="lg:col-span-3"
                      {...register(`invoices.${index}.items.${itemIndex}.accessoriesDescription`)}
                    />
                    <Select<ShippingBillFormValues>
                      label="Accessory status"
                      name={`invoices.${index}.items.${itemIndex}.accessoryStatus`}
                      options={options?.accessoryStatuses ?? []}
                      placeholder="Select if relevant"
                    />
                    {item.igstPaymentStatus === 'P' && (
                      <>
                        <Input
                          label="Taxable value"
                          type="number"
                          {...register(`invoices.${index}.items.${itemIndex}.taxableValue`)}
                        />
                        <Input
                          label="IGST amount"
                          type="number"
                          {...register(`invoices.${index}.items.${itemIndex}.igstAmount`)}
                        />
                      </>
                    )}

                    <Input
                      label="Origin district code"
                      {...register(`invoices.${index}.items.${itemIndex}.originDistrictCode`)}
                    />
                    <Select<ShippingBillFormValues>
                      label="Trade agreement code"
                      name={`invoices.${index}.items.${itemIndex}.tradeAgreementsCode`}
                      options={options?.tradeAgreements ?? []}
                      placeholder="NCPTI"
                    />
                    <Input label="End use code" {...register(`invoices.${index}.items.${itemIndex}.endUseOfItem`)} />
                    <Input
                      label="Packages for item"
                      type="number"
                      {...register(`invoices.${index}.items.${itemIndex}.totalPackage`)}
                    />
                  </div>
                  <Advanced title="AR4 / excise details">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <Input label="AR4 number" {...register(`invoices.${index}.items.${itemIndex}.ar4Number`)} />
                      <Input
                        label="AR4 date"
                        type={dateType}
                        {...register(`invoices.${index}.items.${itemIndex}.ar4Date`)}
                      />
                    </div>
                  </Advanced>
                </Advanced>
              </div>
            )
          })}
        </div>
      </div>

      <div className="text-right text-sm font-semibold">
        Invoice total: {invoice.currency}{' '}
        {invoiceTotal(invoice).toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
    </>
  )
}
