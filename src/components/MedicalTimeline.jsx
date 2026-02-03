import { Calendar, FileText, Heart } from "lucide-react";
import { useState } from "react";

export const MedicalTimeline = ({ timeline }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState({
    type: "all", // all, appointment, admission, medical_record
    dateRange: "all", // all, today, week, month, year
    status: "all", // all, completed, active, discharged, cancelled
  });

  // Apply filters
  const filteredTimeline = timeline.filter((record) => {
    // Search filter
    const matchesSearch =
      !searchQuery ||
      record.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.diagnosis?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.doctor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.chiefComplaint?.toLowerCase().includes(searchQuery.toLowerCase());

    // Type filter
    const matchesType =
      selectedFilters.type === "all" || record.type === selectedFilters.type;

    // Status filter
    const matchesStatus =
      selectedFilters.status === "all" ||
      record.status === selectedFilters.status;

    // Date range filter
    const matchesDateRange = () => {
      if (selectedFilters.dateRange === "all") return true;

      const recordDate = new Date(record.date);
      const now = new Date();

      switch (selectedFilters.dateRange) {
        case "today":
          return recordDate.toDateString() === now.toDateString();
        case "week":
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return recordDate >= weekAgo;
        case "month":
          const monthAgo = new Date(now);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return recordDate >= monthAgo;
        case "year":
          const yearAgo = new Date(now);
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          return recordDate >= yearAgo;
        default:
          return true;
      }
    };

    return matchesSearch && matchesType && matchesStatus && matchesDateRange();
  });

  // Group by date
  const groupedByDate = {};
  filteredTimeline.forEach((record) => {
    const date = new Date(record.date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!groupedByDate[date]) {
      groupedByDate[date] = [];
    }
    groupedByDate[date].push(record);
  });

  const dates = Object.keys(groupedByDate).sort(
    (a, b) => new Date(b) - new Date(a),
  );

  // Filter options
  const typeOptions = [
    { value: "all", label: "All Types" },
    { value: "appointment", label: "Appointments" },
    { value: "admission", label: "Admissions" },
    { value: "medical_record", label: "Medical Records" },
  ];

  const dateRangeOptions = [
    { value: "all", label: "All Time" },
    { value: "today", label: "Today" },
    { value: "week", label: "Last 7 Days" },
    { value: "month", label: "Last 30 Days" },
    { value: "year", label: "Last Year" },
  ];

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "completed", label: "Completed" },
    { value: "discharged", label: "Discharged" },
    { value: "active", label: "Active" },
    { value: "scheduled", label: "Scheduled" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search records by diagnosis, doctor, complaint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()} // Prevent event bubbling
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none"
              autoFocus={false}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Record Type
              </label>
              <select
                value={selectedFilters.type}
                onChange={(e) =>
                  setSelectedFilters({
                    ...selectedFilters,
                    type: e.target.value,
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Range
              </label>
              <select
                value={selectedFilters.dateRange}
                onChange={(e) =>
                  setSelectedFilters({
                    ...selectedFilters,
                    dateRange: e.target.value,
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {dateRangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={selectedFilters.status}
                onChange={(e) =>
                  setSelectedFilters({
                    ...selectedFilters,
                    status: e.target.value,
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filters Display */}
          {(selectedFilters.type !== "all" ||
            selectedFilters.dateRange !== "all" ||
            selectedFilters.status !== "all") && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">Active filters:</span>
              {selectedFilters.type !== "all" && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                  {
                    typeOptions.find(
                      (opt) => opt.value === selectedFilters.type,
                    )?.label
                  }
                  <button
                    onClick={() =>
                      setSelectedFilters({ ...selectedFilters, type: "all" })
                    }
                    className="text-blue-600 hover:text-blue-800"
                  >
                    ✕
                  </button>
                </span>
              )}
              {selectedFilters.dateRange !== "all" && (
                <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                  {
                    dateRangeOptions.find(
                      (opt) => opt.value === selectedFilters.dateRange,
                    )?.label
                  }
                  <button
                    onClick={() =>
                      setSelectedFilters({
                        ...selectedFilters,
                        dateRange: "all",
                      })
                    }
                    className="text-green-600 hover:text-green-800"
                  >
                    ✕
                  </button>
                </span>
              )}
              {selectedFilters.status !== "all" && (
                <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
                  {
                    statusOptions.find(
                      (opt) => opt.value === selectedFilters.status,
                    )?.label
                  }
                  <button
                    onClick={() =>
                      setSelectedFilters({ ...selectedFilters, status: "all" })
                    }
                    className="text-purple-600 hover:text-purple-800"
                  >
                    ✕
                  </button>
                </span>
              )}
              <button
                onClick={() =>
                  setSelectedFilters({
                    type: "all",
                    dateRange: "all",
                    status: "all",
                  })
                }
                className="text-sm text-red-600 hover:text-red-800"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* Results Count */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {filteredTimeline.length} of {timeline.length} records
            </div>
            <div className="text-sm">
              <span className="font-medium">{filteredTimeline.length}</span>{" "}
              results found
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Results */}
      {dates.length > 0 ? (
        <div className="space-y-6">
          {dates.map((date) => (
            <div key={date} className="space-y-3">
              <h3 className="text-lg font-bold text-gray-900 border-b pb-2">
                {date}
              </h3>
              <div className="space-y-3">
                {groupedByDate[date].map((record) => (
                  <TimelineRecord
                    key={record.id}
                    record={record}
                    expandedRecords={expandedRecords}
                    toggleRecordExpansion={toggleRecordExpansion}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No records found
          </h3>
          <p className="text-gray-600">
            {searchQuery ||
            selectedFilters.type !== "all" ||
            selectedFilters.dateRange !== "all" ||
            selectedFilters.status !== "all"
              ? "Try adjusting your search or filters"
              : "No medical records available for this patient"}
          </p>
          {(searchQuery ||
            selectedFilters.type !== "all" ||
            selectedFilters.dateRange !== "all" ||
            selectedFilters.status !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedFilters({
                  type: "all",
                  dateRange: "all",
                  status: "all",
                });
              }}
              className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Clear all filters and search
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Separate component for individual records for better organization
const TimelineRecord = ({ record, expandedRecords, toggleRecordExpansion }) => (
  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
    <button
      onClick={() => toggleRecordExpansion(record.id)}
      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
    >
      <div className="flex items-start gap-3 flex-1">
        <RecordIcon type={record.type} />
        <div className="text-left flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-gray-900">{record.title}</h3>
            {record.status && <StatusBadge status={record.status} />}
            {record.admission_type && (
              <AdmissionTypeBadge type={record.admission_type} />
            )}
          </div>
          {record.diagnosis && (
            <p className="text-sm text-gray-600">
              Diagnosis: {record.diagnosis}
            </p>
          )}
          {record.chiefComplaint && (
            <p className="text-sm text-gray-600 mt-1">
              Complaint: {record.chiefComplaint}
            </p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {record.doctor || "Unknown Doctor"}
            </span>
            {record.admission_number && (
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {record.admission_number}
              </span>
            )}
            {record.appointment_number && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {record.appointment_number}
              </span>
            )}
          </div>
        </div>
      </div>
      {expandedRecords[record.id] ? (
        <ChevronDown className="w-5 h-5 text-gray-400" />
      ) : (
        <ChevronRight className="w-5 h-5 text-gray-400" />
      )}
    </button>

    {expandedRecords[record.id] && <RecordDetails record={record} />}
  </div>
);

// Helper components
const RecordIcon = ({ type }) => {
  const iconConfig = {
    admission: { icon: Heart, bg: "bg-red-100", color: "text-red-600" },
    appointment: { icon: Calendar, bg: "bg-blue-100", color: "text-blue-600" },
    medical_record: {
      icon: FileText,
      bg: "bg-green-100",
      color: "text-green-600",
    },
  };

  const config = iconConfig[type] || {
    icon: FileText,
    bg: "bg-gray-100",
    color: "text-gray-600",
  };
  const Icon = config.icon;

  return (
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bg}`}
    >
      <Icon className={`w-5 h-5 ${config.color}`} />
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const statusConfig = {
    completed: {
      bg: "bg-green-100",
      text: "text-green-800",
      label: "Completed",
    },
    discharged: {
      bg: "bg-blue-100",
      text: "text-blue-800",
      label: "Discharged",
    },
    active: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Active" },
    scheduled: {
      bg: "bg-purple-100",
      text: "text-purple-800",
      label: "Scheduled",
    },
    cancelled: { bg: "bg-red-100", text: "text-red-800", label: "Cancelled" },
  };

  const config = statusConfig[status.toLowerCase()] || {
    bg: "bg-gray-100",
    text: "text-gray-800",
    label: status,
  };

  return (
    <span
      className={`px-2 py-1 text-xs rounded-full ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
};

const AdmissionTypeBadge = ({ type }) => (
  <span className="px-2 py-1 text-xs rounded-full bg-indigo-100 text-indigo-800">
    {type}
  </span>
);

const RecordDetails = ({ record }) => (
  <div className="p-4 border-t border-gray-200 bg-gray-50">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Vitals Section */}
      {record.vitals && Object.keys(record.vitals).length > 0 && (
        <div className="bg-white p-4 rounded border">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Vitals
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(record.vitals).map(([key, value]) => (
              <div key={key} className="text-left">
                <div className="text-xs text-gray-500 capitalize">
                  {key.replace(/_/g, " ")}
                </div>
                <div className="font-semibold">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Additional Information */}
      <div className="space-y-4">
        {/* Prescriptions */}
        {record.prescriptions && record.prescriptions.length > 0 && (
          <div className="bg-white p-4 rounded border">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Pill className="w-4 h-4" /> Prescriptions
            </h4>
            <div className="space-y-2">
              {record.prescriptions.map((prescription, idx) => (
                <div
                  key={idx}
                  className="text-sm border-l-2 border-blue-500 pl-2"
                >
                  <div className="font-medium">{prescription.name}</div>
                  <div className="text-gray-600">{prescription.dosage}</div>
                  {prescription.notes && (
                    <div className="text-gray-500 text-xs mt-1">
                      {prescription.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admission Details */}
        {record.admission_id && (
          <div className="bg-white p-4 rounded border">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Heart className="w-4 h-4" /> Admission Details
            </h4>
            <div className="space-y-1 text-sm">
              {record.admission_number && (
                <div>
                  <span className="text-gray-600">Admission #:</span>
                  <span className="font-medium ml-2">
                    {record.admission_number}
                  </span>
                </div>
              )}
              {record.diagnosis_at_admission && (
                <div>
                  <span className="text-gray-600">Diagnosis:</span>
                  <span className="font-medium ml-2">
                    {record.diagnosis_at_admission}
                  </span>
                </div>
              )}
              {record.length_of_stay_days && (
                <div>
                  <span className="text-gray-600">Length of Stay:</span>
                  <span className="font-medium ml-2">
                    {record.length_of_stay_days} days
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
