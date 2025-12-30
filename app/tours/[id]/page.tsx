"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FiPlus,
  FiX,
  FiClock,
  FiUsers,
  FiUpload,
  FiChevronDown,
  FiTrash2,
} from "react-icons/fi";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { toast } from "react-hot-toast";
import { tourApi } from "@/lib/tourApi";

// Schema validation matching new Tour model
const tourSchema = z
  .object({
    title: z
      .string()
      .min(20, "Title must be at least 20 characters")
      .max(100, "Title cannot exceed 100 characters"),
    slug: z
      .string()
      .regex(
        /^[a-z0-9-]*$/,
        "Slug can only contain lowercase letters, numbers and hyphens"
      )
      .optional()
      .or(z.literal("")),
    image: z.string().min(1, "Please provide an image"),
    tags: z.array(z.string().min(1)).min(1, "At least one tag is required"),
    description: z
      .string()
      .min(50, "Description must be at least 50 characters")
      .max(200, "Description cannot exceed 200 characters"),
    type: z.enum(["co-tour", "private"]),
    duration: z.string().min(1, "Duration is required"),
    period: z.enum(["Half-Day", "Full-Day"]),
    bookedCount: z.number().min(0),
    rating: z.number().min(0).max(5).optional(),
    reviewCount: z.number().min(0).optional(),
    oldPrice: z.number().min(0, "Old price must be 0 or greater"),
    newPrice: z.number().min(0, "New price must be 0 or greater"),
    childPrice: z.number().min(0, "Child price must be 0 or greater"),
    minimumPerson: z.number().min(1, "Minimum must be at least 1 person"),
    maximumPerson: z.number().min(1, "Maximum must be at least 1 person"),
    vehicle: z.string().optional(),
    seatCapacity: z.number().optional(),
    departureTimes: z
      .array(z.string())
      .min(1, "At least one departure time is required"),
    label: z.enum([
      "Recommended",
      "Popular",
      "Best Value",
      "Best Seller",
      "None",
    ]),
    details: z.object({
      about: z
        .string()
        .min(100, "About section must be at least 100 characters"),
      itinerary: z.string().min(50, "Itinerary must be at least 50 characters"),
      pickupLocations: z
        .array(z.string().min(1))
        .min(1, "At least one pickup location is required"),
      pickupGuidelines: z.string().optional(),
      notes: z.array(z.string().min(1)).min(1, "At least one note is required"),
      includes: z
        .array(z.string().min(1))
        .min(1, "At least one included item is required"),
      faq: z.array(
        z.object({
          question: z.string().min(1, "Question is required"),
          answer: z.string().min(1, "Answer is required"),
        })
      ),
    }),
  })
  .refine(
    (data) => {
      if (data.newPrice > data.oldPrice) {
        return false;
      }
      return true;
    },
    {
      message: "New price must be less than or equal to old price",
      path: ["newPrice"],
    }
  )
  .refine(
    (data) => {
      if (data.type !== "private" && data.maximumPerson <= data.minimumPerson) {
        return false;
      }
      return true;
    },
    {
      message: "Maximum persons must be greater than minimum persons",
      path: ["maximumPerson"],
    }
  );

type TourFormData = z.infer<typeof tourSchema>;

// Collapsible Section Component
interface CollapsibleSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}

