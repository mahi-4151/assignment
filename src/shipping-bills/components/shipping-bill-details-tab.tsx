import { stateOptions } from '@/data/states'
import { cargoOptions, sealTypes, weightUnits } from '@/data/types'
import { Card, CardContent, CardHeader } from 'ui/basic/card'
import { Input } from 'ui/inputs/input'
import { Select } from 'ui/inputs/select'
import { dateType, portOptions } from '../form-options'
import type { BillFormContext, QuickAdd, QuickBranch } from '../form-types'
import type { MarksAndNumbersOption } from '../marks-and-numbers-source'
import type { Business, Exporter, ShippingBillFormValues } from '../model'
import { portCountry } from '../model'
import { partyMockService } from '../party-mock-service'
import { Advanced, AsyncPartySelect, PartyFields, PersistentTab, SectionHeading } from './form-controls'

interface ShippingBillDetailsTabProps {
  formCtx: BillFormContext
  activeTab: string
  exporters: Exporter[]
  businesses: Business[]
  marksAndNumbersOptions: MarksAndNumbersOption[]
  marksAndNumbersLoading: boolean
  onQuickAdd: (request: QuickAdd) => void
  onAddBranch: (request: QuickBranch) => void
}

export function ShippingBillDetailsTab({
  formCtx,
  activeTab,
  exporters,
  businesses,
  marksAndNumbersOptions,
  marksAndNumbersLoading,
  onQuickAdd,
  onAddBranch
}: ShippingBillDetailsTabProps) {
  const { register, watch } = formCtx.hooks
  const values = watch()
  const consigneeOptions = businesses.filter(
    (business) => business.isConsignee || String(business.id) === values.consigneeId
  )

  return (
    <PersistentTab value="details" activeTab={activeTab} className="space-y-4">
      <Card>
        <CardHeader title="Shipment basics" description="Parties and route are the core details for this bill." />
        <CardContent className="space-y-5">
          <PartyFields
            formCtx={formCtx}
            ownerName="exporterId"
            branchName="exporterBranchId"
            label="Exporter"
            kind="exporter"
            parties={exporters.filter((item) => !item.disabled || String(item.id) === values.exporterId)}
            onQuickAdd={() => onQuickAdd({ kind: 'exporter' })}
            onAddBranch={(ownerId) => onAddBranch({ kind: 'exporter', ownerId, branchName: 'exporterBranchId' })}
          />
          <PartyFields
            formCtx={formCtx}
            ownerName="consigneeId"
            branchName="consigneeBranchId"
            label="Consignee"
            kind="business"
            parties={consigneeOptions}
            onQuickAdd={() => onQuickAdd({ kind: 'business', role: 'consignee' })}
            onAddBranch={(ownerId) => onAddBranch({ kind: 'business', ownerId, branchName: 'consigneeBranchId' })}
          />

          <div className="border-t border-gray-200 pt-5">
            <SectionHeading title="Route" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-sm font-medium">Port of loading</span>
                <AsyncPartySelect
                  name="loadingPort"
                  placeholder="Select Indian port"
                  rules={{ required: true }}
                  fetchOptions={async (query) => {
                    const res = await partyMockService.searchLoadingPorts(query)
                    return res.map((port) => ({
                      value: port.code,
                      label: `${port.name} · ${port.code}`,
                      sublabel: `Country: ${port.countryCode}`
                    }))
                  }}
                  getInitialLabel={async (code) => {
                    const port = await partyMockService.getPortByCode(code)
                    return port ? `${port.name} · ${port.code}` : code
                  }}
                />
              </div>
              <div>
                <span className="mb-1 block text-sm font-medium">Final destination port</span>
                <AsyncPartySelect
                  name="finalDestinationPort"
                  placeholder="Select destination"
                  rules={{ required: true }}
                  fetchOptions={async (query) => {
                    const res = await partyMockService.searchDestinationPorts(query)
                    return res.map((port) => ({
                      value: port.code,
                      label: `${port.name} · ${port.code}`,
                      sublabel: `Country: ${port.countryCode}`
                    }))
                  }}
                  getInitialLabel={async (code) => {
                    const port = await partyMockService.getPortByCode(code)
                    return port ? `${port.name} · ${port.code}` : code
                  }}
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Countries are derived from the port codes when saved: {portCountry(values.loadingPort) || '—'} →{' '}
              {portCountry(values.finalDestinationPort) || '—'}.
            </p>
          </div>
          <Advanced title="Regulatory and route exceptions">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Select<ShippingBillFormValues>
                label="Discharge port"
                name="dischargePort"
                options={portOptions}
                placeholder="Defaults to destination"
              />
              <Select<ShippingBillFormValues>
                label="Origin state"
                name="originStateCode"
                options={stateOptions}
                placeholder="Defaults to Branch State Code"
              />
              <div></div>
              <Select<ShippingBillFormValues>
                label="NFEI category"
                name="nfeiCategory"
                options={[
                  ['01', 'Free trade sample'],
                  ['02', 'Diplomatic goods'],
                  ['03', 'Warranty replacement'],
                  ['07', 'Gift parcel'],
                  ['08', 'Other']
                ].map(([value, label]) => ({ value, label }))}
                placeholder="Not applicable"
              />
              <Input label="RBI waiver number" {...register('rbiWaiverNumber')} />
              <Input label="RBI waiver date" type={dateType} {...register('rbiWaiverDate')} />
            </div>
          </Advanced>

          <div className="border-t border-gray-200 pt-5">
            <SectionHeading title="Package Detail" />
            <div className="grid gap-4 pb-4 sm:grid-cols-2 lg:grid-cols-4">
              <Select<ShippingBillFormValues> label="Nature of cargo" name="natureOfCargo" options={cargoOptions} />
              <Input label="Gross weight" type="number" {...register('grossWeight')} />
              <Input label="Net weight" type="number" {...register('netWeight')} />
              <Select<ShippingBillFormValues> label="Weight unit" name="measurementUnit" options={weightUnits} />
              <Input label="Total packages" type="number" {...register('totalPackages')} />
              <Select<ShippingBillFormValues>
                label="Marks and numbers"
                name="marksAndNumbers"
                options={marksAndNumbersOptions}
                placeholder={
                  !values.exporterId
                    ? 'Select exporter first'
                    : marksAndNumbersLoading
                      ? 'Loading marks and numbers...'
                      : 'Select marks and numbers'
                }
                disabled={!values.exporterId || marksAndNumbersLoading || !marksAndNumbersOptions.length}
                wrapClass="sm:col-span-3"
              />
            </div>
            <Advanced title="Additional Details">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Select<ShippingBillFormValues>
                  label="Seal type"
                  name="sealType"
                  options={sealTypes}
                  placeholder="Select if relevant"
                />
                {values.containers.length === 0 && (
                  <Input label="Number of containers" type="number" {...register('numberOfContainers')} />
                )}
                <Input label="Loose packets" type="number" {...register('loosePackets')} />
                <Input label="MAWB number" {...register('mawbNumber')} />
                <Input label="HAWB number" {...register('hawbNumber')} />
              </div>
            </Advanced>
          </div>
        </CardContent>
      </Card>
    </PersistentTab>
  )
}
