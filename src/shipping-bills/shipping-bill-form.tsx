import { routes } from '@/shared/route-paths'
import { useForm } from 'core/form'
import { Form } from 'core/form/components'
import { useQuery } from 'core/react-query'
import { navigate, useParams } from 'core/routing'
import { toast } from 'core/toast-manager'
import { useEffect, useRef, useState } from 'react'
import { Button } from 'ui/basic/button'
import { Tabs, TabsList, TabsTrigger } from 'ui/interactive/tabs'
import { ShippingBillDetailsTab } from './components/shipping-bill-details-tab'
import { ShippingBillDocumentsTab } from './components/shipping-bill-documents-tab'
import { ShippingBillInvoicesTab } from './components/shipping-bill-invoices-tab'
import type { QuickAdd, QuickBranch } from './form-types'
import type { Branch, Business, Exporter, SavedBill, ShippingBillFormValues } from './model'
import { emptyBill } from './model'
import { BranchDialog, PartyDialog } from './party-dialogs'
import { partyService } from './services/party-service'
import type { MarksAndNumbersOption } from './services/reference-data-service'
import { referenceDataService } from './services/reference-data-service'
import { shippingBillService } from './services/shipping-bill-service'
import { useFormOptions } from './use-form-options'
import { shippingBillSchema, validateShippingBill } from './validation'
import { workflowSteps } from './workflow'

interface FlatError {
  path: string
  message: string
}

function flattenErrors(errors: unknown, prefix = '', out: FlatError[] = []): FlatError[] {
  if (errors == null || typeof errors !== 'object') return out
  const record = errors as Record<string, unknown>
  const message = typeof record.message === 'string' ? record.message : ''
  if (typeof record.type === 'string' && (message !== '' || record.ref != null)) {
    out.push({
      path: prefix,
      message: message !== '' ? message : record.type === 'required' ? 'This field is required' : 'Invalid value'
    })
    return out
  }
  Object.entries(record).forEach(([key, value]) => flattenErrors(value, prefix ? `${prefix}.${key}` : key, out))
  return out
}

function tabForPath(path: string): 'details' | 'invoices' | 'documents' {
  const root = path.split('.')[0]
  if (root === 'invoices') return 'invoices'
  if (['containers', 'packingRanges', 'documents', 'licenses'].includes(root)) return 'documents'
  return 'details'
}

