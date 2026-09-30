export type BloodRequestFacility = {
  address: string;
  branchLocation: string | null;
  displayName: string;
  id: string;
  latitude: number | null;
  longitude: number | null;
  source: 'bloodlink' | 'directory';
};

/**
 * Publicly listed Cebu facilities that recipients can select even when the
 * facility does not have a BloodLink account. Keep these records free of
 * account or partnership claims; connected facilities are added at runtime.
 */
export const BLOOD_REQUEST_FACILITY_DIRECTORY: BloodRequestFacility[] = [
  {
    id: 'directory:cph-bogo-city',
    displayName: 'Cebu Provincial Hospital – Bogo City',
    branchLocation: 'Bogo City, Cebu',
    address: 'Cebu North Hagnaya Wharf Road, Bogo City, Cebu',
    latitude: null,
    longitude: null,
    source: 'directory',
  },
  {
    id: 'directory:bogo-medellin-medical-center',
    displayName: 'Bogo-Medellin Medical Center',
    branchLocation: 'Medellin, Cebu',
    address: 'Luy-a, Medellin, Cebu',
    latitude: null,
    longitude: null,
    source: 'directory',
  },
  {
    id: 'directory:daanbantayan-district-hospital',
    displayName: 'Daanbantayan District Hospital',
    branchLocation: 'Daanbantayan, Cebu',
    address: 'Pajo, Daanbantayan, Cebu',
    latitude: null,
    longitude: null,
    source: 'directory',
  },
  {
    id: 'directory:bantayan-district-hospital',
    displayName: 'Bantayan District Hospital',
    branchLocation: 'Bantayan, Cebu',
    address: 'Ticad, Bantayan, Cebu',
    latitude: null,
    longitude: null,
    source: 'directory',
  },
  {
    id: 'directory:tuburan-district-hospital',
    displayName: 'Tuburan District Hospital',
    branchLocation: 'Tuburan, Cebu',
    address: 'Tuburan, Cebu',
    latitude: null,
    longitude: null,
    source: 'directory',
  },
  {
    id: 'directory:sogod-district-hospital',
    displayName: 'Sogod District Hospital',
    branchLocation: 'Sogod, Cebu',
    address: 'Sogod, Cebu',
    latitude: null,
    longitude: null,
    source: 'directory',
  },
  {
    id: 'directory:cph-danao-city',
    displayName: 'Cebu Provincial Hospital – Danao City',
    branchLocation: 'Danao City, Cebu',
    address: 'Danao City, Cebu',
    latitude: null,
    longitude: null,
    source: 'directory',
  },
  {
    id: 'directory:cph-balamban',
    displayName: 'Cebu Provincial Hospital – Balamban',
    branchLocation: 'Balamban, Cebu',
    address: 'Malvar Street, Balamban, Cebu',
    latitude: null,
    longitude: null,
    source: 'directory',
  },
  {
    id: 'directory:cph-carcar-city',
    displayName: 'Cebu Provincial Hospital – Carcar City',
    branchLocation: 'Carcar City, Cebu',
    address: 'Barraca Street, Poblacion II, Carcar City, Cebu',
    latitude: null,
    longitude: null,
    source: 'directory',
  },
  {
    id: 'directory:vicente-sotto-memorial-medical-center',
    displayName: 'Vicente Sotto Memorial Medical Center',
    branchLocation: 'Cebu City, Cebu',
    address: 'B. Rodriguez Street, Sambag 2, Cebu City, Cebu',
    latitude: null,
    longitude: null,
    source: 'directory',
  },
  {
    id: 'directory:prc-cebu-bogo-blood-station',
    displayName: 'Philippine Red Cross – Cebu-Bogo City Blood Station',
    branchLocation: 'Bogo City, Cebu',
    address: 'Bogo City, Cebu',
    latitude: null,
    longitude: null,
    source: 'directory',
  },
  {
    id: 'directory:prc-eastern-visayas-regional-blood-center',
    displayName: 'Philippine Red Cross – Eastern Visayas Regional Blood Center',
    branchLocation: 'Cebu City, Cebu',
    address: 'Osmeña Boulevard, Cebu City, Cebu',
    latitude: null,
    longitude: null,
    source: 'directory',
  },
];
