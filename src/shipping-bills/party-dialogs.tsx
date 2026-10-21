import type { Branch, Business, Exporter } from '@/shipping-bills/model'
import { InferType, s, useForm } from 'core/form'
import { Form, SubmitButton } from 'core/form/components'
import { toast } from 'core/toast-manager'
import { Button } from 'ui/basic/button'
import { Checkbox } from 'ui/inputs/checkbox'
import { Input } from 'ui/inputs/input'
import { Select } from 'ui/inputs/select'
import { Textarea } from 'ui/inputs/text-area'
import { Dialog, DialogContent } from 'ui/interactive/dialog'
import { partyService } from './services/party-service'
import { useFormOptions } from './use-form-options'
import {
  isValidAdCode,
  isValidEmail,
  isValidGstin,
  isValidIec,
  isValidIfsc,
  isValidIndianPin,
  isValidMobile,
  isValidPan,
  isValidTan
} from './validation'

type Kind = 'exporter' | 'business'

function blankText(value: unknown) {
  return typeof value !== 'string' || value.trim() === ''
}

// Indian addresses on customs filings need a state and a 6-digit PIN code;
// foreign addresses only need a plausible postal code when one is entered.
const indianState = s
  .string()
  .optional()
  .refine((value, formData) =>
    formData?.countryCode !== 'IN' || !blankText(value) ? undefined : 'State is required for Indian addresses'
  )

const indianPincode = s
  .string()
  .optional()
  .refine((value, formData) => {
    if (formData?.countryCode === 'IN') {
      if (blankText(value)) return 'PIN code is required for Indian addresses'
      return isValidIndianPin(value) ? undefined : 'Enter a 6-digit PIN code'
    }
    return blankText(value) || /^[A-Za-z0-9 -]{3,10}$/.test(value.trim()) ? undefined : 'Invalid postal code'
  })

const partyShape = {
  name: s.string().minVal(2),
  class: s.string().optional(),
  type: s.string().optional(),
  pan: s
    .string()
    .optional()
    .refine((value) => (blankText(value) || isValidPan(value) ? undefined : 'PAN must look like ABCDE1234F')),
  tan: s
    .string()
    .optional()
    .refine((value) => (blankText(value) || isValidTan(value) ? undefined : 'TAN must look like ABCD12345E')),
  aeoNumber: s
    .string()
    .optional()
    .refine((value) =>
      blankText(value) || /^[A-Za-z0-9]{10,20}$/.test(value.trim()) ? undefined : 'Invalid AEO number'
    ),
  website: s
    .string()
    .optional()
    .refine((value) =>
      blankText(value) || /^[^\s]+\.[^\s]+$/.test(value.trim()) ? undefined : 'Enter a valid website'
    ),
  notes: s.string().optional(),
  isConsignee: s.boolean().optional(),
  isBuyer: s.boolean().optional(),
  isNotify: s.boolean().optional(),
  isThirdParty: s.boolean().optional(),
  branchName: s.string().optional(),
  address1: s.string().optional(),
  city: s.string().optional(),
  state: indianState,
  pincode: indianPincode,
  countryCode: s.string()
}

// An exporter cannot file a Shipping Bill without an IEC; for a business
// (consignee/buyer) the IEC is optional but must be well-formed if given.
const exporterPartySchema = s.object({
  ...partyShape,
  iec: s
    .string()
    .refine((value) =>
      blankText(value) || isValidIec(value) ? undefined : 'IEC must be 10 characters (e.g. AAECA1234F)'
    )
})

const businessPartySchema = s.object({
  ...partyShape,
  iec: s
    .string()
    .optional()
    .refine((value) =>
      blankText(value) || isValidIec(value) ? undefined : 'IEC must be 10 characters (e.g. AAECA1234F)'
    )
})

type PartyFields = InferType<typeof exporterPartySchema>

interface PartyDialogProps {
  kind: Kind
  party?: Exporter | Business
  initialRole?: 'consignee' | 'buyer' | 'thirdParty'
  onClose: () => void
  onSaved?: (party: Exporter | Business) => void
}

