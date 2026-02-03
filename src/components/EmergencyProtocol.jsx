const EmergencyProtocolPanel = ({
  patient,
  emergencyContacts,
  criticalInfo,
}) => {
  // Get primary and emergency contacts
  const primaryContact = emergencyContacts?.find(
    (contact) => contact.is_primary,
  );
  const emergencyContact = emergencyContacts?.find(
    (contact) => contact.contact_type === "emergency",
  );

  return (
    <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
      <h3 className="text-xl font-bold text-red-900 mb-4 flex items-center gap-3">
        <AlertOctagon className="w-6 h-6" />
        EMERGENCY PROTOCOL
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Emergency Contacts */}
        <div>
          <h4 className="font-semibold text-red-800 mb-3">
            🆘 EMERGENCY CONTACTS
          </h4>
          <div className="space-y-3">
            {/* Primary Contact */}
            {primaryContact && (
              <div className="bg-white p-4 rounded-lg border border-red-200">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-gray-900">
                      {primaryContact.contact_name || "Primary Contact"}
                      <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        PRIMARY
                      </span>
                    </div>
                    <div className="text-gray-600 mt-1">
                      {primaryContact.contact_number}
                    </div>
                    {primaryContact.relationship && (
                      <div className="text-sm text-gray-500 mt-1">
                        Relationship: {primaryContact.relationship}
                      </div>
                    )}
                  </div>
                  <button className="flex items-center gap-2 bg-red-100 text-red-700 px-3 py-1.5 rounded hover:bg-red-200 transition text-sm">
                    <Phone className="w-4 h-4" />
                    Call Now
                  </button>
                </div>
              </div>
            )}

            {/* Emergency Contact */}
            {emergencyContact && (
              <div className="bg-white p-4 rounded-lg border border-red-200">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-gray-900">
                      {emergencyContact.contact_name || "Emergency Contact"}
                      <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                        EMERGENCY
                      </span>
                    </div>
                    <div className="text-gray-600 mt-1">
                      {emergencyContact.contact_number}
                    </div>
                    {emergencyContact.relationship && (
                      <div className="text-sm text-gray-500 mt-1">
                        Relationship: {emergencyContact.relationship}
                      </div>
                    )}
                  </div>
                  <button className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 transition text-sm">
                    <Phone className="w-4 h-4" />
                    Emergency Call
                  </button>
                </div>
              </div>
            )}

            {/* Next of Kin (if available) */}
            {patient?.next_of_kin && (
              <div className="bg-white p-4 rounded-lg border border-red-200">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-gray-900">
                      {patient.next_of_kin.name}
                      <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                        NEXT OF KIN
                      </span>
                    </div>
                    <div className="text-gray-600 mt-1">
                      {patient.next_of_kin.phone}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Relationship: {patient.next_of_kin.relationship}
                    </div>
                  </div>
                  <button className="flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1.5 rounded hover:bg-purple-200 transition text-sm">
                    <Phone className="w-4 h-4" />
                    Contact
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Contact Actions */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 transition text-sm">
              📞 Call All Contacts
            </button>
            <button className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 transition text-sm">
              📱 Send SMS Alert
            </button>
          </div>
        </div>

        {/* Emergency Instructions */}
        <div>
          <h4 className="font-semibold text-red-800 mb-3">
            ⚠️ EMERGENCY INSTRUCTIONS
          </h4>
          <div className="bg-white p-4 rounded-lg border border-red-200 space-y-4">
            {/* Critical Allergies */}
            {criticalInfo?.allergies && criticalInfo.allergies.length > 0 && (
              <div>
                <div className="font-bold text-red-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  CRITICAL ALLERGIES
                </div>
                <div className="mt-2 space-y-2">
                  {criticalInfo.allergies.slice(0, 3).map((allergy, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="font-medium">
                        • {allergy.name || allergy}
                      </span>
                      {allergy.reaction && (
                        <span className="text-red-700 ml-2">
                          ({allergy.reaction})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Medical Conditions */}
            {criticalInfo?.conditions && criticalInfo.conditions.length > 0 && (
              <div>
                <div className="font-bold text-red-900 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  CHRONIC CONDITIONS
                </div>
                <div className="mt-2 space-y-2">
                  {criticalInfo.conditions.slice(0, 3).map((condition, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="font-medium">
                        • {condition.name || condition}
                      </span>
                      {condition.current_medication && (
                        <span className="text-blue-700 ml-2">
                          Med: {condition.current_medication}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Current Medications */}
            {criticalInfo?.medications &&
              criticalInfo.medications.length > 0 && (
                <div>
                  <div className="font-bold text-red-900 flex items-center gap-2">
                    <Pill className="w-4 h-4" />
                    CURRENT MEDICATIONS
                  </div>
                  <div className="mt-2 space-y-2">
                    {criticalInfo.medications.slice(0, 3).map((med, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="font-medium">• {med.name || med}</span>
                        {med.dosage && (
                          <span className="text-gray-600 ml-2">
                            {med.dosage}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Patient Information */}
            <div className="pt-4 border-t border-gray-200">
              <div className="font-bold text-red-900">PATIENT INFORMATION</div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                <div>
                  <span className="text-gray-600">Name:</span>
                  <span className="font-medium ml-2">{patient?.fullName}</span>
                </div>
                <div>
                  <span className="text-gray-600">Age:</span>
                  <span className="font-medium ml-2">{patient?.age}</span>
                </div>
                <div>
                  <span className="text-gray-600">Blood Type:</span>
                  <span className="font-medium ml-2">
                    {patient?.bloodType || "Unknown"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">MRN:</span>
                  <span className="font-medium ml-2">
                    {patient?.patientNumber}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Action Buttons */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <button className="bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition font-bold flex items-center justify-center gap-2">
          <AlertOctagon className="w-5 h-5" />
          ACTIVATE EMERGENCY PROTOCOL
        </button>
        <button className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition font-bold flex items-center justify-center gap-2">
          <FileText className="w-5 h-5" />
          PRINT EMERGENCY SUMMARY
        </button>
        <button className="bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition font-bold flex items-center justify-center gap-2">
          <Download className="w-5 h-5" />
          EXPORT TO PDF
        </button>
      </div>
    </div>
  );
};
