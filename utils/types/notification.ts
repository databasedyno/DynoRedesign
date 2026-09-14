export interface NotificationItemProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  showDivider?: boolean;
  testId?: string;
}