export function PartyDialog({ kind, party, initialRole, onClose, onSaved }: PartyDialogProps) {
  const isNew = party == null
  const formCtx = useForm<PartyFields>(kind === 'exporter' ? exporterPartySchema : businessPartySchema, {
    defaultValues: {
      name: party?.name ?? '',
      iec: party?.iec ?? '',
      class: kind === 'exporter' ? ((party as Exporter | undefined)?.class ?? 'F') : undefined,
      type: kind === 'exporter' ? ((party as Exporter | undefined)?.type ?? 'P') : undefined,
      pan: kind === 'exporter' ? ((party as Exporter | undefined)?.pan ?? '') : undefined,
      tan: kind === 'exporter' ? ((party as Exporter | undefined)?.tan ?? '') : undefined,
      aeoNumber: kind === 'exporter' ? ((party as Exporter | undefined)?.aeoNumber ?? '') : undefined,
      website: kind === 'exporter' ? ((party as Exporter | undefined)?.website ?? '') : undefined,
      notes: kind === 'exporter' ? ((party as Exporter | undefined)?.notes ?? '') : undefined,
      isConsignee:
        kind === 'business' ? ((party as Business | undefined)?.isConsignee ?? initialRole === 'consignee') : false,
      isBuyer: kind === 'business' ? ((party as Business | undefined)?.isBuyer ?? initialRole === 'buyer') : false,
      isNotify: kind === 'business' ? ((party as Business | undefined)?.isNotify ?? false) : false,
      isThirdParty:
        kind === 'business' ? ((party as Business | undefined)?.isThirdParty ?? initialRole === 'thirdParty') : false,
      branchName: '',
      address1: '',
      city: '',
      countryCode: kind === 'exporter' ? 'IN' : ''
    }
  })
  const { register } = formCtx.hooks

  const { options } = useFormOptions()

  async function handleSave(values: PartyFields) {
    // A business that is neither consignee, buyer, notify nor third party can
    // never be selected anywhere in the Shipping Bill.
    if (kind === 'business' && !values.isConsignee && !values.isBuyer && !values.isNotify && !values.isThirdParty) {
      formCtx.hooks.setError('isConsignee', {
        type: 'customs',
        message: 'Select at least one use (consignee, buyer, notify or third party)'
      })
      return
    }

    const firstBranch = isNew
      ? {
          branchName: values.branchName!,
          address1: values.address1!,
          city: values.city!,
          state: values.state,
          pincode: values.pincode,
          countryCode: values.countryCode
        }
      : undefined
    const saved =
      kind === 'exporter'
        ? await partyService.saveExporter({
            id: party?.id,
            name: values.name.trim(),
            iec: values.iec.trim(),
            class: values.class ?? 'F',
            type: values.type ?? 'P',
            pan: values.pan,
            tan: values.tan,
            aeoNumber: values.aeoNumber,
            website: values.website,
            notes: values.notes,
            firstBranch
          })
        : await partyService.saveBusiness({
            id: party?.id,
            name: values.name.trim(),
            iec: values.iec,
            isConsignee: !!values.isConsignee,
            isBuyer: !!values.isBuyer,
            isNotify: !!values.isNotify,
            isThirdParty: !!values.isThirdParty,
            firstBranch
          })
    toast.success(`${kind === 'exporter' ? 'Exporter' : 'Business'} saved`)
    onSaved?.(saved)
    onClose()
  }

  return (
    <Dialog open setOpen={(open) => !open && onClose()}>
      <DialogContent center>
        <div className="foreground max-h-[90vh] w-[min(92vw,42rem)] overflow-y-auto rounded-xl border border-gray-200 p-6 shadow-xl">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">
              {isNew ? 'Add' : 'Edit'} {kind}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isNew
                ? 'Add the main details and one address. You can add more branches later.'
                : 'Update the shared master record.'}
            </p>
          </div>
          <Form ctx={formCtx} handleSubmit={handleSave} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Name" {...register('name')} wrapClass="sm:col-span-2" />
              <Input label="IEC" {...register('iec')} />
              {kind === 'exporter' ? (
                <>
                  <Select<PartyFields> label="Exporter class" name="class" options={options?.exporterClasses ?? []} />
                  <Select<PartyFields> label="Exporter type" name="type" options={options?.exporterTypes ?? []} />
                </>
              ) : (
                <div className="sm:col-span-2">
                  <span className="mb-2 block text-sm font-medium">Used as</span>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    {(
                      [
                        ['isConsignee', 'Consignee'],
                        ['isBuyer', 'Buyer'],
                        ['isNotify', 'Notify party'],
                        ['isThirdParty', 'Third party']
                      ] as const
                    ).map(([name, label]) => (
                      <label key={name} className="flex items-center gap-2">
                        <Checkbox {...register(name)} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {kind === 'exporter' && (
              <details className="rounded-lg border border-gray-200 p-3">
                <summary className="cursor-pointer text-sm font-medium">More exporter details</summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Input label="PAN" {...register('pan')} />
                  <Input label="TAN" {...register('tan')} />
                  <Input label="AEO number" {...register('aeoNumber')} />
                  <Input label="Website" {...register('website')} />
                  <Textarea label="Notes" {...register('notes')} wrapClass="sm:col-span-2" />
                </div>
              </details>
            )}
            {isNew && (
              <section className="border-t border-gray-200 pt-4">
                <h3 className="mb-3 font-medium">First branch</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Branch name" {...register('branchName', { required: true })} />
                  <Input label="Address line 1" {...register('address1', { required: true })} />
                  <Input label="City" {...register('city', { required: true })} />
                  <Select<PartyFields>
                    label="Country"
                    name="countryCode"
                    options={options?.countries ?? []}
                    placeholder="Select country"
                  />
                  <Input label="State / province" {...register('state')} />
                  <Input label="Postal code" {...register('pincode')} />
                </div>
              </section>
            )}
            <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <SubmitButton>Save {kind}</SubmitButton>
            </div>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const branchSchema = s.object({
  branchName: s.string().minVal(2),
  address1: s.string().minVal(2),
  address2: s.string().optional(),
  city: s.string().minVal(2),
  state: indianState,
  pincode: indianPincode,
  countryCode: s.string(),
  email: s
    .string()
    .optional()
    .refine((value) => (blankText(value) || isValidEmail(value) ? undefined : 'Enter a valid email address')),
  mobile: s
    .string()
    .optional()
    .refine((value) => (blankText(value) || isValidMobile(value) ? undefined : 'Enter a valid mobile number')),
  gstnId: s
    .string()
    .optional()
    .refine((value) =>
      blankText(value) || isValidGstin(value) ? undefined : 'GSTIN must be 15 characters (e.g. 03AAECA1234F1Z5)'
    ),
  adCode: s
    .string()
    .optional()
    .refine((value) => (blankText(value) || isValidAdCode(value) ? undefined : 'AD code must be 14 digits')),
  accountNo: s
    .string()
    .optional()
    .refine((value) =>
      blankText(value) || /^\d{9,18}$/.test(value.trim()) ? undefined : 'Account number must be 9-18 digits'
    ),
  ifscCode: s
    .string()
    .optional()
    .refine((value) => (blankText(value) || isValidIfsc(value) ? undefined : 'IFSC must look like HDFC0001234'))
})
type BranchFields = InferType<typeof branchSchema>

interface BranchDialogProps {
  kind: Kind
  ownerId: number
  branch?: Branch
  onClose: () => void
  onSaved?: (branch: Branch) => void
}

export function BranchDialog({ kind, ownerId, branch, onClose, onSaved }: BranchDialogProps) {
  const { options } = useFormOptions()
  const formCtx = useForm<BranchFields>(branchSchema, {
    defaultValues: branch ?? { branchName: '', address1: '', city: '', countryCode: kind === 'exporter' ? 'IN' : '' }
  })
  const { register } = formCtx.hooks

  async function handleSave(values: BranchFields) {
    // Exporter branches file through a bank AD code and a GSTIN; both are
    // customs/FEMA identifiers the CHA needs for the Shipping Bill.
    if (kind === 'exporter' && blankText(values.gstnId)) {
      formCtx.hooks.setError('gstnId', { type: 'customs', message: 'GSTIN is required for an exporter branch' })
      return
    }
    if (kind === 'exporter' && blankText(values.adCode)) {
      formCtx.hooks.setError('adCode', { type: 'customs', message: 'Bank AD code is required for an exporter branch' })
      return
    }

    const saved = await partyService.saveBranch(kind, ownerId, { ...values, id: branch?.id })
    toast.success('Branch saved')
    onSaved?.(saved)
    onClose()
  }

  return (
    <Dialog open setOpen={(open) => !open && onClose()}>
      <DialogContent center>
        <div className="foreground max-h-[90vh] w-[min(92vw,42rem)] overflow-y-auto rounded-xl border border-gray-200 p-6 shadow-xl">
          <h2 className="mb-5 text-lg font-semibold">{branch ? 'Edit' : 'Add'} branch</h2>
          <Form ctx={formCtx} handleSubmit={handleSave} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Branch name" {...register('branchName')} />
              <Input label="Address line 1" {...register('address1')} />
              <Input label="Address line 2" {...register('address2')} />
              <Input label="City" {...register('city')} />
              <Input label="State / province" {...register('state')} />
              <Input label="Postal code" {...register('pincode')} />
              <Select<BranchFields>
                label="Country"
                name="countryCode"
                options={options?.countries ?? []}
                placeholder="Select country"
              />
              <Input label="Email" type="email" {...register('email')} />
              <Input label="Mobile" {...register('mobile')} />
              <Input label="GSTIN / tax ID" {...register('gstnId')} />
            </div>
            {kind === 'exporter' && (
              <details className="rounded-lg border border-gray-200 p-3">
                <summary className="cursor-pointer text-sm font-medium">Bank and customs details</summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Input label="AD code" {...register('adCode')} />
                  <Input label="Account number" {...register('accountNo')} />
                  <Input label="IFSC code" {...register('ifscCode')} />
                </div>
              </details>
            )}
            <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <SubmitButton>Save branch</SubmitButton>
            </div>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
