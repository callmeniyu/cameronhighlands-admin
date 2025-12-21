"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import MobileNav from "@/components/admin/MobileNav";
import StatsCard from "@/components/admin/StatsCard";
import { FiClock, FiUsers } from "react-icons/fi";

interface Booking {
  _id?: string;
  id?: string;
  packageId?: { title?: string };
  title?: string;
  packageType?: string;
  date?: string;
  createdAt?: string;
  time?: string;
  status?: string;
  total?: number;
}

interface BookingsApiResponse {
  success: boolean;
  bookings?: Booking[];
  data?: Booking[];
  error?: string;
}

interface Tour {
  status?: string;
}

interface SortedBooking {
  id?: string;
  tour?: string;
  date: string;
  time: string;
  status: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState([
    {
      title: "Total Bookings",
      value: "Loading...",
      icon: "📊",
      link: "/bookings",
    },
    { title: "Revenue", value: "Loading...", icon: "💰", link: "/revenue" },
    { title: "Active Tours", value: "Loading...", icon: "🚗", link: "/tours" },
    {
      title: "Active Transfers",
      value: "Loading...",
      icon: "⏱️",
      link: "/transfers",
    },
  ]);

  const [recentBookings, setRecentBookings] = useState<SortedBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch dashboard statistics
  const fetchDashboardStats = async () => {
    try {
      const [bookingsRes, toursRes] = await Promise.all([
        fetch("/api/bookings"),
        fetch("/api/tours"),
      ]);

      const bookingsData = await bookingsRes.json();
      const toursData = await toursRes.json();

      // Calculate total bookings
      const totalBookings = bookingsData.success
        ? (bookingsData.bookings || bookingsData.data || []).length
        : 0;

      // Calculate revenue from bookings

      const revenue = bookingsData.success
        ? (
            (bookingsData.bookings || bookingsData.data || []) as Booking[]
          ).reduce(
            (sum: number, booking: Booking) => sum + (booking.total || 0),
            0
          )
        : 0;

      // Count active tours

      const activeTours: number = (toursData as BookingsApiResponse).success
        ? ((toursData.tours || toursData.data || []) as Tour[]).filter(
            (tour: Tour) => tour.status === "active"
          ).length
        : 0;

      setStats([
        {
          title: "Total Bookings",
          value: totalBookings.toString(),
          icon: "📊",
          link: "/bookings",
        },
        {
          title: "Revenue",
          value: `RM ${revenue.toLocaleString()}`,
          icon: "💰",
          link: "/revenue",
        },
        {
          title: "Active Tours",
          value: activeTours.toString(),
          icon: "🚗",
          link: "/tours",
        },
      ]);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      setStats([
        {
          title: "Total Bookings",
          value: "Error",
          icon: "📊",
          link: "/bookings",
        },
        { title: "Revenue", value: "Error", icon: "💰", link: "/revenue" },
        { title: "Active Tours", value: "Error", icon: "🚗", link: "/tours" },
      ]);
    }
  };

