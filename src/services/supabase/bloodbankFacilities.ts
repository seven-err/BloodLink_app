import type { Database } from '@/types/database';
import type { BloodRequestFacility } from '@/constants/bloodRequestFacilities';

import { supabase } from './client';

type ConnectedBloodbankFacility =
  Database['public']['Functions']['list_verified_bloodbank_facilities']['Returns'][number];

export const listVerifiedBloodbankFacilities = async () => {
  const result = await supabase.rpc('list_verified_bloodbank_facilities');

  return {
    ...result,
    data: result.data?.map(
      (facility: ConnectedBloodbankFacility): BloodRequestFacility => ({
        id: `bloodlink:${facility.bloodbank_id}`,
        displayName: facility.display_name,
        branchLocation: facility.branch_location,
        address: facility.address?.trim() || facility.branch_location?.trim() || '',
        latitude: facility.latitude,
        longitude: facility.longitude,
        source: 'bloodlink',
      }),
    ) ?? null,
  };
};
