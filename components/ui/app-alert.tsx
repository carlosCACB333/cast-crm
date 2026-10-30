import { Alert } from "@heroui/react";

export interface AppAlertProps {
  status: "danger" | "success" | "accent";
  title: string;
  description?: React.ReactNode;
}

export function AppAlert({ status, title, description }: AppAlertProps) {
  return (
    <Alert status={status}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        {description ? (
          <Alert.Description>{description}</Alert.Description>
        ) : null}
      </Alert.Content>
    </Alert>
  );
}
