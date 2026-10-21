import { useQuery } from 'core/react-query'
import type { FormOptionsBundle } from './services/reference-data-service'
import { referenceDataService } from './services/reference-data-service'

/**
 * Loads every static option list the Shipping Bill form needs, once, through
 * the reference-data mock service (React Query caches it app-wide with
 * `staleTime: Infinity`, so all tabs and dialogs share one request).
 *
 * Components read `options` (empty lists while loading) and can render the
 * `isLoading` / `isError` / `refetch` states instead of importing hardcoded
 * option arrays.
 */
export function useFormOptions() {
  const query = useQuery({
    queryKey: ['shipping-bill', 'form-options'],
    queryFn: () => referenceDataService.getFormOptions(),
    retry: false
  })

  const options: FormOptionsBundle | undefined = query.data

  return {
    options,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: () => void query.refetch()
  }
}
