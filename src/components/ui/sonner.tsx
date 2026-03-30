import { useTheme } from "@/contexts/ThemeContext";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      richColors
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast border shadow-lg backdrop-blur-sm group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border",
          title: "font-semibold",
          description: "group-[.toast]:text-muted-foreground",
          success:
            "!border-success/30 !bg-success/12 !text-foreground dark:!bg-success/20 [&_[data-icon]]:!text-success",
          error:
            "!border-destructive/30 !bg-destructive/10 !text-foreground dark:!bg-destructive/20 [&_[data-icon]]:!text-destructive",
          warning:
            "!border-warning/35 !bg-warning/12 !text-foreground dark:!bg-warning/20 [&_[data-icon]]:!text-warning",
          info:
            "!border-accent/30 !bg-accent/10 !text-foreground dark:!bg-accent/20 [&_[data-icon]]:!text-accent",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
