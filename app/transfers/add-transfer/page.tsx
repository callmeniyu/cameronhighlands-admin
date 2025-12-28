"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FiPlus,
  FiX,
  FiClock,
  FiUsers,
  FiTag,
  FiDollarSign,
  FiUpload,
  FiImage,
  FiChevronDown,
  FiMapPin,
  FiCheck,
} from "react-icons/fi";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { toast } from "react-hot-toast";
import TransferCardPreview from "@/components/TransferCardPreview";
import RichTextEditor from "@/components/RichTextEditor";
import Confirmation from "@/components/ui/Confirmation";
import { generateSlug, debounce } from "@/lib/utils";
import { transferApi } from "@/lib/transferApi";
import { useForm as useHookForm } from "react-hook-form";
import { stripHtmlTags } from "@/lib/htmlValidation";

// Schema validation
const transferSchema = z
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
      .max(110, "Description cannot exceed 110 characters"),
    type: z.enum(["Van", "Van + Ferry", "Private"]),
    vehicle: z.string().optional(), // Vehicle name for private transfers
    from: z.string().min(2, "From location is required"),
    to: z.string().min(2, "To location is required"),
    duration: z.string().min(1, "Duration is required"),
    bookedCount: z.number().min(0),
    rating: z.number().min(0).max(5).optional(),
    reviewCount: z.number().min(0).optional(),
    oldPrice: z.number().min(0, "Old price must be 0 or greater"),
    newPrice: z.number().min(0, "New price must be 0 or greater"),
    childPrice: z
      .number()
      .min(0, "Child price must be 0 or greater")
      .optional(),
    minimumPerson: z
      .number()
      .min(1, "Minimum must be at least 1 person")
      .optional(),
    maximumPerson: z
      .number()
      .min(1, "Maximum must be at least 1 person")
      .optional(),
    seatCapacity: z.number().min(1, "Seat capacity must be at least 1"),
    departureTimes: z
      .array(z.string())
      .min(1, "At least one departure time is required"),
    label: z.enum([
      "Recommended",
      "Popular",
      "Best Value",
      "Best seller",
      "None",
    ]),
    details: z.object({
      about: z
        .string()
        .refine(
          (val) => stripHtmlTags(val).length >= 100,
          "About section must be at least 100 characters"
        ),
      itinerary: z
        .string()
        .refine(
          (val) => stripHtmlTags(val).length >= 100,
          "Itinerary must be at least 100 characters"
        ),
      pickupOption: z.enum(["admin", "user"]),
      pickupLocation: z.string().optional(), // Make optional, validate conditionally
      dropOffLocation: z.string().optional(),
      pickupGuidelines: z
        .string()
        .refine(
          (val) => !val || stripHtmlTags(val).length >= 15,
          "Pickup guidelines must be at least 15 characters"
        ),
      note: z
        .string()
        .refine(
          (val) => stripHtmlTags(val).length >= 10,
          "Note must be at least 10 characters"
        ),
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
      // Validate required fields for non-Private transfers
      if (data.type !== "Private") {
        return (
          data.childPrice !== undefined &&
          data.minimumPerson !== undefined &&
          data.maximumPerson !== undefined
        );
      }
      return true;
    },
    {
      message:
        "Child price, minimum persons, and maximum persons are required for non-Private transfers",
      path: ["type"],
    }
  )
  .refine(
    (data) => {
      // Only validate minimum/maximum for non-Private transfers
      if (
        data.type !== "Private" &&
        data.maximumPerson &&
        data.minimumPerson &&
        data.maximumPerson <= data.minimumPerson
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Maximum persons must be greater than minimum persons",
      path: ["maximumPerson"],
    }
  )
  .refine(
    (data) => {
      if (data.from.toLowerCase() === data.to.toLowerCase()) {
        return false;
      }
      return true;
    },
    {
      message: "From and To locations must be different",
      path: ["to"],
    }
  )
  .refine(
    (data) => {
      // For admin-defined pickup, only location is required
      if (data.details.pickupOption === "admin") {
        return (
          data.details.pickupLocation &&
          data.details.pickupLocation.length >= 10
        );
      }
      return true; // No validation needed for user-defined here
    },
    {
      message: "Pickup location must be at least 10 characters",
      path: ["details.pickupLocation"],
    }
  )
  .refine(
    (data) => {
      // Pickup description (guidelines) is now always required with 15 characters minimum
      return (
        data.details.pickupGuidelines &&
        data.details.pickupGuidelines.length >= 15
      );
    },
    {
      message: "Pickup guidelines must be at least 15 characters",
      path: ["details.pickupGuidelines"],
    }
  )
  .refine(
    (data) => {
      // Vehicle is required for Private transfers
      if (data.type === "Private") {
        return data.vehicle && data.vehicle.length >= 2;
      }
      return true;
    },
    {
      message: "Vehicle name is required for private transfers",
      path: ["vehicle"],
    }
  );

type TransferFormData = z.infer<typeof transferSchema>;

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
        className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:bg-gray-50"
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
          isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
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

export default function AddTransferPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [vehicleSubmitting, setVehicleSubmitting] = useState(false);
  const [vehicleName, setVehicleName] = useState("");
  const [vehicleUnits, setVehicleUnits] = useState(1);
  const [vehicleSeats, setVehicleSeats] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugLoading, setSlugLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageUploading, setImageUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>("");
  const [newTag, setNewTag] = useState("");
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const [validationSuccess, setValidationSuccess] = useState(false);

  // Section visibility states
  const [sectionsExpanded, setSectionsExpanded] = useState({
    basicInfo: true,
    routeInfo: true,
    pricing: false,
    statistics: false,
    departureTimes: false,
    transferDetails: false,
    faq: false,
  });

  const toggleSection = (section: keyof typeof sectionsExpanded) => {
    setSectionsExpanded((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const defaultValues = {
    bookedCount: 0,
    rating: 0,
    reviewCount: 0,
    type: "Van" as const,
    vehicle: "", // Vehicle name for private transfers
    label: "None" as const,
    departureTimes: ["08:00"],
    oldPrice: 0,
    newPrice: 0,
    childPrice: 0,
    minimumPerson: 1,
    maximumPerson: 10,
    seatCapacity: 4,
    tags: [],
    from: "",
    to: "",
    details: {
      about: "",
      itinerary: "",
      dropOffLocation: "",
      pickupOption: "admin" as "admin" | "user",
      pickupLocation: "",
      pickupGuidelines: "",
      note: "",
      faq: [{ question: "", answer: "" }],
    },
  };

  // Fetch vehicles for private transfer selection
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/vehicles`
        );
        const data = await res.json();
        if (data.success) setVehicles(data.data || []);
      } catch (err) {
        console.error("Failed to fetch vehicles", err);
      }
    };
    fetchVehicles();
  }, []);

  const createVehicle = async () => {
    if (!vehicleName.trim()) return toast.error("Vehicle name required");
    setVehicleSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/vehicles`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: vehicleName.trim(),
            units: vehicleUnits,
            seats: vehicleSeats,
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setVehicles((v) => [...v, data.data]);
        setShowAddVehicle(false);
        setVehicleName("");
        setVehicleSeats(4);
        setVehicleUnits(1);
        toast.success("Vehicle created");
      } else {
        toast.error(data.message || "Failed to create vehicle");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to create vehicle");
    } finally {
      setVehicleSubmitting(false);
    }
  };

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    getValues,
    reset,
    trigger,
    clearErrors,
    formState: { errors, isValid },
  } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "details.faq",
  });

  const watchTitle = watch("title");
  const watchType = watch("type");
  const watchDescription = watch("description");
  const watchImage = watch("image");
  const watchTags = watch("tags");
  const watchDuration = watch("duration");
  const watchBookedCount = watch("bookedCount");
  const watchOldPrice = watch("oldPrice");
  const watchNewPrice = watch("newPrice");
  const watchChildPrice = watch("childPrice");
  const watchLabel = watch("label");
  const watchSlug = watch("slug");
  const watchFrom = watch("from");
  const watchTo = watch("to");
  const watchPickupOption = watch("details.pickupOption");
  const watchMinimumPerson = watch("minimumPerson");
  const watchMaximumPerson = watch("maximumPerson");
  const watchSeatCapacity = watch("seatCapacity");
  const watchDepartureTimes = watch("departureTimes");
  const watchDetailsAbout = watch("details.about");
  const watchDetailsItinerary = watch("details.itinerary");
  const watchDetailsPickupLocation = watch("details.pickupLocation");
  const watchDetailsDropOffLocation = watch("details.dropOffLocation");
  const watchDetailsPickupGuidelines = watch("details.pickupGuidelines");
  const watchDetailsNote = watch("details.note");
  const watchDetailsFaq = watch("details.faq");

  // Hide validation errors when user starts making changes
  useEffect(() => {
    if (showValidationErrors) {
      const timer = setTimeout(() => {
        setShowValidationErrors(false);
      }, 2000); // Hide errors after 2 seconds of making changes

      return () => clearTimeout(timer);
    }
  }, [showValidationErrors]);

  // Reset validation state when any form field changes
  useEffect(() => {
    if (hasValidated) {
      console.log("Transfer form field changed - resetting validation state");
      setHasValidated(false);
      setValidationSuccess(false);
      setShowValidationErrors(false);
    }
  }, [
    watchTitle,
    watchType,
    watchDescription,
    watchImage,
    watchTags,
    watchDuration,
    watchBookedCount,
    watchOldPrice,
    watchNewPrice,
    watchChildPrice,
    watchLabel,
    watchSlug,
    watchFrom,
    watchTo,
    watchPickupOption,
    watchMinimumPerson,
    watchMaximumPerson,
    watchDepartureTimes,
    watchDetailsAbout,
    watchDetailsItinerary,
    watchDetailsPickupLocation,
    watchDetailsPickupGuidelines,
    watchDetailsNote,
    watchDetailsFaq,
    // Note: hasValidated is not included in dependencies to prevent interference with validation
  ]);

  // Auto-hide validation errors after 8 seconds
  useEffect(() => {
    if (showValidationErrors && !validationSuccess) {
      const timer = setTimeout(() => {
        setShowValidationErrors(false);
      }, 8000); // 8 seconds for error messages

      return () => clearTimeout(timer);
    }
  }, [showValidationErrors, validationSuccess]);

  // Clear vehicle field when transfer type changes from Private to other types
  useEffect(() => {
    if (watchType !== "Private") {
      setValue("vehicle", "");
      clearErrors("vehicle");
    }
  }, [watchType, setValue, clearErrors]);

  // Set minimumPerson to 1 for Private transfers (vehicle booking, not person-based)
  useEffect(() => {
    if (watchType === "Private") {
      setValue("minimumPerson", 1);
      clearErrors("minimumPerson");
    }
  }, [watchType, setValue, clearErrors]);

  // Clear form function
  const handleClearForm = () => {
    setShowClearConfirmation(true);
  };

  const confirmClearForm = () => {
    try {
      // Reset other states first
      setImagePreview("");
      setUploadedImageUrl("");
      setImageUploading(false);
      setNewTag("");
      setHasValidated(false);
      setValidationSuccess(false);

      // Reset section expansion to default
      setSectionsExpanded({
        basicInfo: true,
        routeInfo: true,
        pricing: false,
        statistics: false,
        departureTimes: false,
        transferDetails: false,
        faq: false,
      });

      // Reset form to default values
      reset(defaultValues);

      toast.success("Form cleared! 🗑️", {
        duration: 3000,
      });
    } catch (error) {
      console.error("Error clearing form:", error);
      toast.error("Failed to clear form. Please try again. ❌", {
        duration: 3000,
      });
    }
  };

  // Handle adding tags
  const addTag = (field: any) => {
    if (newTag.trim() && !field.value?.includes(newTag.trim())) {
      field.onChange([...(field.value || []), newTag.trim()]);
      setNewTag("");
    } else if (field.value?.includes(newTag.trim())) {
      toast.error("Tag already exists ⚠️", {
        duration: 3000,
      });
    } else if (!newTag.trim()) {
      toast.error("Please enter a tag name ⚠️", {
        duration: 3000,
      });
    }
  };

  // Handle image upload
  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file ⚠️", {
        duration: 3000,
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB ⚠️", {
        duration: 4000,
      });
      return;
    }

    setImageUploading(true);
    setImagePreview(URL.createObjectURL(file));

    try {
      const response = await transferApi.uploadImage(file);

      if (response.success) {
        setUploadedImageUrl(response.data.imageUrl);
        setValue("image", response.data.imageUrl);
        clearErrors("image");
        toast.success("Image uploaded successfully! 📸", {
          duration: 3000,
        });
      } else {
        throw new Error("Failed to upload image");
      }
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error(
        error.message || "Failed to upload image. Please try again. ❌",
        {
          duration: 4000,
        }
      );
      // Clear preview on error
      setImagePreview("");
      setUploadedImageUrl("");
    } finally {
      setImageUploading(false);
    }
  };

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
          .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
        setValue("slug", generatedSlug);
        setSlugLoading(false);
      }, 500);

      return () => clearTimeout(timer);
    } else if (!watchTitle || watchTitle.trim() === "") {
      // Clear slug if title is empty
      setValue("slug", "");
      setSlugLoading(false);
    }
  }, [watchTitle, setValue]);

  const handleSaveTransfer = async () => {
    // Only proceed if form has been validated and passed
    if (!hasValidated || !validationSuccess) {
      toast.error("Please validate the form first ⚠️", {
        duration: 4000,
      });
      return;
    }

    // All validation passed, proceed with saving
    const currentData = getValues();
    onSubmit(currentData);
  };

  const onSubmit = async (data: TransferFormData) => {
    try {
      // Check if image is uploaded to Cloudinary
      if (!uploadedImageUrl) {
        toast.error("Please wait for the image to finish uploading", {
          duration: 3000,
        });
        return;
      }

      setIsSubmitting(true);

      // All validation already done in handleSaveTransfer
      const validFaqs = data.details.faq.filter(
        (faq) => faq.question.trim() && faq.answer.trim()
      );

      // Prepare transfer data for API
      const transferData = {
        ...data,
        // Use Cloudinary URL for upload method, or use the URL/preview for URL method
        image: uploadedImageUrl,
        details: {
          ...data.details,
          faq: validFaqs,
          // For admin-defined pickup: save both pickupLocation and pickupGuidelines
          // For user-defined pickup: save only pickupGuidelines to pickupLocations field
          pickupLocations:
            data.details.pickupOption === "admin"
              ? data.details.pickupLocation || ""
              : data.details.pickupGuidelines || "",
          // Only save pickupGuidelines for admin-defined pickup
          pickupGuidelines:
            data.details.pickupOption === "admin"
              ? data.details.pickupGuidelines || ""
              : undefined,
          // Drop-off locations (admin-entered)
          dropOffLocations: data.details.dropOffLocation || "",
        },
        // Map form field names to API field names
        desc: data.description,
        times: data.departureTimes,
      };

      console.log("Transfer data before processing:", transferData); // Debug log

      // Remove the form-specific fields that don't exist in the API (but keep vehicle)
      const {
        description,
        departureTimes,
        details: { pickupLocation, pickupGuidelines, ...detailsRest },
        ...rest
      } = transferData;
      const finalTransferData = {
        ...rest,
        details: {
          ...detailsRest,
          // Preserve the pickup fields we prepared above
          pickupLocations: transferData.details.pickupLocations,
          pickupGuidelines: transferData.details.pickupGuidelines,
          dropOffLocations: transferData.details.dropOffLocations,
        },
        desc: description,
        times: departureTimes,
        // ensure vehicle is explicitly preserved
        vehicle: data.vehicle || rest.vehicle || "",
        // include seatCapacity if provided
        seatCapacity:
          data.seatCapacity || (rest as any).seatCapacity || undefined,
      };
      console.log("Final transfer data:", finalTransferData); // Debug log
      console.log("Pickup fields being saved:", {
        pickupOption: data.details.pickupOption,
        pickupLocations: finalTransferData.details.pickupLocations,
        pickupGuidelines: finalTransferData.details.pickupGuidelines,
      }); // Debug log for pickup fields

      // Call the API to create the transfer
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
      const response = await fetch(`${apiUrl}/api/transfers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(finalTransferData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create transfer");
      }

      const result = await response.json();

      console.log("Transfer submitted successfully"); // Debug log
      toast.success("Transfer created successfully! 🚐", {
        duration: 4000,
      });
      router.push("/transfers");
    } catch (error) {
      console.error("Error creating transfer:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create transfer. Please try again. ❌",
        {
          duration: 4000,
        }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle validation button click
  const handleShowErrors = async () => {
    // Trigger validation
    const isFormValid = await trigger();

    // Additional custom validation
    if (isFormValid) {
      const currentData = getValues();
      const validFaqs = currentData.details.faq.filter(
        (faq) => faq.question.trim() && faq.answer.trim()
      );
      if (validFaqs.length === 0) {
        setValidationSuccess(false);
      } else {
        setValidationSuccess(true);
      }
    } else {
      setValidationSuccess(false);
    }

    // Show validation results
    setShowValidationErrors(true);
    setHasValidated(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Add New Transfer
              </h1>
              <p className="text-gray-600 mt-2">
                Create and configure a new transfer service
              </p>
            </div>
            <div className="hidden md:flex space-x-4">
              <button
                type="button"
                onClick={handleClearForm}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 flex items-center space-x-2"
              >
                <FiX size={16} />
                <span>Clear Form</span>
              </button>
              <button
                type="button"
                onClick={handleShowErrors}
                className="px-4 py-2 bg-green-100/50 text-primary rounded-lg transition-colors duration-200 flex items-center space-x-2"
              >
                <FiCheck size={16} />
                <span>Validate</span>
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Transfer Info */}
            <div className="lg:col-span-2 space-y-6">
              <CollapsibleSection
                title="Basic Information"
                isExpanded={sectionsExpanded.basicInfo}
                onToggle={() => toggleSection("basicInfo")}
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Transfer Title *
                    </label>
                    <input
                      {...register("title")}
                      type="text"
                      className={`w-full px-3 py-2 border rounded-md ${
                        errors.title ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="E.g., Private Van Transfer from Kuala Lumpur to Cameron Highlands"
                    />
                    <div className="flex justify-between mt-1">
                      <p className="text-xs text-red-500">
                        {errors.title?.message}
                      </p>
                      <div className="flex justify-between w-full">
                        <p className="text-xs text-gray-500">
                          {watchTitle?.length || 0}/100
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Slug *
                    </label>
                    <div className="relative">
                      <input
                        {...register("slug")}
                        type="text"
                        className={`w-full px-3 py-2 border rounded-md ${
                          errors.slug ? "border-red-500" : "border-gray-300"
                        } ${slugLoading ? "bg-gray-50" : ""}`}
                        disabled={slugLoading}
                        placeholder="Auto-generated from title"
                      />
                      {slugLoading && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-red-500 mt-1">
                      {errors.slug?.message}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description*
                    </label>
                    <textarea
                      {...register("description")}
                      className={`w-full px-3 py-2 border rounded-md resize-none ${
                        errors.description
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                      rows={3}
                      placeholder="Brief description of the transfer service (50-110 characters)"
                    />
                    <div className="flex justify-between mt-1">
                      <p className="text-xs text-red-500">
                        {errors.description?.message}
                      </p>
                      <p className="text-xs text-gray-500">
                        {watch("description")?.length || 0}/110
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <FiImage className="inline mr-2" />
                      Transfer Image *
                    </label>

                    {/* Upload File */}
                    <div
                      className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition-colors ${
                        imageUploading
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary"
                      }`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                        disabled={imageUploading}
                      />
                      <label
                        htmlFor="image-upload"
                        className={`cursor-pointer ${
                          imageUploading ? "pointer-events-none" : ""
                        }`}
                      >
                        {imageUploading ? (
                          <>
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-2"></div>
                            <p className="text-sm text-primary font-medium">
                              Uploading image...
                            </p>
                            <p className="text-xs text-gray-400">Please wait</p>
                          </>
                        ) : (
                          <>
                            <FiUpload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-600">
                              Click to upload or drag and drop
                            </p>
                            <p className="text-xs text-gray-400">
                              PNG, JPG, JPEG up to 5MB
                            </p>
                          </>
                        )}
                      </label>
                    </div>

                    {/* Image Preview */}
                    {imagePreview && (
                      <div className="mt-4">
                        <div className="relative">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full h-48 object-cover rounded-lg"
                          />
                          {uploadedImageUrl && (
                            <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs flex items-center space-x-1">
                              <FiCheck size={12} />
                              <span>Uploaded</span>
                            </div>
                          )}
                          {imageUploading && (
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-lg">
                              <div className="bg-white px-3 py-2 rounded-lg flex items-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                <span className="text-sm">Uploading...</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-red-500 mt-1">
                      {errors.image?.message}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tags *
                    </label>
                    <Controller
                      name="tags"
                      control={control}
                      render={({ field }) => (
                        <div>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {field.value?.map((tag, index) => (
                              <div
                                key={index}
                                className="bg-primary/10 text-primary px-3 py-1 rounded-full flex items-center"
                              >
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newTags = [...field.value];
                                    newTags.splice(index, 1);
                                    field.onChange(newTags);
                                  }}
                                  className="ml-2 text-primary/70 hover:text-primary"
                                >
                                  <FiX size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newTag}
                              onChange={(e) => setNewTag(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addTag(field);
                                }
                              }}
                              className="w-full md:flex-1 px-3 py-2 border border-gray-300 rounded-md"
                              placeholder="Eg: Scenic, Private, Ferry"
                            />
                            <button
                              type="button"
                              onClick={() => addTag(field)}
                              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark flex items-center gap-2"
                            >
                              <FiPlus size={16} />
                              Add
                            </button>
                          </div>
                        </div>
                      )}
                    />
                    <p className="text-xs text-red-500 mt-1">
                      {errors.tags?.message}
                    </p>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Route Information */}
              <CollapsibleSection
                title="Route Information"
                isExpanded={sectionsExpanded.routeInfo}
                onToggle={() => toggleSection("routeInfo")}
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        From *
                      </label>
                      <div className="relative">
                        <input
                          {...register("from")}
                          type="text"
                          className={`w-full px-3 py-2 border rounded-md ${
                            errors.from ? "border-red-500" : "border-gray-300"
                          }`}
                          placeholder="E.g., Kuala Lumpur International Airport"
                        />
                        <FiMapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      </div>
                      <p className="text-xs text-red-500 mt-1">
                        {errors.from?.message}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        To *
                      </label>
                      <div className="relative">
                        <input
                          {...register("to")}
                          type="text"
                          className={`w-full px-3 py-2 border rounded-md ${
                            errors.to ? "border-red-500" : "border-gray-300"
                          }`}
                          placeholder="E.g., Cameron Highlands"
                        />
                        <FiMapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      </div>
                      <p className="text-xs text-red-500 mt-1">
                        {errors.to?.message}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration (hours) *
                    </label>
                    <div className="relative">
                      <input
                        {...register("duration")}
                        type="text"
                        className={`w-full px-3 py-2 border rounded-md ${
                          errors.duration ? "border-red-500" : "border-gray-300"
                        }`}
                        placeholder="E.g. 3, 3-4"
                      />
                      <FiClock className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    </div>
                    <p className="text-xs text-red-500 mt-1">
                      {errors.duration?.message}
                    </p>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Pricing & Availability */}
              <CollapsibleSection
                title="Pricing & Availability"
                isExpanded={sectionsExpanded.pricing}
                onToggle={() => toggleSection("pricing")}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Transfer Type *
                    </label>
                    <select
                      {...register("type")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="Van">Van</option>
                      <option value="Van + Ferry">Van + Ferry</option>
                      <option value="Private">Private</option>
                    </select>
                  </div>

                  {/* Vehicle field - only show for Private transfers */}
                  {watchType === "Private" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Vehicle *
                      </label>
                      <div className="flex gap-2">
                        <select
                          {...register("vehicle")}
                          onChange={(e) => {
                            const val = e.target.value;
                            // find vehicle and set seatCapacity accordingly
                            const v = vehicles.find(
                              (x) => x._id === val || x.name === val
                            );
                            if (v) {
                              setValue("seatCapacity", Number(v.seats));
                            }
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">Select a vehicle</option>
                          {vehicles.map((v) => (
                            <option key={v._id} value={v.name}>
                              {v.name} ({v.units} units • {v.seats} seats)
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setShowAddVehicle(true)}
                          className="px-3 py-2 bg-primary text-white rounded-md"
                        >
                          <FiPlus />
                        </button>
                      </div>
                      {errors.vehicle && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.vehicle.message}
                        </p>
                      )}

                      {/* Add Vehicle Modal (popup) */}
                      {showAddVehicle && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center">
                          {/* backdrop */}
                          <div
                            className="absolute inset-0 bg-black/40"
                            onClick={() => setShowAddVehicle(false)}
                          />
                          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6 z-10">
                            <h4 className="text-lg font-semibold">
                              Add new vehicle
                            </h4>
                            <div className="mt-4 space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  1. Vehicle name
                                </label>
                                <input
                                  value={vehicleName}
                                  onChange={(e) =>
                                    setVehicleName(e.target.value)
                                  }
                                  placeholder="e.g., Toyota Innova"
                                  className="w-full px-3 py-2 border rounded-md"
                                  required
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  2. Units (number of identical vehicles)
                                </label>
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    aria-label="decrease units"
                                    onClick={() =>
                                      setVehicleUnits(
                                        Math.max(1, vehicleUnits - 1)
                                      )
                                    }
                                    className="px-3 py-1 border rounded-md"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    value={vehicleUnits}
                                    onChange={(e) =>
                                      setVehicleUnits(
                                        Math.max(1, Number(e.target.value || 1))
                                      )
                                    }
                                    min={1}
                                    className="w-20 px-2 py-1 border rounded-md text-center"
                                  />
                                  <button
                                    type="button"
                                    aria-label="increase units"
                                    onClick={() =>
                                      setVehicleUnits(vehicleUnits + 1)
                                    }
                                    className="px-3 py-1 border rounded-md"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  3. Seats (per vehicle)
                                </label>
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    aria-label="decrease seats"
                                    onClick={() =>
                                      setVehicleSeats(
                                        Math.max(1, vehicleSeats - 1)
                                      )
                                    }
                                    className="px-3 py-1 border rounded-md"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    value={vehicleSeats}
                                    onChange={(e) =>
                                      setVehicleSeats(
                                        Math.max(1, Number(e.target.value || 1))
                                      )
                                    }
                                    min={1}
                                    className="w-20 px-2 py-1 border rounded-md text-center"
                                  />
                                  <button
                                    type="button"
                                    aria-label="increase seats"
                                    onClick={() =>
                                      setVehicleSeats(vehicleSeats + 1)
                                    }
                                    className="px-3 py-1 border rounded-md"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              <div className="mt-2 flex justify-end gap-3">
                                <button
                                  type="button"
                                  onClick={() => setShowAddVehicle(false)}
                                  className="px-4 py-2 border rounded-md"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={createVehicle}
                                  disabled={vehicleSubmitting}
                                  className="px-4 py-2 bg-primary text-white rounded-md"
                                >
                                  {vehicleSubmitting
                                    ? "Creating..."
                                    : "Create vehicle"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Label
                    </label>
                    <select
                      {...register("label")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="None">None</option>
                      <option value="Recommended">Recommended</option>
                      <option value="Popular">Popular</option>
                      <option value="Best Value">Best Value</option>
                      <option value="Best seller">Best seller</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Old Price (RM) *
                    </label>
                    <div className="relative">
                      <input
                        {...register("oldPrice", { valueAsNumber: true })}
                        type="number"
                        min="0"
                        step="0.01"
                        className={`w-full px-3 py-2 border rounded-md ${
                          errors.oldPrice ? "border-red-500" : "border-gray-300"
                        }`}
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-xs text-red-500 mt-1">
                      {errors.oldPrice?.message}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Price (RM) *
                    </label>
                    <div className="relative">
                      <input
                        {...register("newPrice", { valueAsNumber: true })}
                        type="number"
                        min="0"
                        step="0.01"
                        className={`w-full px-3 py-2 border rounded-md ${
                          errors.newPrice ? "border-red-500" : "border-gray-300"
                        }`}
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-xs text-red-500 mt-1">
                      {errors.newPrice?.message}
                    </p>
                  </div>

                  {/* Conditionally show child price field only for non-private transfers */}
                  {watchType !== "Private" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Child Price (RM) *
                      </label>
                      <div className="relative">
                        <input
                          {...register("childPrice", { valueAsNumber: true })}
                          type="number"
                          min="0"
                          step="0.01"
                          className={`w-full px-3 py-2 border rounded-md ${
                            errors.childPrice
                              ? "border-red-500"
                              : "border-gray-300"
                          }`}
                          placeholder="0.00"
                        />
                      </div>
                      <p className="text-xs text-red-500 mt-1">
                        {errors.childPrice?.message}
                      </p>
                    </div>
                  )}

                  {/* Conditionally show minimum persons field only for non-private transfers */}
                  {watchType !== "Private" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Minimum Persons *
                      </label>
                      <div className="relative">
                        <input
                          {...register("minimumPerson", {
                            valueAsNumber: true,
                          })}
                          type="number"
                          min="1"
                          step="1"
                          className={`w-full px-3 py-2 border rounded-md ${
                            errors.minimumPerson
                              ? "border-red-500"
                              : "border-gray-300"
                          }`}
                          placeholder="1"
                        />
                        <FiUsers className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      </div>
                      <p className="text-xs text-red-500 mt-1">
                        {errors.minimumPerson?.message}
                      </p>
                    </div>
                  )}

                  {/* Conditionally show maximum persons field only for non-private transfers */}
                  {watchType !== "Private" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Maximum Persons *
                      </label>
                      <div className="relative">
                        <input
                          {...register("maximumPerson", {
                            valueAsNumber: true,
                          })}
                          type="number"
                          min="1"
                          step="1"
                          className={`w-full px-3 py-2 border rounded-md ${
                            errors.maximumPerson
                              ? "border-red-500"
                              : "border-gray-300"
                          }`}
                          placeholder="10"
                        />
                        <FiUsers className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      </div>
                      <p className="text-xs text-red-500 mt-1">
                        {errors.maximumPerson?.message}
                      </p>
                    </div>
                  )}

                  {/* Seat Capacity removed: using vehicle's seats from created vehicle instead */}
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
                      bookings are completed. Rating and review count should be
                      set initially and will be updated when reviews are
                      submitted.
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
                <div>
                  <Controller
                    name="departureTimes"
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-3">
                        {field.value.map((time, index) => (
                          <div
                            key={index}
                            className="flex items-center space-x-3"
                          >
                            <input
                              type="time"
                              value={time}
                              onChange={(e) => {
                                const newTimes = [...field.value];
                                newTimes[index] = e.target.value;
                                field.onChange(newTimes);
                              }}
                              className="px-3 py-2 border border-gray-300 rounded-md"
                            />
                            {field.value.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newTimes = [...field.value];
                                  newTimes.splice(index, 1);
                                  field.onChange(newTimes);
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                <FiX />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            field.onChange([...field.value, "08:00"])
                          }
                          className="text-primary hover:text-primary-dark flex items-center text-sm"
                        >
                          <FiPlus className="mr-1" /> Add another time
                        </button>
                      </div>
                    )}
                  />
                  <p className="text-xs text-red-500 mt-1">
                    {errors.departureTimes?.message}
                  </p>
                </div>
              </CollapsibleSection>

              {/* Transfer Details */}
              <CollapsibleSection
                title="Transfer Details"
                isExpanded={sectionsExpanded.transferDetails}
                onToggle={() => toggleSection("transferDetails")}
              >
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      About This Transfer *
                    </label>
                    <Controller
                      name="details.about"
                      control={control}
                      render={({ field }) => (
                        <RichTextEditor
                          content={field.value || ""}
                          onChange={(content) => {
                            field.onChange(content);
                          }}
                          placeholder="Describe what makes this transfer service special..."
                          error={!!errors.details?.about}
                          contentClassName="focus:outline-none min-h-[120px] p-4 text-sm leading-6"
                        />
                      )}
                    />
                    <p className="text-xs text-red-500 mt-1">
                      {errors.details?.about?.message}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Route & Schedule *
                    </label>
                    <Controller
                      name="details.itinerary"
                      control={control}
                      render={({ field }) => (
                        <RichTextEditor
                          content={field.value || ""}
                          onChange={(content) => {
                            field.onChange(content);
                          }}
                          placeholder="Detail the transfer route, stops, and schedule..."
                          error={!!errors.details?.itinerary}
                          contentClassName="focus:outline-none min-h-[120px] p-4 text-sm leading-6"
                        />
                      )}
                    />
                    <p className="text-xs text-red-500 mt-1">
                      {errors.details?.itinerary?.message}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Drop-off Location (optional)
                    </label>
                    <Controller
                      name="details.dropOffLocation"
                      control={control}
                      render={({ field }) => (
                        <RichTextEditor
                          content={field.value || ""}
                          onChange={(content) => field.onChange(content)}
                          placeholder="Provide drop-off location details if applicable..."
                          error={false}
                          contentClassName="focus:outline-none min-h-[120px] p-4 text-sm leading-6"
                        />
                      )}
                    />
                    <p className="text-xs text-red-500 mt-1">
                      {errors.details?.dropOffLocation?.message}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Pickup Location Management *
                    </label>

                    {/* Pickup Option Selector */}
                    <div className="mb-4">
                      <div className="flex gap-4 mb-3">
                        <button
                          type="button"
                          onClick={() =>
                            setValue("details.pickupOption", "admin")
                          }
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            watchPickupOption === "admin"
                              ? "bg-primary text-white"
                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                          }`}
                        >
                          Admin Defines Location
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setValue("details.pickupOption", "user")
                          }
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            watchPickupOption === "user"
                              ? "bg-primary text-white"
                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                          }`}
                        >
                          User Provides Location
                        </button>
                      </div>

                      {/* Option descriptions */}
                      <div className="text-xs text-gray-600 mb-3">
                        {watchPickupOption === "admin" ? (
                          <p>
                            💡 You will specify exact pickup locations and
                            instructions for customers
                          </p>
                        ) : (
                          <p>
                            💡 Customers will be asked to provide their pickup
                            location during booking
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Conditional Content Based on Option */}
                    {watchPickupOption === "admin" ? (
                      // Admin-defined pickup - show both location and description fields
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Exact Pickup Location *
                          </label>
                          <Controller
                            name="details.pickupLocation"
                            control={control}
                            render={({ field }) => (
                              <RichTextEditor
                                content={field.value || ""}
                                onChange={(content) => {
                                  field.onChange(content);
                                }}
                                placeholder="Provide the exact pickup location(s) - specific addresses, meeting points, landmarks, etc."
                                error={!!errors.details?.pickupLocation}
                                contentClassName="focus:outline-none min-h-[120px] p-4 text-sm leading-6"
                              />
                            )}
                          />
                          <p className="text-xs text-red-500 mt-1">
                            {errors.details?.pickupLocation?.message}
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Pickup Guidelines *
                          </label>
                          <Controller
                            name="details.pickupGuidelines"
                            control={control}
                            render={({ field }) => (
                              <RichTextEditor
                                content={field.value || ""}
                                onChange={(content) => {
                                  field.onChange(content);
                                }}
                                placeholder="Provide additional instructions, contact information, timing details, what customers should expect, etc."
                                error={!!errors.details?.pickupGuidelines}
                                contentClassName="focus:outline-none min-h-[120px] p-4 text-sm leading-6"
                              />
                            )}
                          />
                          <p className="text-xs text-red-500 mt-1">
                            {errors.details?.pickupGuidelines?.message}
                          </p>
                        </div>
                      </div>
                    ) : (
                      // User-defined pickup - show description field only
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Pickup Guidelines *
                        </label>
                        <Controller
                          name="details.pickupGuidelines"
                          control={control}
                          render={({ field }) => (
                            <RichTextEditor
                              content={field.value || ""}
                              onChange={(content) => {
                                field.onChange(content);
                              }}
                              placeholder="Describe what pickup information customers should provide (e.g., 'Please provide your hotel name and full address' or 'Specify your pickup location within the city center')..."
                              error={!!errors.details?.pickupGuidelines}
                              contentClassName="focus:outline-none min-h-[120px] p-4 text-sm leading-6"
                            />
                          )}
                        />
                        <p className="text-xs text-red-500 mt-1">
                          {errors.details?.pickupGuidelines?.message}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Important Notes *
                    </label>
                    <Controller
                      name="details.note"
                      control={control}
                      render={({ field }) => (
                        <RichTextEditor
                          content={field.value || ""}
                          onChange={(content) => {
                            field.onChange(content);
                          }}
                          placeholder="Luggage restrictions, cancellation policy, contact information, etc..."
                          error={!!errors.details?.note}
                          contentClassName="focus:outline-none min-h-[120px] p-4 text-sm leading-6"
                        />
                      )}
                    />
                    <p className="text-xs text-red-500 mt-1">
                      {errors.details?.note?.message}
                    </p>
                  </div>
                </div>
              </CollapsibleSection>

              {/* FAQ Section */}
              <CollapsibleSection
                title="Frequently Asked Questions"
                isExpanded={sectionsExpanded.faq}
                onToggle={() => toggleSection("faq")}
              >
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="border border-gray-200 rounded-md p-4"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium">Question {index + 1}</h3>
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <FiX />
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <input
                            {...register(`details.faq.${index}.question`)}
                            type="text"
                            className={`w-full px-3 py-2 border rounded-md ${
                              errors.details?.faq?.[index]?.question
                                ? "border-red-500"
                                : "border-gray-300"
                            }`}
                            placeholder="Enter question"
                          />
                          <p className="text-xs text-red-500 mt-1">
                            {errors.details?.faq?.[index]?.question?.message}
                          </p>
                        </div>

                        <div>
                          <Controller
                            name={`details.faq.${index}.answer`}
                            control={control}
                            render={({ field }) => (
                              <RichTextEditor
                                content={field.value || ""}
                                onChange={(content) => {
                                  field.onChange(content);
                                }}
                                placeholder="Enter answer"
                                error={!!errors.details?.faq?.[index]?.answer}
                                contentClassName="focus:outline-none min-h-[120px] p-4 text-sm leading-6"
                              />
                            )}
                          />
                          <p className="text-xs text-red-500 mt-1">
                            {errors.details?.faq?.[index]?.answer?.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => append({ question: "", answer: "" })}
                    className="text-primary hover:text-primary-dark flex items-center text-sm"
                  >
                    <FiPlus className="mr-1" /> Add another question
                  </button>
                </div>
              </CollapsibleSection>
            </div>

            {/* Right Column - Preview */}
            <div className="space-y-6">
              <div className="top-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-xl font-semibold">Preview</h2>
                  </div>
                  <div className="px-6 py-4">
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600 mb-4">
                        Preview how your transfer will appear to users
                      </p>

                      {watchTitle || watchImage || uploadedImageUrl ? (
                        <TransferCardPreview
                          slug={watchSlug || "sample-transfer"}
                          image={
                            uploadedImageUrl ||
                            watchImage ||
                            imagePreview ||
                            "/images/placeholder-transfer.jpg"
                          }
                          title={watchTitle || "Sample Transfer Title"}
                          tags={
                            watchTags && watchTags.length > 0
                              ? watchTags
                              : ["Sample Tag"]
                          }
                          desc={
                            watchDescription || "Sample transfer description..."
                          }
                          duration={watchDuration || "3"}
                          bookedCount={watchBookedCount || 0}
                          oldPrice={watchOldPrice || 0}
                          newPrice={watchNewPrice || 0}
                          childPrice={watchChildPrice || 0}
                          type={watchType || "Van"}
                          label={watchLabel !== "None" ? watchLabel : null}
                          /* status removed */
                          from={watchFrom || "Sample Origin"}
                          to={watchTo || "Sample Destination"}
                        />
                      ) : (
                        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                          <FiImage className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500">
                            Fill in the form to see preview
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="mt-6 top-8">
                  {/* Unified Validation Status Box */}
                  {!hasValidated && (
                    <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg">
                      <div className="flex items-center">
                        <FiCheck className="h-5 w-5 text-blue-500 mr-2" />
                        <span className="font-medium">Validation Required</span>
                      </div>
                      <p className="text-sm mt-1">
                        Please click "Validate Form" to check for errors before
                        creating your transfer.
                      </p>
                    </div>
                  )}

                  {hasValidated && validationSuccess && (
                    <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
                      <div className="flex items-center">
                        <FiCheck className="h-5 w-5 text-green-500 mr-2" />
                        <span className="font-medium">
                          All validation checks passed!
                        </span>
                      </div>
                      <p className="text-sm mt-1">
                        Your form is ready to be submitted.
                      </p>
                    </div>
                  )}

                  {hasValidated &&
                    !validationSuccess &&
                    Object.keys(errors).length > 0 && (
                      <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                        <div className="flex items-start">
                          <FiX className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                          <div>
                            <h3 className="font-medium mb-2">
                              Please fix the following errors:
                            </h3>
                            <ul className="text-sm space-y-1">
                              {errors.title && (
                                <li className="flex items-start">
                                  <span className="w-2 h-2 bg-red-400 rounded-full mr-2 flex-shrink-0 mt-1.5"></span>
                                  <span>
                                    <strong>Title:</strong>{" "}
                                    {errors.title.message}
                                  </span>
                                </li>
                              )}
                              {errors.slug && (
                                <li className="flex items-start">
                                  <span className="w-2 h-2 bg-red-400 rounded-full mr-2 flex-shrink-0 mt-1.5"></span>
                                  <span>
                                    <strong>Slug:</strong> {errors.slug.message}
                                  </span>
                                </li>
                              )}
                              {errors.description && (
                                <li className="flex items-start">
                                  <span className="w-2 h-2 bg-red-400 rounded-full mr-2 flex-shrink-0 mt-1.5"></span>
                                  <span>
                                    <strong>Description:</strong>{" "}
                                    {errors.description.message}
                                  </span>
                                </li>
                              )}
                              {errors.image && (
                                <li className="flex items-start">
                                  <span className="w-2 h-2 bg-red-400 rounded-full mr-2 flex-shrink-0 mt-1.5"></span>
                                  <span>
                                    <strong>Image:</strong>{" "}
                                    {errors.image.message}
                                  </span>
                                </li>
                              )}
                              {errors.from && (
                                <li className="flex items-start">
                                  <span className="w-2 h-2 bg-red-400 rounded-full mr-2 flex-shrink-0 mt-1.5"></span>
                                  <span>
                                    <strong>From:</strong> {errors.from.message}
                                  </span>
                                </li>
                              )}
                              {errors.to && (
                                <li className="flex items-start">
                                  <span className="w-2 h-2 bg-red-400 rounded-full mr-2 flex-shrink-0 mt-1.5"></span>
                                  <span>
                                    <strong>To:</strong> {errors.to.message}
                                  </span>
                                </li>
                              )}
                              {errors.duration && (
                                <li className="flex items-start">
                                  <span className="w-2 h-2 bg-red-400 rounded-full mr-2 flex-shrink-0 mt-1.5"></span>
                                  <span>
                                    <strong>Duration:</strong>{" "}
                                    {errors.duration.message}
                                  </span>
                                </li>
                              )}
                              {errors.oldPrice && (
                                <li className="flex items-start">
                                  <span className="w-2 h-2 bg-red-400 rounded-full mr-2 flex-shrink-0 mt-1.5"></span>
                                  <span>
                                    <strong>Old Price:</strong>{" "}
                                    {errors.oldPrice.message}
                                  </span>
                                </li>
                              )}
                              {errors.newPrice && (
                                <li className="flex items-start">
                                  <span className="w-2 h-2 bg-red-400 rounded-full mr-2 flex-shrink-0 mt-1.5"></span>
                                  <span>
                                    <strong>Current Price:</strong>{" "}
                                    {errors.newPrice.message}
                                  </span>
                                </li>
                              )}
                              {errors.childPrice && (
                                <li className="flex items-start">
                                  <span className="w-2 h-2 bg-red-400 rounded-full mr-2 flex-shrink-0 mt-1.5"></span>
                                  <span>
                                    <strong>Child Price:</strong>{" "}
                                    {errors.childPrice.message}
                                  </span>
                                </li>
                              )}
                              {errors.details?.about && (
                                <li className="flex items-start">
                                  <span className="w-2 h-2 bg-red-400 rounded-full mr-2 flex-shrink-0 mt-1.5"></span>
                                  <span>
                                    <strong>About Transfer:</strong>{" "}
                                    {errors.details.about.message}
                                  </span>
                                </li>
                              )}
                              {errors.details?.itinerary && (
                                <li className="flex items-start">
                                  <span className="w-2 h-2 bg-red-400 rounded-full mr-2 flex-shrink-0 mt-1.5"></span>
                                  <span>
                                    <strong>Route & Schedule:</strong>{" "}
                                    {errors.details.itinerary.message}
                                  </span>
                                </li>
                              )}
                              {errors.details?.pickupLocation && (
                                <li className="flex items-start">
                                  <span className="w-2 h-2 bg-red-400 rounded-full mr-2 flex-shrink-0 mt-1.5"></span>
                                  <span>
                                    <strong>Pickup Location:</strong>{" "}
                                    {errors.details.pickupLocation.message}
                                  </span>
                                </li>
                              )}
                              {errors.details?.note && (
                                <li className="flex items-start">
                                  <span className="w-2 h-2 bg-red-400 rounded-full mr-2 flex-shrink-0 mt-1.5"></span>
                                  <span>
                                    <strong>Important Notes:</strong>{" "}
                                    {errors.details.note.message}
                                  </span>
                                </li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                  <div className="flex flex-col space-y-3 md:hidden mb-4">
                    <button
                      type="button"
                      onClick={() => setShowClearConfirmation(true)}
                      className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 flex items-center justify-center space-x-2"
                    >
                      <FiX size={16} />
                      <span>Clear Form</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleShowErrors}
                      className="w-full px-4 py-2 bg-green-100/50 text-primary rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 hover:bg-green-100"
                    >
                      <FiCheck size={16} />
                      <span>Validate Form</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveTransfer}
                    disabled={
                      isSubmitting || !hasValidated || !validationSuccess
                    }
                    className={`w-full py-3 px-6 rounded-lg focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-200 flex items-center justify-center space-x-2 ${
                      isSubmitting || !hasValidated || !validationSuccess
                        ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                        : "bg-primary text-white hover:bg-primary/90"
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Creating Transfer...</span>
                      </>
                    ) : !hasValidated ? (
                      <>
                        <FiCheck size={18} />
                        <span>Validate Form First</span>
                      </>
                    ) : !validationSuccess ? (
                      <>
                        <FiX size={18} />
                        <span>Fix Errors to Create</span>
                      </>
                    ) : (
                      <>
                        <FiPlus size={18} />
                        <span>Create Transfer</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Clear Form Confirmation Modal */}
        <Confirmation
          isOpen={showClearConfirmation}
          onClose={() => setShowClearConfirmation(false)}
          onConfirm={confirmClearForm}
          title="Clear Form Data"
          message="Are you sure you want to clear all form data? This action cannot be undone."
          confirmText="Clear All"
          cancelText="Cancel"
          variant="danger"
        />
      </div>
    </div>
  );
}
