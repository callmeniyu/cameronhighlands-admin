"use client";
import Link from "next/link";
import { FiCompass, FiCalendar, FiUsers, FiBook } from "react-icons/fi";
import { RxDashboard } from "react-icons/rx";
import { usePathname } from "next/navigation";

export default function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Home", path: "/", icon: RxDashboard },
    { name: "Bookings", path: "/bookings", icon: FiCalendar },
    { name: "Tours", path: "/tours", icon: FiCompass },
    { name: "Blogs", path: "/blogs", icon: FiBook },
  ];

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t border-gray-200 z-50">
        <div className="flex justify-around items-center py-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`flex flex-col items-center p-2 rounded-lg ${
                pathname === item.path ? "text-primary" : "text-light"
              }`}
            >
              <item.icon className="text-xl" />
              <span className="text-xs mt-1">{item.name}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Spacer to prevent the fixed mobile nav from covering page content on small screens */}
      <div className="h-20 md:hidden" aria-hidden="true" />
    </>
  );
}
