"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import MobileNav from "@/components/admin/MobileNav";
import { toast } from "react-hot-toast";
import { IoStar, IoStarOutline, IoChevronBack } from "react-icons/io5";
import { FiTrash2, FiUser, FiPackage, FiChevronRight } from "react-icons/fi";
import { format } from "date-fns";
import Image from "next/image";

interface PackageWithReviews {
  packageId: string;
  packageType: "tour" | "transfer";
  reviewCount: number;
  averageRating: number;
  latestReview: string;
  package: {
    _id: string;
    title: string;
    slug: string;
    image?: string;
  } | null;
}

interface Review {
  _id: string;
  userName: string;
  userEmail: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export default function ReviewsPage() {
  const [packages, setPackages] = useState<PackageWithReviews[]>([]);
  const [selectedPackage, setSelectedPackage] =
    useState<PackageWithReviews | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "tour">("all");
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    reviewId: string | null;
    reviewerName: string;
  }>({
    isOpen: false,
    reviewId: null,
    reviewerName: "",
  });

  useEffect(() => {
    fetchPackages();
  }, [filterType]);

  const fetchPackages = async () => {
    try {
      setIsLoading(true);
      const queryParam =
        filterType !== "all" ? `?packageType=${filterType}` : "";
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/reviews/admin/packages${queryParam}`
      );
      const data = await response.json();

      if (data.success) {
        setPackages(data.data);
      } else {
        toast.error("Failed to fetch packages");
      }
    } catch (error) {
      console.error("Error fetching packages:", error);
      toast.error("Error loading packages");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPackageReviews = async (packageData: PackageWithReviews) => {
    try {
      setIsLoadingReviews(true);
      setSelectedPackage(packageData);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/reviews/${packageData.packageType}/${packageData.packageId}`
      );
      const data = await response.json();

      if (data.success) {
        setReviews(data.data);
      } else {
        toast.error("Failed to fetch reviews");
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
      toast.error("Error loading reviews");
    } finally {
      setIsLoadingReviews(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!deleteConfirmation.reviewId) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/reviews/${deleteConfirmation.reviewId}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (data.success) {
        toast.success("Review deleted successfully");

        // Refresh the reviews for the selected package
        if (selectedPackage) {
          fetchPackageReviews(selectedPackage);

          // Also refresh the packages list to update counts
          fetchPackages();
        }

        setDeleteConfirmation({
          isOpen: false,
          reviewId: null,
          reviewerName: "",
        });
      } else {
        toast.error(data.message || "Failed to delete review");
      }
    } catch (error) {
      console.error("Error deleting review:", error);
      toast.error("Error deleting review");
    }
  };

  const handleBackToPackages = () => {
    setSelectedPackage(null);
    setReviews([]);
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) =>
          star <= rating ? (
            <IoStar key={star} className="text-yellow-400 text-lg" />
          ) : (
            <IoStarOutline key={star} className="text-gray-300 text-lg" />
          )
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="flex">
        <MobileNav />

        <main className="flex-1 p-6 lg:ml-64">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              {selectedPackage ? (
                <div>
                  <button
                    onClick={handleBackToPackages}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4 font-medium"
                  >
                    <IoChevronBack className="text-xl" />
                    Back to Packages
                  </button>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {selectedPackage.package?.title}
                  </h1>
                  <p className="text-gray-600">
                    {reviews.length} review{reviews.length !== 1 ? "s" : ""} •{" "}
                    Average rating: {selectedPackage.averageRating} / 5
                  </p>
                </div>
              ) : (
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Reviews Management
                  </h1>
                  <p className="text-gray-600">
                    Select a package to view and manage reviews
                  </p>
                </div>
              )}
            </div>

            {/* Filter Tabs - Only show when viewing packages list */}
            {!selectedPackage && (
              <div className="mb-6 flex gap-2">
                <button
                  onClick={() => setFilterType("all")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filterType === "all"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  All Packages ({packages.length})
                </button>
                <button
                  onClick={() => setFilterType("tour")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filterType === "tour"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Tours
                </button>
              </div>
            )}

            {/* Content */}
            {!selectedPackage ? (
              // Packages List View
              isLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  <p className="mt-4 text-gray-600">Loading packages...</p>
                </div>
              ) : packages.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                  <FiPackage className="mx-auto text-6xl text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    No Reviews Yet
                  </h3>
                  <p className="text-gray-500">
                    Packages with reviews will appear here once customers start
                    submitting them.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {packages.map((pkg) => (
                    <div
                      key={pkg.packageId}
                      onClick={() => fetchPackageReviews(pkg)}
                      className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-shadow"
                    >
                      {/* Package Image */}
                      {pkg.package?.image && (
                        <div className="relative h-48 w-full">
                          <Image
                            src={pkg.package.image}
                            alt={pkg.package.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}

                      {/* Package Info */}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-bold text-lg text-gray-900 flex-1">
                            {pkg.package?.title}
                          </h3>
                          <FiChevronRight className="text-gray-400 text-xl flex-shrink-0 mt-1" />
                        </div>

                        <div className="flex items-center gap-2 mb-3">
                          {renderStars(Math.round(pkg.averageRating))}
                          <span className="text-sm text-gray-600">
                            {pkg.averageRating.toFixed(1)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span className="capitalize">{pkg.packageType}</span>
                          <span>
                            {pkg.reviewCount} review
                            {pkg.reviewCount !== 1 ? "s" : ""}
                          </span>
                        </div>

                        <div className="mt-3 text-xs text-gray-500">
                          Latest:{" "}
                          {format(new Date(pkg.latestReview), "MMM dd, yyyy")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : // Reviews List View for Selected Package
            isLoadingReviews ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600">Loading reviews...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review._id}
                    className="bg-white rounded-lg shadow-md p-6"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <FiUser className="text-blue-600 text-xl" />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h3 className="font-semibold text-lg text-gray-900">
                                {review.userName}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {review.userEmail}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                setDeleteConfirmation({
                                  isOpen: true,
                                  reviewId: review._id,
                                  reviewerName: review.userName,
                                })
                              }
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete review"
                            >
                              <FiTrash2 className="text-lg" />
                            </button>
                          </div>

                          <div className="flex items-center gap-3 mb-3">
                            {renderStars(review.rating)}
                            <span className="text-sm text-gray-500">
                              {format(
                                new Date(review.createdAt),
                                "MMM dd, yyyy"
                              )}
                            </span>
                          </div>

                          <p className="text-gray-700 whitespace-pre-wrap">
                            {review.comment}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Delete Review</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete the review by{" "}
              <span className="font-semibold">
                {deleteConfirmation.reviewerName}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() =>
                  setDeleteConfirmation({
                    isOpen: false,
                    reviewId: null,
                    reviewerName: "",
                  })
                }
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteReview}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Delete Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