const CollapsibleSection = ({
  title,
  isExpanded,
  onToggle,
  children,
  className = "",
}: CollapsibleSectionProps) => {
  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors duration-200"
      >
        <h2 className="text-xl font-semibold text-left">{title}</h2>
        <div
          className={`transform transition-transform duration-300 ${
            isExpanded ? "rotate-180" : "rotate-0"
          }`}
        >
          <FiChevronDown className="text-gray-500" size={20} />
        </div>
      </button>
      <div
        className={`transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
        }`}
        style={{
          overflow: isExpanded ? "visible" : "hidden",
        }}
      >
        <div className="px-6 pb-6 border-t border-gray-100">
          <div className="pt-4">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default function EditTourPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [slugLoading, setSlugLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageUploading, setImageUploading] = useState(false);
  const [newTag, setNewTag] = useState("");

  // Section visibility states
  const [sectionsExpanded, setSectionsExpanded] = useState({
    basicInfo: true,
    pricing: false,
    statistics: false,
    departureTimes: false,
    tourDetails: false,
    faq: false,
  });

  const toggleSection = (section: keyof typeof sectionsExpanded) => {
    setSectionsExpanded((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const defaultValues: Partial<TourFormData> = {
    bookedCount: 0,
    rating: 0,
    reviewCount: 0,
    type: "co-tour",
    period: "Half-Day",
    label: "None",
    departureTimes: ["08:00 AM"],
    oldPrice: 0,
    newPrice: 0,
    childPrice: 0,
    minimumPerson: 2,
    maximumPerson: 15,
    vehicle: "",
    seatCapacity: 4,
    tags: [],
    details: {
      about: "",
      itinerary: "",
      pickupLocations: [""],
      pickupGuidelines: "",
      notes: [""],
      includes: [""],
      faq: [{ question: "", answer: "" }],
    },
  };

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<TourFormData>({
    resolver: zodResolver(tourSchema),
    defaultValues,
  });

  // Field arrays for dynamic lists
  const {
    fields: faqFields,
    append: appendFaq,
    remove: removeFaq,
  } = useFieldArray({
    control,
    name: "details.faq",
  });

  const watchTitle = watch("title");
  const watchType = watch("type");

  // Fetch existing tour data
  useEffect(() => {
    const fetchTourData = async () => {
      try {
        setIsLoading(true);
        const result = await tourApi.getTourById(params.id);
        const tourData = result.data;

        // Set image preview
        if (tourData.image) {
          setImagePreview(tourData.image);
        }

        // Reset form with tour data
        reset({
          title: tourData.title,
          slug: tourData.slug,
          image: tourData.image,
          tags: tourData.tags || [],
          description: tourData.description,
          type: tourData.type,
          duration: tourData.duration,
          period: tourData.period,
          bookedCount: tourData.bookedCount || 0,
          rating: tourData.rating || 0,
          reviewCount: tourData.reviewCount || 0,
          oldPrice: tourData.oldPrice,
          newPrice: tourData.newPrice,
          childPrice: tourData.childPrice,
          minimumPerson: tourData.minimumPerson,
          maximumPerson: tourData.maximumPerson,
          vehicle: tourData.vehicle || "",
          seatCapacity: tourData.seatCapacity || 4,
          departureTimes: tourData.departureTimes || ["08:00 AM"],
          label: tourData.label || "None",
          details: {
            about: tourData.details?.about || "",
            itinerary:
              tourData.details?.itinerary?.length > 0
                ? tourData.details.itinerary
                : [{ time: "08:00 AM", activity: "" }],
            pickupLocations:
              tourData.details?.pickupLocations?.length > 0
                ? tourData.details.pickupLocations
                : [""],
            pickupGuidelines: tourData.details?.pickupGuidelines || "",
            notes:
              tourData.details?.notes?.length > 0
                ? tourData.details.notes
                : [""],
            includes:
              tourData.details?.includes?.length > 0
                ? tourData.details.includes
                : [""],
            faq:
              tourData.details?.faq?.length > 0
                ? tourData.details.faq
                : [{ question: "", answer: "" }],
          },
        });

        toast.success("Tour data loaded successfully");
      } catch (error: any) {
        console.error("Error fetching tour:", error);
        toast.error(`Failed to load tour: ${error.message}`);
        router.push("/tours");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTourData();
  }, [params.id, reset, router]);

  // Auto-generate slug from title
  useEffect(() => {
    if (watchTitle && watchTitle.trim() !== "") {
      setSlugLoading(true);
      const timer = setTimeout(() => {
        const generatedSlug = watchTitle
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9 -]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-+|-+$/g, "");
        setValue("slug", generatedSlug);
        setSlugLoading(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [watchTitle, setValue]);

  // Handle adding tags
  const addTag = (field: any) => {
    if (newTag.trim() && !field.value?.includes(newTag.trim())) {
      field.onChange([...(field.value || []), newTag.trim()]);
      setNewTag("");
    } else if (field.value?.includes(newTag.trim())) {
      toast.error("Tag already exists");
    }
  };

  // Handle image upload
  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImageUploading(true);

      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);

      const formData = new FormData();
      formData.append("image", file);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${apiUrl}/api/upload/tour-image`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();
      setValue("image", result.data.imageUrl);
      toast.success("Image uploaded successfully!");
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error(`Failed to upload image: ${error.message}`);
      setImagePreview("");
      setValue("image", "");
    } finally {
      setImageUploading(false);
    }
  };

  const onSubmit = async (data: TourFormData) => {
    setIsSubmitting(true);
    try {
      // Filter out empty arrays
      const tourData = {
        ...data,
        packageType: "tour",
        details: {
          ...data.details,
          // itinerary is now a string, no filtering needed
          pickupLocations: data.details.pickupLocations.filter((loc) =>
            loc.trim()
          ),
          notes: data.details.notes.filter((note) => note.trim()),
          includes: data.details.includes.filter((inc) => inc.trim()),
          faq: data.details.faq.filter(
            (faq) => faq.question.trim() && faq.answer.trim()
          ),
        },
      };

      const result = await tourApi.updateTour(params.id, tourData);
      toast.success("Tour updated successfully! 🎉");
      router.push("/tours");
    } catch (error: any) {
      console.error("Error updating tour:", error);
      toast.error(`Failed to update tour: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tour data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Edit Tour</h1>
          <p className="text-gray-600 mt-2">Update the tour package details</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <CollapsibleSection
            title="Basic Information"
            isExpanded={sectionsExpanded.basicInfo}
            onToggle={() => toggleSection("basicInfo")}
          >
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  {...register("title")}
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter tour title"
                />
                {errors.title && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.title.message}
                  </p>
                )}
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Slug {slugLoading && "(generating...)"}
                </label>
                <input
                  {...register("slug")}
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                  placeholder="auto-generated-slug"
                  readOnly
                />
                {errors.slug && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.slug.message}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Short Description *
                </label>
                <textarea
                  {...register("description")}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Brief description for card preview (50-200 characters)"
                />
                {errors.description && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.description.message}
                  </p>
                )}
              </div>

              {/* Type & Period */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type *
                  </label>
                  <select
                    {...register("type")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="co-tour">Co-Tour</option>
                    <option value="private">Private</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Period *
                  </label>
                  <select
                    {...register("period")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Half-Day">Half-Day</option>
                    <option value="Full-Day">Full-Day</option>
                  </select>
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration * (e.g., "4 Hours", "5 Hours")
                </label>
                <input
                  {...register("duration")}
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 4 Hours"
                />
                {errors.duration && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.duration.message}
                  </p>
                )}
              </div>

              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Label
                </label>
                <select
                  {...register("label")}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="None">None</option>
                  <option value="Best Seller">Best Seller</option>
                  <option value="Popular">Popular</option>
                  <option value="Recommended">Recommended</option>
                  <option value="Best Value">Best Value</option>
                </select>
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tour Image *
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={imageUploading}
                />
                {imagePreview && (
                  <div className="mt-4">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-48 w-auto rounded-lg object-cover"
                    />
                  </div>
                )}
                {errors.image && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.image.message}
                  </p>
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags *
                </label>
                <Controller
                  name="tags"
                  control={control}
                  render={({ field }) => (
                    <div>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyPress={(e) =>
                            e.key === "Enter" &&
                            (e.preventDefault(), addTag(field))
                          }
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Add a tag"
                        />
                        <button
                          type="button"
                          onClick={() => addTag(field)}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                        >
                          <FiPlus />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {field.value?.map((tag, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-gray-100 rounded-full text-sm flex items-center gap-2"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => {
                                const newTags = [...field.value];
                                newTags.splice(index, 1);
                                field.onChange(newTags);
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <FiX size={14} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                />
                {errors.tags && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.tags.message}
                  </p>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* Pricing & Capacity */}
          <CollapsibleSection
            title="Pricing & Capacity"
            isExpanded={sectionsExpanded.pricing}
            onToggle={() => toggleSection("pricing")}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Old Price (RM) *
                  </label>
                  <input
                    {...register("oldPrice", { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.oldPrice && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.oldPrice.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Price (RM) *
                  </label>
                  <input
                    {...register("newPrice", { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.newPrice && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.newPrice.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Child Price (RM) *
                  </label>
                  <input
                    {...register("childPrice", { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.childPrice && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.childPrice.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Persons *
                  </label>
                  <input
                    {...register("minimumPerson", { valueAsNumber: true })}
                    type="number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.minimumPerson && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.minimumPerson.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Persons *
                  </label>
                  <input
                    {...register("maximumPerson", { valueAsNumber: true })}
                    type="number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.maximumPerson && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.maximumPerson.message}
                    </p>
                  )}
                </div>
              </div>

              {watchType === "private" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vehicle Name
                    </label>
                    <input
                      {...register("vehicle")}
                      type="text"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Land Rover"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Seat Capacity
                    </label>
                    <input
                      {...register("seatCapacity", { valueAsNumber: true })}
                      type="number"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Booking & Review Statistics */}
          <CollapsibleSection
            title="Booking & Review Statistics"
            isExpanded={sectionsExpanded.statistics}
            onToggle={() => toggleSection("statistics")}
          >
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> These values are used as initial
                  display counts. The booking count will auto-increment when
                  bookings are completed. Rating and review count should be set
                  initially and will be updated when reviews are submitted.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Initial Booked Count
                  </label>
                  <input
                    {...register("bookedCount", { valueAsNumber: true })}
                    type="number"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 100"
                  />
                  {errors.bookedCount && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.bookedCount.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Initial Rating (0-5)
                  </label>
                  <input
                    {...register("rating", { valueAsNumber: true })}
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 4.5"
                  />
                  {errors.rating && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.rating.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Initial Review Count
                  </label>
                  <input
                    {...register("reviewCount", { valueAsNumber: true })}
                    type="number"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 50"
                  />
                  {errors.reviewCount && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.reviewCount.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Departure Times */}
          <CollapsibleSection
            title="Departure Times"
            isExpanded={sectionsExpanded.departureTimes}
            onToggle={() => toggleSection("departureTimes")}
          >
            <div className="space-y-4">
              <Controller
                name="departureTimes"
                control={control}
                render={({ field }) => (
                  <div className="space-y-2">
                    {field.value?.map((time, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={time}
                          onChange={(e) => {
                            const newTimes = [...field.value];
                            newTimes[index] = e.target.value;
                            field.onChange(newTimes);
                          }}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., 08:00 AM"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newTimes = field.value.filter(
                              (_, i) => i !== index
                            );
                            field.onChange(newTimes);
                          }}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => field.onChange([...field.value, ""])}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
                    >
                      <FiPlus /> Add Departure Time
                    </button>
                  </div>
                )}
              />
              {errors.departureTimes && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.departureTimes.message}
                </p>
              )}
            </div>
          </CollapsibleSection>

          {/* Tour Details */}
          <CollapsibleSection
            title="Tour Details"
            isExpanded={sectionsExpanded.tourDetails}
            onToggle={() => toggleSection("tourDetails")}
          >
            <div className="space-y-6">
              {/* About */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  About This Tour *
                </label>
                <textarea
                  {...register("details.about")}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Brief introduction about the tour"
                />
                {errors.details?.about && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.details.about.message}
                  </p>
                )}
              </div>

              {/* Itinerary */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Itinerary *
                </label>
                <textarea
                  {...register("details.itinerary")}
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe the tour itinerary...&#10;&#10;Example:&#10;08:00 AM - Hotel Pickup&#10;09:00 AM - Visit Tea Plantation&#10;11:00 AM - Strawberry Farm&#10;12:30 PM - Lunch Break&#10;02:00 PM - Return to Hotel"
                />
                {errors.details?.itinerary && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.details.itinerary.message}
                  </p>
                )}
              </div>

              {/* Pickup Locations */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup Locations *
                </label>
                <Controller
                  name="details.pickupLocations"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      {field.value?.map((location, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={location}
                            onChange={(e) => {
                              const newLocations = [...field.value];
                              newLocations[index] = e.target.value;
                              field.onChange(newLocations);
                            }}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., Tanah Rata Town Center"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newLocations = field.value.filter(
                                (_, i) => i !== index
                              );
                              field.onChange(newLocations);
                            }}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => field.onChange([...field.value, ""])}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
                      >
                        <FiPlus /> Add Pickup Location
                      </button>
                    </div>
                  )}
                />
                {errors.details?.pickupLocations && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.details.pickupLocations.message}
                  </p>
                )}
              </div>

              {/* Includes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What's Included *
                </label>
                <Controller
                  name="details.includes"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      {field.value?.map((include, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={include}
                            onChange={(e) => {
                              const newIncludes = [...field.value];
                              newIncludes[index] = e.target.value;
                              field.onChange(newIncludes);
                            }}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., Professional guide"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newIncludes = field.value.filter(
                                (_, i) => i !== index
                              );
                              field.onChange(newIncludes);
                            }}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => field.onChange([...field.value, ""])}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
                      >
                        <FiPlus /> Add Included Item
                      </button>
                    </div>
                  )}
                />
                {errors.details?.includes && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.details.includes.message}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Important Notes *
                </label>
                <Controller
                  name="details.notes"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      {field.value?.map((note, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={note}
                            onChange={(e) => {
                              const newNotes = [...field.value];
                              newNotes[index] = e.target.value;
                              field.onChange(newNotes);
                            }}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., Wear comfortable shoes"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newNotes = field.value.filter(
                                (_, i) => i !== index
                              );
                              field.onChange(newNotes);
                            }}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => field.onChange([...field.value, ""])}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
                      >
                        <FiPlus /> Add Note
                      </button>
                    </div>
                  )}
                />
                {errors.details?.notes && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.details.notes.message}
                  </p>
                )}
              </div>

              {/* Pickup Guidelines */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup Guidelines (Optional)
                </label>
                <textarea
                  {...register("details.pickupGuidelines")}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Special instructions for pickup"
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* FAQ */}
          <CollapsibleSection
            title="FAQ (Optional)"
            isExpanded={sectionsExpanded.faq}
            onToggle={() => toggleSection("faq")}
          >
            <div className="space-y-4">
              {faqFields.map((field, index) => (
                <div
                  key={field.id}
                  className="space-y-2 p-4 border border-gray-200 rounded-lg"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Question
                    </label>
                    <input
                      {...register(`details.faq.${index}.question` as const)}
                      type="text"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter question"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Answer
                    </label>
                    <textarea
                      {...register(`details.faq.${index}.answer` as const)}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter answer"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFaq(index)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
                  >
                    <FiTrash2 /> Remove FAQ
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => appendFaq({ question: "", answer: "" })}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
              >
                <FiPlus /> Add FAQ
              </button>
            </div>
          </CollapsibleSection>

          {/* Submit Button */}
          <div className="flex justify-end gap-4 pt-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Updating..." : "Update Tour"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
