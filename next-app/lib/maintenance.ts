export const MAINTENANCE_CONFIG = {
  // Toggle this to true/false to enable or disable maintenance mode across the app
  isMaintenanceActive: true,

  // Display details
  title: "We're Upgrading MyBuddyMaid",
  subtitle: "We are currently performing scheduled infrastructure & algorithm upgrades to bring you faster maid matching, enhanced security, and real-time booking tracking.",
  
  // Progress status (0 - 100)
  progressPercent: 84,

  // Target completion time (3 hours from now by default for live countdown display)
  targetCompletionMinutes: 180,

  // Subsystem status list
  subsystems: [
    { name: "Maid Matching Algorithm", status: "completed", label: "Optimized (v2.4)" },
    { name: "Database & Security hardening", status: "completed", label: "Completed" },
    { name: "Real-time Booking Engine", status: "in-progress", label: "Upgrading Data Pipelines..." },
    { name: "SMS & WhatsApp Notifications", status: "pending", label: "Scheduled Final Verification" },
  ],

  // Support contacts during maintenance
  emergencyContact: {
    phone: "+91 9318429135",
    whatsapp: "https://wa.me/919318429135?text=Hi%20MyBuddyMaid%20Support,%20I%20need%20urgent%20assistance",
    email: "support@mybuddymaid.com"
  }
};