  // Fetch recent bookings
  const fetchRecentBookings = async () => {
    try {
      const response = await fetch("/api/bookings");
      const data = await response.json();

      if (data.success) {
        const bookings = data.bookings || data.data || [];
        // Sort by creation date and take the latest 4

        const sortedBookings: SortedBooking[] = (bookings as Booking[])
          .filter((booking: Booking) => booking.packageType !== "transfer") // Filter out transfers
          .sort(
            (a: Booking, b: Booking) =>
              new Date(b.createdAt || b.date!).getTime() -
              new Date(a.createdAt || a.date!).getTime()
          )
          .slice(0, 4)
          .map(
            (booking: Booking): SortedBooking => ({
              id: booking._id || booking.id,
              tour: booking.packageId?.title || booking.title,
              date: booking.date
                ? new Date(booking.date).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "N/A",
              time: booking.time || "N/A",
              status: booking.status || "Confirmed",
            })
          );

        setRecentBookings(sortedBookings);
      } else {
        console.error("Failed to fetch recent bookings:", data.error);
        setRecentBookings([]);
      }
    } catch (error) {
      console.error("Error fetching recent bookings:", error);
      setRecentBookings([]);
    }
  };

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      await Promise.all([fetchDashboardStats(), fetchRecentBookings()]);
      setIsLoading(false);
    };

    loadDashboardData();

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);

    return () => clearInterval(interval);
  }, []);

  // Function to format date consistently
  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj.toISOString().split("T")[0];
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <AdminHeader />

      <main className="p-4">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-dark mb-4">
            Dashboard Overview
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {stats.map((stat, index) => (
              <StatsCard
                key={index}
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                link={stat.link}
              />
            ))}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-dark">Recent Bookings</h2>
            <button
              onClick={() => router.push("/bookings")}
              className="text-primary text-sm font-medium hover:underline"
            >
              View All
            </button>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-4 text-gray-500">
                Loading recent bookings...
              </div>
            ) : recentBookings.length > 0 ? (
              recentBookings.map((booking, index) => {
                // Convert booking to package format for the PackageCard
                const pkg = {
                  id: booking.id || "",
                  title: booking.tour || "Unknown Package",
                  type: "tour" as const,
                  duration: "half-day", // Default value
                  currentBookings: 1,
                  maxSlots: 10,
                  startTime: booking.time || "N/A",
                  price: "Booked",
                  status: booking.status || "Confirmed",
                };

                return (
                  <PackageCard
                    key={index}
                    package={pkg}
                    bookingDate={booking.date || ""}
                    status={booking.status || "Confirmed"}
                  />
                );
              })
            ) : (
              <div className="text-center py-4 text-gray-500">
                No recent bookings found
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-dark mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => router.push("/tours/add-tour")}
              className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <span className="text-2xl mb-2">🚗</span>
              <span className="font-medium">Add Tour</span>
            </button>
            <button
              onClick={() => router.push("/transfers/add-transfer")}
              className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <span className="text-2xl mb-2">🚐</span>
              <span className="font-medium">Add Transfer</span>
            </button>
            <button
              onClick={() => router.push("/blogs/add-blog")}
              className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <span className="text-2xl mb-2">📝</span>
              <span className="font-medium">Create Blog</span>
            </button>
            <button
              onClick={() => router.push("/bookings")}
              className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <span className="text-2xl mb-2">🔖</span>
              <span className="font-medium">See Bookings</span>
            </button>
          </div>
        </div>
      </main>

      <MobileNav />
    </div>
  );
}

// Simple version of PackageCard for dashboard
function PackageCard({
  package: pkg,
  bookingDate,
  status,
}: {
  package: {
    id: string;
    title: string;
    type: "tour" | "transfer";
    startTime: string;
    price: string;
    currentBookings: number;
    maxSlots: number;
    duration?: string;
    status?: string;
  };
  bookingDate: string;
  status: string;
}) {
  const router = useRouter();

  const handlePackageClick = () => {
    router.push(`/bookings`);
  };

  const getStatusColor = () => {
    if (status.toLowerCase() === "cancelled") return "bg-red-100 text-red-700";
    if (status.toLowerCase() === "pending")
      return "bg-yellow-100 text-yellow-700";
    return "bg-green-100 text-green-700";
  };

  return (
    <div
      className="p-4 rounded-lg border border-gray-200 bg-white cursor-pointer hover:shadow-md transition-shadow"
      onClick={handlePackageClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-dark">{pkg.title}</h3>
            {pkg.duration && (
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  pkg.duration === "full-day"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-purple-100 text-purple-800"
                }`}
              >
                {pkg.duration === "full-day" ? "Full Day" : "Half Day"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <FiClock className="text-xs" />
              <span>{pkg.startTime}</span>
            </div>
            <div className="text-xs text-gray-500">{bookingDate}</div>
          </div>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor()}`}
        >
          {status}
        </div>
      </div>

      {/* Package Type */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FiUsers className="text-gray-500" />
          <span className="text-sm text-gray-500">Type:</span>
          <span className="text-sm font-medium">
            {pkg.type === "tour" ? "Tour" : "Transfer"}
          </span>
        </div>
      </div>
    </div>
  );
}
