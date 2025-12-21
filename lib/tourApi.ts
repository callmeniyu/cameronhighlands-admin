export interface TourType {
    _id: string
    title: string
    slug: string
    image: string
    tags: string[]
    description: string
    category?: string
    type: "co-tour" | "private"
    packageType: "tour"
    duration: string
    period: "Half-Day" | "Full-Day"
    status: "active" | "sold"
    bookedCount: number
    rating?: number
    reviewCount?: number
    oldPrice: number
    newPrice: number
    childPrice: number
    minimumPerson: number
    maximumPerson?: number
    vehicle?: string
    seatCapacity?: number
    departureTimes: string[]
    label?: "Recommended" | "Popular" | "Best Value" | "Best Seller" | null
    isAvailable: boolean
    details: {
        about: string
        longDescription?: string
        itinerary: Array<{
            time: string
            activity: string
        }>
        pickupLocations: string[]
        pickupGuidelines?: string
        notes: string[]
        includes: string[]
        faq: Array<{
            question: string
            answer: string
        }>
    }
    lastSlotsGeneratedAt?: Date
    createdAt: Date
    updatedAt: Date
}

export interface ToursResponse {
    success: boolean
    data: TourType[]
    pagination: {
        page: number
        limit: number
        total: number
        pages: number
    }
}

export interface ApiError {
    success: false
    message: string
    errors?: any
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export const tourApi = {
    // Get all tours with optional filters and pagination
    getTours: async (params?: {
        page?: number
        limit?: number
        type?: string
        status?: string
        period?: string
    }): Promise<ToursResponse> => {
        try {
            const searchParams = new URLSearchParams()

            if (params?.page) searchParams.append("page", params.page.toString())
            if (params?.limit) searchParams.append("limit", params.limit.toString())
            if (params?.type) searchParams.append("type", params.type)
            if (params?.status) searchParams.append("status", params.status)
            if (params?.period) searchParams.append("period", params.period)

            const response = await fetch(`${API_BASE_URL}/api/tours?${searchParams}`)

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            return await response.json()
        } catch (error) {
            console.error("Error fetching tours:", error)
            throw error
        }
    },

    // Delete a tour
    deleteTour: async (id: string): Promise<{ success: boolean; message: string }> => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/tours/${id}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            return await response.json()
        } catch (error) {
            console.error("Error deleting tour:", error)
            throw error
        }
    },

    // Get tour by ID
    getTourById: async (id: string): Promise<{ success: boolean; data: TourType }> => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/tours/${id}`)

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            return await response.json()
        } catch (error) {
            console.error("Error fetching tour:", error)
            throw error
        }
    },

    // Update tour status
    updateTourStatus: async (
        id: string,
        status: "active" | "sold"
    ): Promise<{ success: boolean; message: string; data: TourType }> => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/tours/${id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ status }),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            return await response.json()
        } catch (error) {
            console.error("Error updating tour status:", error)
            throw error
        }
    },

    // Update a tour
    updateTour: async (id: string, tourData: any): Promise<{ success: boolean; message: string; data: TourType }> => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/tours/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(tourData),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            return await response.json()
        } catch (error) {
            console.error("Error updating tour:", error)
            throw error
        }
    },

    // Create a new tour
    createTour: async (tourData: any): Promise<{ success: boolean; message: string; data: TourType }> => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/tours`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(tourData),
            })

            if (!response.ok) {
                const result = await response.json()
                throw new Error(result.message || `HTTP error! status: ${response.status}`)
            }

            return await response.json()
        } catch (error) {
            console.error("Error creating tour:", error)
            throw error
        }
    },

    // Toggle tour availability
    toggleTourAvailability: async (
        id: string,
        isAvailable: boolean
    ): Promise<{ success: boolean; message: string; data: TourType }> => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/tours/${id}/availability`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ isAvailable }),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            return await response.json()
        } catch (error) {
            console.error("Error toggling tour availability:", error)
            throw error
        }
    },
}
