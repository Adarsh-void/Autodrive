export const SERVICE_PRICES: Record<string, number> = {
  "Engine Oil Change": 5,
  "Oil Filter Replacement": 3,
  "Air Filter Cleaning": 2,
  "Full Service (Basic Checkup)": 15,
  "Brake Service": 20,
  "Brake Pad Replacement": 12,
  "Clutch Repair": 25,
  "Suspension Repair": 30,
  "Tyre Replacement": 7,
  "Wheel Alignment": 10,
  "Wheel Balancing": 8,
  "Puncture Repair": 2,
  "Battery Replacement": 20,
  "Wiring Repair": 15,
  "Headlight Replacement": 5,
  "AC Service": 18,
  "Car Wash": 3,
  "Interior Cleaning": 6,
  "Engine Diagnostics": 10,
  "Full Car Inspection": 25,
  "Engine Repair": 50,
  "Insurance Inspection": 12
};

export const SERVICE_CATEGORIES = [
  {
    name: "Basic Services",
    icon: "🔧",
    services: [
      "Engine Oil Change",
      "Oil Filter Replacement",
      "Air Filter Cleaning",
      "Full Service (Basic Checkup)"
    ]
  },
  {
    name: "Mechanical Repairs",
    icon: "🚗",
    services: [
      "Brake Service",
      "Brake Pad Replacement",
      "Clutch Repair",
      "Suspension Repair"
    ]
  },
  {
    name: "Tyre & Wheel Services",
    icon: "🛞",
    services: [
      "Tyre Replacement",
      "Wheel Alignment",
      "Wheel Balancing",
      "Puncture Repair"
    ]
  },
  {
    name: "Electrical Services",
    icon: "🔋",
    services: [
      "Battery Replacement",
      "Wiring Repair",
      "Headlight Replacement"
    ]
  },
  {
    name: "Additional Services",
    icon: "❄️",
    services: [
      "AC Service",
      "Car Wash",
      "Interior Cleaning",
      "Engine Diagnostics"
    ]
  },
  {
    name: "Premium Services",
    icon: "🧾",
    services: [
      "Full Car Inspection",
      "Engine Repair",
      "Insurance Inspection"
    ]
  }
];
