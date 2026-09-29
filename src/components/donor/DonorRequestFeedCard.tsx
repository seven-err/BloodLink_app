import { UrgentRequestCard } from '@/components/donor/UrgentRequestCard';
import type { BloodRequestUrgency } from '@/types/database';

type DonorRequestFeedCardProps = {
  bloodType: string;
  compatible: boolean;
  distanceLabel: string;
  onChat: () => void;
  onRespond: () => void;
  onViewDetails: () => void;
  subtitle: string;
  timeLabel: string;
  title: string;
  unitsNeeded: number;
  urgency: BloodRequestUrgency;
};

export function DonorRequestFeedCard({
  bloodType,
  distanceLabel,
  onChat,
  onRespond,
  onViewDetails,
  subtitle,
  timeLabel,
  title,
  unitsNeeded,
  urgency,
}: DonorRequestFeedCardProps) {
  return (
    <UrgentRequestCard
      bloodType={bloodType}
      distanceLabel={distanceLabel}
      hospitalName={subtitle || title}
      timeLabel={timeLabel}
      title={title}
      unitsNeeded={unitsNeeded}
      urgency={urgency}
      onChat={onChat}
      onDetails={onViewDetails}
      onRespond={onRespond}
    />
  );
}