function BillEditor({ bill }: { bill?: SavedBill }) {
  // Form data comes from the mock services (React Query caches/shares it);
  // the components below never touch mock data or stores directly.
  const partiesQuery = useQuery({
    queryKey: ['shipping-bill', 'parties'],
    queryFn: () => partyService.listParties(),
    retry: false
  })
  const exporters = partiesQuery.data?.exporters ?? []
  const businesses = partiesQuery.data?.businesses ?? []
  const formOptions = useFormOptions()
  const formCtx = useForm<ShippingBillFormValues>(shippingBillSchema, { defaultValues: bill?.values ?? emptyBill() })
  const { setValue, formState } = formCtx.hooks
  const values = formCtx.hooks.watch()
  const [activeTab, setActiveTab] = useState('details')
  const [draftId, setDraftId] = useState<number | undefined>(bill?.id)
  const [quickAdd, setQuickAdd] = useState<QuickAdd | null>(null)
  const [quickBranch, setQuickBranch] = useState<QuickBranch | null>(null)
  const [marksAndNumbersOptions, setMarksAndNumbersOptions] = useState<MarksAndNumbersOption[]>([])
  const [marksAndNumbersLoading, setMarksAndNumbersLoading] = useState(false)
  const previousExporterId = useRef(values.exporterId)
  useEffect(() => {
    const exporterId = values.exporterId
    if (previousExporterId.current !== exporterId) {
      previousExporterId.current = exporterId
      setValue('marksAndNumbers', '', { shouldValidate: true })
    }

    let cancelled = false
    setMarksAndNumbersOptions([])
    setMarksAndNumbersLoading(Boolean(exporterId))
    if (exporterId) {
      void referenceDataService
        .getMarksAndNumbers(exporterId)
        .then((options) => {
          if (cancelled) return
          setMarksAndNumbersOptions(options)
          setMarksAndNumbersLoading(false)
        })
        .catch(() => {
          if (cancelled) return
          setMarksAndNumbersOptions([])
          setMarksAndNumbersLoading(false)
        })
    }

    return () => {
      cancelled = true
    }
  }, [setValue, values.exporterId])

  const errorSummary = formState.submitCount > 0 ? flattenErrors(formState.errors) : []

  useEffect(() => {
    if (!formState.submitCount || !Object.keys(formState.errors).length) return
    console.log('Form validation errors on submit:', formState.errors)
    const flat = flattenErrors(formState.errors)
    toast.error(flat.length > 1 ? `Please fix ${flat.length} validation errors` : 'Please check the required fields')
    // Jump to the first tab (in workflow order) that contains an error.
    const tabsInOrder = ['details', 'invoices', 'documents'] as const
    const firstTab = tabsInOrder.find((tab) => flat.some((error) => tabForPath(error.path) === tab))
    if (firstTab) setActiveTab(firstTab)
  }, [formState.submitCount, formState.errors])

  async function handleSave(data: ShippingBillFormValues) {
    // Cross-field customs rules run at the save boundary: leaf rules have
    // already passed, so anything found here is set back onto its field and
    // saving is blocked until the bill is internally consistent.
    const domainErrors = validateShippingBill(data)
    if (domainErrors.length > 0) {
      domainErrors.forEach((error) =>
        formCtx.hooks.setError(error.path as never, { type: 'customs', message: error.message })
      )
      return
    }

    try {
      const saved = await shippingBillService.submitShippingBill(data, draftId)
      setDraftId(saved.id)
      console.log('Shipping bill save payload', saved.payload)
      toast.success(bill ? 'Shipping bill updated' : 'Shipping bill created')
      navigate(routes.toShippingBillEdit(saved.id))
    } catch (err: any) {
      console.error('Error saving shipping bill:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to save shipping bill')
    }
  }

  async function handleDraftStep(nextTab: string, notify: boolean) {
    try {
      const saved = await shippingBillService.saveDraft(formCtx.hooks.getValues(), draftId)
      setDraftId(saved.id)
      if (notify) toast.success('Draft saved')
      setActiveTab(nextTab)
    } catch {
      toast.error('Failed to save draft')
    }
  }

  function handleQuickSaved(party: Exporter | Business) {
    void partiesQuery.refetch()
    const branchId = party.branches[0]?.id
    if (!quickAdd || !branchId) return
    if (quickAdd.kind === 'exporter') {
      setValue('exporterId', String(party.id), { shouldValidate: true })
      setValue('exporterBranchId', String(branchId), { shouldValidate: true })
    } else if (quickAdd.role === 'consignee') {
      setValue('consigneeId', String(party.id), { shouldValidate: true })
      setValue('consigneeBranchId', String(branchId), { shouldValidate: true })
    } else if (quickAdd.role === 'itemThirdParty' && quickAdd.invoiceIndex != null && quickAdd.itemIndex != null) {
      setValue(`invoices.${quickAdd.invoiceIndex}.items.${quickAdd.itemIndex}.itemThirdPartyId`, String(party.id), {
        shouldValidate: true
      })
      setValue(
        `invoices.${quickAdd.invoiceIndex}.items.${quickAdd.itemIndex}.itemThirdPartyBranchId`,
        String(branchId),
        { shouldValidate: true }
      )
    } else if (quickAdd.invoiceIndex != null) {
      const field = quickAdd.role === 'buyer' ? 'buyer' : 'thirdParty'
      setValue(`invoices.${quickAdd.invoiceIndex}.${field}Id`, String(party.id), { shouldValidate: true })
      setValue(`invoices.${quickAdd.invoiceIndex}.${field}BranchId`, String(branchId), { shouldValidate: true })
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button className="mb-2 text-sm text-gray-500 hover:underline" onClick={() => navigate(routes.dashboard)}>
            ← Shipping bills
          </button>
          <h1 className="text-2xl font-semibold text-gray-950">
            {bill ? `Edit shipping bill #${bill.id}` : 'New shipping bill'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter the everyday details first. Open advanced sections only when needed.
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {workflowSteps.map((step, index) => {
          const isShippingBill = step.id === 'shipping-bill'
          return (
            <div
              key={step.id}
              className={`rounded-lg border p-3 ${
                isShippingBill ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-gray-50'
              }`}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="flex size-6 items-center justify-center rounded-full bg-white text-xs">
                  {index + 1}
                </span>
                {step.title}
              </div>
              <p className="ml-8 text-xs text-gray-500">{step.description}</p>
            </div>
          )
        })}
      </div>
      {(partiesQuery.isLoading || formOptions.isLoading) && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600" role="status">
          Loading form data from the mock services...
        </p>
      )}
      {(partiesQuery.isError || formOptions.isError) && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
          role="alert">
          <p className="text-sm text-red-800">
            Form data could not be loaded from the mock services. Searches and pickers may be empty.
          </p>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => {
              void partiesQuery.refetch()
              formOptions.refetch()
            }}>
            Retry
          </Button>
        </div>
      )}
      {!partiesQuery.isLoading && !partiesQuery.isError && exporters.length === 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
          No exporters found in the mock data yet — use “+ Add new” next to Exporter to create one.
        </p>
      )}
      {errorSummary.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
          <h2 className="text-sm font-semibold text-red-900">
            Customs validation — fix {errorSummary.length} field{errorSummary.length === 1 ? '' : 's'} before saving
          </h2>
          <ul className="mt-2 space-y-1">
            {errorSummary.map((error) => (
              <li key={`${error.path}-${error.message}`}>
                <button
                  type="button"
                  className="text-left text-sm text-red-800 hover:underline"
                  onClick={() => setActiveTab(tabForPath(error.path))}>
                  <span className="font-medium">{error.path}</span> — {error.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Form ctx={formCtx} handleSubmit={handleSave} className="space-y-5">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(String(value))}>
          <TabsList className="flex w-full justify-start overflow-x-auto">
            <TabsTrigger value="details">1. Details</TabsTrigger>
            <TabsTrigger value="invoices">2. Invoices & goods</TabsTrigger>
            <TabsTrigger value="documents">3. Others</TabsTrigger>
          </TabsList>

          <ShippingBillDetailsTab
            formCtx={formCtx}
            activeTab={activeTab}
            exporters={exporters}
            businesses={businesses}
            marksAndNumbersOptions={marksAndNumbersOptions}
            marksAndNumbersLoading={marksAndNumbersLoading}
            onQuickAdd={(request) => setQuickAdd(request)}
            onAddBranch={(request) => setQuickBranch(request)}
          />
          <ShippingBillInvoicesTab
            formCtx={formCtx}
            activeTab={activeTab}
            businesses={businesses}
            onQuickAdd={(request) => setQuickAdd(request)}
            onAddBranch={(request) => setQuickBranch(request)}
          />
          <ShippingBillDocumentsTab formCtx={formCtx} activeTab={activeTab} />
        </Tabs>
        <div className="flex flex-wrap justify-between gap-2 border-t border-gray-200 pt-4">
          <Button variant="outline" type="button" onClick={() => navigate(routes.dashboard)}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {activeTab !== 'details' && (
              <Button
                variant="outline"
                type="button"
                onClick={() => void handleDraftStep(activeTab === 'documents' ? 'invoices' : 'details', false)}>
                Previous
              </Button>
            )}
            {activeTab !== 'documents' ? (
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  void handleDraftStep(activeTab === 'details' ? 'invoices' : 'documents', true)
                }}>
                Save & Next
              </Button>
            ) : (
              <Button type="submit">Save changes</Button>
            )}
          </div>
        </div>
      </Form>
      {quickAdd && (
        <PartyDialog
          key={`${quickAdd.kind}-${quickAdd.role ?? 'exporter'}-${quickAdd.invoiceIndex ?? 0}`}
          kind={quickAdd.kind}
          initialRole={quickAdd.role === 'itemThirdParty' ? 'thirdParty' : quickAdd.role}
          onClose={() => setQuickAdd(null)}
          onSaved={handleQuickSaved}
        />
      )}
      {quickBranch && (
        <BranchDialog
          key={`${quickBranch.kind}-${quickBranch.ownerId}`}
          kind={quickBranch.kind}
          ownerId={quickBranch.ownerId}
          onClose={() => setQuickBranch(null)}
          onSaved={(branch: Branch) => {
            void partiesQuery.refetch()
            setValue(quickBranch.branchName, String(branch.id), { shouldValidate: true })
          }}
        />
      )}
    </div>
  )
}

export default function ShippingBillPage() {
  const { id } = useParams<{ id?: string }>()
  const billQuery = useQuery({
    queryKey: ['shipping-bill', 'detail', id],
    queryFn: () => shippingBillService.getShippingBill(id!),
    enabled: Boolean(id),
    retry: false
  })

  if (id && billQuery.isLoading)
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Loading shipping bill...</h1>
        <p className="text-sm text-gray-500">Fetching it from the mock service.</p>
      </div>
    )

  if (id && (billQuery.isError || !billQuery.data))
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Shipping bill not found</h1>
        <p className="text-sm text-gray-500">It may have been removed, or the mock service failed to load it.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void billQuery.refetch()}>
            Retry
          </Button>
          <Button onClick={() => navigate(routes.dashboard)}>Back to list</Button>
        </div>
      </div>
    )

  return <BillEditor key={id ?? 'new'} bill={billQuery.data} />
}
