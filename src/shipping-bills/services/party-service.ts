import type { Branch, Business, Exporter, PortOption } from '../model'
import { loadingPorts, ports } from '../model'
import { getMockData, saveBranch, saveBusiness, saveExporter } from './mock-database'
import { mockNotFound, mockRequest } from './mock-transport'

/**
 * Party (exporter / business) and port mock service — the equivalent of
 * `GET/POST /api/parties/*` and `GET /api/ports/*`.
 *
 * All methods are asynchronous and Promise-based with simulated latency.
 * Persistence is delegated to the mock database behind this service; UI
 * components only talk to `partyService`, so real HTTP endpoints can
 * replace the bodies without any component changes. Searches resolve to an
 * empty array when nothing matches (the selects render their empty state),
 * while lookups for a specific missing record reject with a 404
 * `MockApiError`.
 */

export interface PartyLists {
  exporters: Exporter[]
  businesses: Business[]
}

export type NewExporter = Omit<Exporter, 'id' | 'branches'> & { id?: number; firstBranch?: Omit<Branch, 'id'> }
export type NewBusiness = Omit<Business, 'id' | 'branches'> & { id?: number; firstBranch?: Omit<Branch, 'id'> }

function matchesBranch(branch: Branch, query: string) {
  const q = query.trim().toLowerCase()
  return branch.branchName.toLowerCase().includes(q) || branch.city.toLowerCase().includes(q)
}

export const partyService = {
  /** Equivalent of `GET /api/parties` — used to populate the party pickers. */
  async listParties(): Promise<PartyLists> {
    return mockRequest('parties', () => {
      const { exporters, businesses } = getMockData()
      return { exporters, businesses }
    })
  },

  /** Equivalent of `GET /api/parties/exporters?q=` (name or IEC). */
  async searchExporters(query: string): Promise<Exporter[]> {
    return mockRequest('parties', () => {
      const { exporters } = getMockData()
      const q = query.trim().toLowerCase()
      return exporters.filter(
        (item) => !item.disabled && (item.name.toLowerCase().includes(q) || item.iec.toLowerCase().includes(q))
      )
    })
  },

  /** Equivalent of `GET /api/parties/businesses?q=&role=consignee`. */
  async searchConsignees(query: string): Promise<Business[]> {
    return mockRequest('parties', () => {
      const { businesses } = getMockData()
      const q = query.trim().toLowerCase()
      return businesses.filter((item) => item.isConsignee && item.name.toLowerCase().includes(q))
    })
  },

  /** Equivalent of `GET /api/parties/exporters/:id`. Rejects 404 when unknown. */
  async getExporterById(exporterId: string): Promise<Exporter> {
    return mockRequest(
      'parties',
      () => {
        const exporter = getMockData().exporters.find((item) => String(item.id) === exporterId)
        if (!exporter) throw mockNotFound('Exporter', exporterId)
        return exporter
      },
      100
    )
  },

  /** Equivalent of `GET /api/parties/businesses/:id`. Rejects 404 when unknown. */
  async getBusinessById(businessId: string): Promise<Business> {
    return mockRequest(
      'parties',
      () => {
        const business = getMockData().businesses.find((item) => String(item.id) === businessId)
        if (!business) throw mockNotFound('Business', businessId)
        return business
      },
      100
    )
  },

  /** Equivalent of `GET /api/parties/exporters/:id/branches?q=`. */
  async searchExporterBranches(exporterId: string, query: string): Promise<Branch[]> {
    if (!exporterId) return mockRequest('parties', () => [], 50)
    return mockRequest('parties', () => {
      const exporter = getMockData().exporters.find((item) => String(item.id) === exporterId)
      return exporter ? exporter.branches.filter((branch) => matchesBranch(branch, query)) : []
    })
  },

  /** Equivalent of `GET /api/parties/businesses/:id/branches?q=`. */
  async searchBusinessBranches(businessId: string, query: string): Promise<Branch[]> {
    if (!businessId) return mockRequest('parties', () => [], 50)
    return mockRequest('parties', () => {
      const business = getMockData().businesses.find((item) => String(item.id) === businessId)
      return business ? business.branches.filter((branch) => matchesBranch(branch, query)) : []
    })
  },

  /** Resolves one branch for label display. Rejects 404 when unknown. */
  async getBranch(kind: 'exporter' | 'business', ownerId: string, branchId: string): Promise<Branch> {
    return mockRequest(
      'parties',
      () => {
        const owners = kind === 'exporter' ? getMockData().exporters : getMockData().businesses
        const branch = owners
          .find((owner) => String(owner.id) === ownerId)
          ?.branches.find((item) => String(item.id) === branchId)
        if (!branch) throw mockNotFound('Branch', branchId)
        return branch
      },
      100
    )
  },

  /** Equivalent of `POST /api/parties/exporters`. */
  async saveExporter(exporter: NewExporter): Promise<Exporter> {
    return mockRequest('parties', () => saveExporter(exporter), 300)
  },

  /** Equivalent of `POST /api/parties/businesses`. */
  async saveBusiness(business: NewBusiness): Promise<Business> {
    return mockRequest('parties', () => saveBusiness(business), 300)
  },

  /** Equivalent of `POST /api/parties/:kind/:ownerId/branches`. */
  async saveBranch(
    kind: 'exporter' | 'business',
    ownerId: number,
    branch: Omit<Branch, 'id'> & { id?: number }
  ): Promise<Branch> {
    return mockRequest('parties', () => saveBranch(kind, ownerId, branch), 300)
  },

  /** Equivalent of `GET /api/ports?kind=loading&q=` (Indian ports only). */
  async searchLoadingPorts(query: string): Promise<PortOption[]> {
    return mockRequest('parties', () => {
      const q = query.trim().toLowerCase()
      return loadingPorts.filter(
        (port) =>
          port.code.startsWith('IN') && (port.name.toLowerCase().includes(q) || port.code.toLowerCase().includes(q))
      )
    })
  },

  /** Equivalent of `GET /api/ports?kind=destination&q=`. */
  async searchDestinationPorts(query: string): Promise<PortOption[]> {
    return mockRequest('parties', () => {
      const q = query.trim().toLowerCase()
      return ports.filter((port) => port.name.toLowerCase().includes(q) || port.code.toLowerCase().includes(q))
    })
  },

  /** Equivalent of `GET /api/ports/:code`. Rejects 404 when unknown. */
  async getPortByCode(code: string): Promise<PortOption> {
    return mockRequest(
      'parties',
      () => {
        const port = ports.find((item) => item.code === code) ?? loadingPorts.find((item) => item.code === code)
        if (!port) throw mockNotFound('Port', code)
        return port
      },
      100
    )
  }
}
